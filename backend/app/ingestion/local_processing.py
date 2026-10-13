"""Gemini Vision document extraction and human-review workflow."""

import hashlib
import json
import mimetypes
import re
import unicodedata
import uuid
from dataclasses import dataclass
from datetime import UTC, date, datetime
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.enums import DocumentStatus, PolicyUpdateStatus
from app.core.errors import AppError
from app.core.policy_topics import (
    canonical_policy_topic,
    infer_policy_topic,
    policy_match_tokens,
    policy_token_overlap,
    policy_topics_in_text,
)
from app.models import (
    Course,
    Document,
    DocumentChunk,
    DocumentProcessing,
    DocumentReviewItem,
    PolicyUpdate,
    PolicyVersion,
)
from app.schemas.documents import (
    ConflictItem,
    ConflictResolutionItem,
    DocumentResponse,
    ExistingConflictItem,
    FinalizePayload,
    FinalizeSummaryResponse,
    ProcessingResponse,
    ReviewItemResponse,
)

SUPPORTED_SUFFIXES = {".pdf": "PDF", ".docx": "DOCX", ".png": "IMAGE", ".jpg": "IMAGE", ".jpeg": "IMAGE"}
_GEMINI_VISION_PROMPT = """You are an OCR engine for Vietnamese academic regulations.
Extract every visible text line exactly as written, including printed and handwritten Vietnamese.
Return JSON only in this shape:
{"pages":[{"page_number":1,"lines":[{"text":"...","confidence":0.0,"box":[ymin,xmin,ymax,xmax]}]}]}
`confidence` is your estimated reading confidence from 0.0 to 1.0. Use a value below 0.80
for blurry, ambiguous, or hard-to-read handwriting. `box` is optional and uses a 0..1000
coordinate system relative to the page/image. Do not add commentary or infer missing text."""


@dataclass
class OCRToken:
    text: str
    confidence: float
    page_number: int
    box: tuple[int, int, int, int] | None = None


def _root() -> Path:
    configured = Path(get_settings().local_document_storage_dir)
    if not configured.is_absolute():
        from app.ingestion.service import REPOSITORY_ROOT
        configured = REPOSITORY_ROOT / configured
    return configured.resolve()


def safe_filename(name: str) -> str:
    stem = re.sub(r"[^A-Za-z0-9._-]+", "-", Path(name).name).strip(".-")
    return stem or "document"


def local_relative(path: Path) -> str:
    from app.ingestion.service import REPOSITORY_ROOT
    return path.resolve().relative_to(REPOSITORY_ROOT).as_posix()


def local_absolute(relative_path: str) -> Path:
    from app.ingestion.service import REPOSITORY_ROOT
    candidate = (REPOSITORY_ROOT / relative_path).resolve()
    if not candidate.is_relative_to(_root()):
        raise AppError("DOCUMENT_PATH_NOT_ALLOWED", "Đường dẫn tài liệu Local không hợp lệ.", status_code=422)
    return candidate


def _pdf_images(path: Path) -> list[Any]:
    try:
        from PIL import Image
    except ImportError as exc:
        raise AppError("DOCUMENT_RENDER_UNAVAILABLE", "Thiếu thư viện xử lý ảnh (Pillow).", status_code=422) from exc
    try:
        import fitz
    except ImportError as exc:
        raise AppError("DOCUMENT_RENDER_UNAVAILABLE", "Thiếu thư viện render PDF (PyMuPDF).", status_code=422) from exc
    try:
        pdf = fitz.open(path)
        return [Image.frombytes("RGB", (pix.width, pix.height), pix.samples) for page in pdf for pix in [page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)]]
    except Exception as exc:
        raise AppError("INVALID_DOCUMENT_FILE", "Không thể mở hoặc render PDF đã tải lên.", status_code=422) from exc


def _pdf_native_text(path: Path) -> str:
    """Prefer the embedded PDF text layer before invoking cloud OCR."""
    try:
        import fitz
        pdf = fitz.open(path)
        try:
            return "\n".join(page.get_text("text") for page in pdf).strip()
        finally:
            pdf.close()
    except Exception:
        # A scanned or malformed text layer is eligible for the Gemini Vision
        # fallback. Rendering/validation errors are handled there consistently.
        return ""


def _vision_mime_type(path: Path) -> str:
    return {
        ".pdf": "application/pdf",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
    }.get(path.suffix.lower(), mimetypes.guess_type(path.name)[0] or "application/octet-stream")


def _gemini_box(raw_box: Any, image: Any | None) -> tuple[int, int, int, int] | None:
    """Convert Gemini's optional [ymin, xmin, ymax, xmax] box to image pixels."""
    if image is None or not isinstance(raw_box, list) or len(raw_box) != 4:
        return None
    try:
        ymin, xmin, ymax, xmax = [float(value) for value in raw_box]
    except (TypeError, ValueError):
        return None
    if not (0 <= ymin < ymax <= 1000 and 0 <= xmin < xmax <= 1000):
        return None
    x = int(image.width * xmin / 1000)
    y = int(image.height * ymin / 1000)
    width = max(1, int(image.width * xmax / 1000) - x)
    height = max(1, int(image.height * ymax / 1000) - y)
    return x, y, width, height


def _gemini_tokens(payload: Any, images: list[Any]) -> list[OCRToken]:
    """Validate a Gemini Vision OCR response without trusting its structure."""
    if not isinstance(payload, dict) or not isinstance(payload.get("pages"), list):
        raise AppError("GEMINI_VISION_INVALID_RESPONSE", "Gemini Vision tra ve ket qua OCR khong hop le.", status_code=422)
    tokens: list[OCRToken] = []
    for page_index, page in enumerate(payload["pages"], start=1):
        if not isinstance(page, dict):
            continue
        page_number = page.get("page_number", page_index)
        if not isinstance(page_number, int) or page_number < 1:
            page_number = page_index
        lines = page.get("lines")
        if not isinstance(lines, list):
            continue
        image = images[page_number - 1] if page_number <= len(images) else None
        for line in lines:
            if not isinstance(line, dict):
                continue
            text = str(line.get("text") or "").strip()
            if not text:
                continue
            try:
                confidence = float(line.get("confidence"))
            except (TypeError, ValueError):
                # Missing confidence must be reviewed instead of being treated as accurate.
                confidence = 0.5
            tokens.append(OCRToken(
                text=text,
                confidence=max(0.0, min(1.0, confidence)),
                page_number=page_number,
                box=_gemini_box(line.get("box"), image),
            ))
    return tokens


def _gemini_vision_ocr(path: Path, images: list[Any]) -> list[OCRToken]:
    settings = get_settings()
    if not settings.gemini_vision_api_key:
        raise AppError(
            "GEMINI_VISION_KEY_MISSING",
            "Chua cau hinh GEMINI_VISION_API_KEY rieng cho trich xuat anh/PDF.",
            status_code=422,
        )
    try:
        from google import genai
        from google.genai import types
    except ImportError as exc:
        raise AppError("GEMINI_VISION_UNAVAILABLE", "Thieu thu vien Google GenAI cho Gemini Vision.", status_code=422) from exc
    try:
        client = genai.Client(api_key=settings.gemini_vision_api_key)
        response = client.models.generate_content(
            model=settings.gemini_vision_model,
            contents=[
                _GEMINI_VISION_PROMPT,
                types.Part.from_bytes(data=path.read_bytes(), mime_type=_vision_mime_type(path)),
            ],
            config=types.GenerateContentConfig(
                temperature=0,
                response_mime_type="application/json",
                max_output_tokens=16_000,
            ),
        )
        raw_text = (response.text or "").strip()
        if raw_text.startswith("```"):
            raw_text = raw_text.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
        tokens = _gemini_tokens(json.loads(raw_text), images)
    except AppError:
        raise
    except Exception as exc:
        if getattr(exc, "code", getattr(exc, "status_code", None)) == 404:
            raise AppError(
                "GEMINI_VISION_MODEL_UNAVAILABLE",
                f"Model Gemini Vision '{settings.gemini_vision_model}' khong kha dung. Kiem tra GEMINI_VISION_MODEL.",
                status_code=422,
            ) from exc
        raise AppError(
            "GEMINI_VISION_OCR_FAILED",
            "Gemini Vision khong the trich xuat noi dung. Kiem tra key, model va ket noi mang.",
            status_code=422,
        ) from exc
    if not tokens:
        raise AppError("OCR_EMPTY_RESULT", "Gemini Vision khong nhan dien duoc van ban trong tai lieu.", status_code=422)
    return tokens


def _extract_with_gemini_vision(path: Path, document_type: str) -> tuple[str, str, list[OCRToken], list[Any]]:
    if document_type == "PDF":
        images = _pdf_images(path)
    elif document_type == "IMAGE":
        try:
            from PIL import Image
            images = [Image.open(path).convert("RGB")]
        except Exception as exc:
            raise AppError("INVALID_DOCUMENT_FILE", "Khong the mo anh da tai len.", status_code=422) from exc
    else:
        raise AppError("UNSUPPORTED_DOCUMENT_TYPE", "Gemini Vision chi nhan anh hoac PDF.", status_code=422)
    tokens = _gemini_vision_ocr(path, images)
    return "\n".join(token.text for token in tokens).strip(), "GEMINI_VISION_OCR", tokens, images


def extract_document(path: Path, document_type: str) -> tuple[str, str, list[OCRToken], list[Any]]:
    """Extract DOCX/TXT natively and send all visual documents to Gemini Vision."""
    if document_type == "TXT":
        try:
            return path.read_text(encoding="utf-8"), "DIRECT_TEXT", [], []
        except UnicodeDecodeError as exc:
            raise AppError("INVALID_TEXT_FILE", "Tệp văn bản không phải UTF-8 hợp lệ.", status_code=422) from exc
    if document_type == "DOCX":
        try:
            from docx import Document as WordDocument
            document = WordDocument(path)
            parts = [p.text.strip() for p in document.paragraphs if p.text.strip()]
            for table in document.tables:
                parts.extend(" | ".join(cell.text.strip() for cell in row.cells) for row in table.rows)
            text = "\n".join(part for part in parts if part).strip()
            if not text:
                raise AppError("EMPTY_DOCUMENT", "File Word không chứa văn bản có thể trích xuất.", status_code=422)
            return text, "DOCX_NATIVE", [], []
        except AppError:
            raise
        except Exception as exc:
            raise AppError("INVALID_DOCUMENT_FILE", "Không thể đọc file Word đã tải lên.", status_code=422) from exc
    if document_type == "PDF":
        text = _pdf_native_text(path)
        if text:
            return text, "PDF_PYMUPDF_NATIVE", [], []
        return _extract_with_gemini_vision(path, document_type)
    if document_type == "IMAGE":
        return _extract_with_gemini_vision(path, document_type)
    raise AppError("UNSUPPORTED_DOCUMENT_TYPE", "Định dạng tài liệu không được hỗ trợ.", status_code=422)


async def create_processing(
    session: AsyncSession, *, course_id: str, title: str, version: str, actor_id: str,
    source_path: Path, original_filename: str | None, document_type: str,
    effective_from: date | None, effective_until: date | None,
    supersedes_document_id: str | None, confidence_threshold: float,
) -> DocumentProcessing:
    if await session.get(Course, course_id) is None:
        raise AppError("COURSE_NOT_FOUND", "Không tìm thấy học phần.", status_code=404)
    if supersedes_document_id:
        older = await session.get(Document, supersedes_document_id)
        if older is None or older.course_id != course_id:
            raise AppError("INVALID_SUPERSEDED_DOCUMENT", "Phiên bản cần thay thế không thuộc học phần này.", status_code=422)
    document_id = f"doc-{uuid.uuid4().hex[:20]}"
    processing_id = f"proc-{uuid.uuid4().hex[:20]}"
    document = Document(
        id=document_id, course_id=course_id, title=title, document_type=document_type,
        source_path=local_relative(source_path), version=version, status=DocumentStatus.PENDING,
        effective_from=effective_from, effective_until=effective_until,
        content_hash=hashlib.sha256(source_path.read_bytes()).hexdigest(),
        supersedes_document_id=supersedes_document_id,
    )
    superseded_version_id: str | None = None
    if supersedes_document_id:
        superseded_version_id = await session.scalar(
            select(PolicyVersion.id).where(PolicyVersion.document_id == supersedes_document_id)
        )
    policy_version = PolicyVersion(
        id=f"policy-version-{uuid.uuid4().hex[:18]}",
        document_id=document_id,
        course_id=course_id,
        version_label=version,
        content_hash=document.content_hash,
        effective_from=effective_from,
        effective_until=effective_until,
        status=DocumentStatus.PENDING,
        supersedes_policy_version_id=superseded_version_id,
    )
    processing = DocumentProcessing(
        id=processing_id, document_id=document_id, original_filename=original_filename,
        original_path=local_relative(source_path), extraction_method="PENDING", status="PROCESSING",
        confidence_threshold=confidence_threshold, created_by=actor_id,
    )
    session.add_all([document, processing, policy_version])
    # Persist the session before invoking a parser/OCR engine so failures stay
    # traceable instead of rolling the upload record back out of existence.
    await session.commit()
    await session.refresh(processing)
    try:
        raw_text, method, tokens, images = extract_document(source_path, document_type)
        processing.raw_text = raw_text
        processing.extraction_method = method
        processing.status = "REVIEW_REQUIRED" if tokens else "READY_TO_CONFIRM"
        words = raw_text.split()
        word_index = 0
        for item_index, token in enumerate(tokens):
            token_word_count = len(token.text.split())
            if token.confidence >= confidence_threshold:
                word_index += token_word_count
                continue
            crop_path: str | None = None
            if token.box and 0 < token.page_number <= len(images):
                x, y, w, h = token.box
                margin = 12
                image = images[token.page_number - 1]
                crop = image.crop((max(0, x - margin), max(0, y - margin), min(image.width, x + w + margin), min(image.height, y + h + margin)))
                crop_file = source_path.parent / f"review-{item_index}.png"
                crop.save(crop_file)
                crop_path = local_relative(crop_file)
            session.add(DocumentReviewItem(
                id=f"review-{uuid.uuid4().hex[:20]}", processing_id=processing.id,
                item_index=item_index, predicted_text=token.text, confidence=token.confidence,
                context_before=" ".join(words[max(0, word_index - 3):word_index]),
                context_after=" ".join(words[word_index + token_word_count:word_index + token_word_count + 3]),
                page_number=token.page_number, crop_path=crop_path, status="PENDING",
            ))
            word_index += token_word_count
        await session.commit()
        await session.refresh(processing)
        return processing
    except Exception as exc:
        await session.rollback()
        processing = await session.get(DocumentProcessing, processing_id)
        if processing:
            processing.status = "FAILED"
            processing.error_message = exc.message if isinstance(exc, AppError) else "Lỗi xử lý tài liệu không xác định."
            document = await session.get(Document, document_id)
            if document:
                document.status = DocumentStatus.FAILED
            policy_version = await session.scalar(
                select(PolicyVersion).where(PolicyVersion.document_id == document_id)
            )
            if policy_version:
                policy_version.status = DocumentStatus.FAILED
            await session.commit()
        if isinstance(exc, AppError):
            exc.details.setdefault("processing_id", processing_id)
        raise


async def processing_response(session: AsyncSession, processing: DocumentProcessing) -> ProcessingResponse:
    document = await session.get(Document, processing.document_id)
    if document is None:
        raise AppError("DOCUMENT_NOT_FOUND", "Không tìm thấy tài liệu nguồn.", status_code=404)
    from app.services.documents import document_response

    review_items = list((await session.scalars(
        select(DocumentReviewItem)
        .where(DocumentReviewItem.processing_id == processing.id)
        .order_by(DocumentReviewItem.item_index)
    )).all())
    pending = [item for item in review_items if item.status == "PENDING"]
    return ProcessingResponse(
        id=processing.id,
        document=await document_response(session, document),
        original_filename=processing.original_filename,
        original_path=processing.original_path,
        extraction_method=processing.extraction_method,
        status=processing.status,
        confidence_threshold=processing.confidence_threshold,
        raw_text=processing.raw_text,
        clean_text=processing.clean_text,
        error_message=processing.error_message,
        review_items=[ReviewItemResponse(
            id=item.id, item_index=item.item_index, predicted_text=item.predicted_text,
            confirmed_text=item.confirmed_text, confidence=item.confidence,
            context_before=item.context_before, context_after=item.context_after,
            page_number=item.page_number,
            crop_url=f"/api/v1/documents/processing/{processing.id}/review-items/{item.id}/crop" if item.crop_path else None,
            status=item.status,
        ) for item in review_items],
        pending_review_count=len(pending),
        created_at=processing.created_at,
    )


async def get_processing(session: AsyncSession, processing_id: str) -> DocumentProcessing:
    processing = await session.get(DocumentProcessing, processing_id)
    if processing is None:
        raise AppError("PROCESSING_NOT_FOUND", "Không tìm thấy phiên xử lý tài liệu.", status_code=404)
    return processing


async def update_review_item(
    session: AsyncSession, processing_id: str, review_id: str, confirmed_text: str, keep_prediction: bool,
) -> DocumentProcessing:
    processing = await get_processing(session, processing_id)
    if processing.status in {"COMPLETED", "FAILED", "DISCARDED"}:
        raise AppError("PROCESSING_CLOSED", "Phiên xử lý đã kết thúc và không thể sửa.", status_code=409)
    item = await session.get(DocumentReviewItem, review_id)
    if item is None or item.processing_id != processing.id:
        raise AppError("REVIEW_ITEM_NOT_FOUND", "Không tìm thấy mục cần rà soát.", status_code=404)
    item.confirmed_text = item.predicted_text if keep_prediction else confirmed_text.strip()
    item.status = "CONFIRMED"
    await session.commit()
    await session.refresh(processing)
    return processing


def _build_clean_text(processing: DocumentProcessing, items: list[DocumentReviewItem]) -> str:
    replacements = {
        item.item_index: item.confirmed_text if item.confirmed_text is not None else item.predicted_text
        for item in items
    }
    lines = processing.raw_text.splitlines()
    if lines:
        return "\n".join(replacements.get(index, line) for index, line in enumerate(lines)).strip()
    words = processing.raw_text.split()
    return " ".join(replacements.get(index, word) for index, word in enumerate(words)).strip()


async def discard_processing(session: AsyncSession, processing_id: str, actor_id: str) -> ProcessingResponse:
    processing = await get_processing(session, processing_id)
    if processing.status == "COMPLETED":
        raise AppError(
            "PROCESSING_ALREADY_PUBLISHED",
            "Tài liệu đã được xuất bản, không thể hủy bản nháp.",
            status_code=409,
        )
    if processing.status not in {"PROCESSING", "REVIEW_REQUIRED", "READY_TO_CONFIRM", "FAILED"}:
        raise AppError(
            "PROCESSING_CANNOT_DISCARD",
            f"Không thể hủy phiên xử lý ở trạng thái {processing.status}.",
            status_code=409,
        )
    old_status = processing.status
    processing.status = "DISCARDED"
    document = await session.get(Document, processing.document_id)
    if document:
        document.status = DocumentStatus.DISCARDED
    policy_version = await session.scalar(
        select(PolicyVersion).where(PolicyVersion.document_id == processing.document_id)
    )
    if policy_version:
        policy_version.status = "DISCARDED"

    from app.services.audit import add_audit_event
    add_audit_event(
        session,
        event_type="POLICY_DRAFT_DISCARDED",
        actor_id=actor_id,
        entity_type="document_processing",
        entity_id=processing.id,
        input_snapshot={"document_id": processing.document_id, "previous_status": old_status},
        output_snapshot={"status": "DISCARDED"},
    )
    await session.commit()
    await session.refresh(processing)
    return await processing_response(session, processing)


def _extract_snippet(base_text: str, new_text: str, window_chars: int = 300) -> str:
    """Extract a representative snippet around the dense overlapping area (±300 chars)."""
    if len(base_text) <= window_chars:
        return base_text
    common_tokens = policy_match_tokens(new_text) & policy_match_tokens(base_text)
    if not common_tokens:
        return base_text[:window_chars] + "..."

    normalized_base = unicodedata.normalize("NFD", base_text.casefold())
    normalized_base = "".join(c for c in normalized_base if unicodedata.category(c) != "Mn").replace("đ", "d")
    matches = [m.start() for m in re.finditer(r"[a-z0-9]+", normalized_base) if m.group(0) in common_tokens]
    if not matches:
        return base_text[:window_chars] + "..."

    half_win = window_chars // 2
    best_center = matches[0]
    best_count = 0
    for pos in matches:
        count = sum(1 for m in matches if abs(m - pos) <= half_win)
        if count > best_count:
            best_count = count
            best_center = pos

    start = max(0, best_center - half_win)
    end = min(len(base_text), best_center + half_win)

    if start > 0:
        prev_space = base_text.rfind(" ", max(0, start - 30), start)
        if prev_space != -1:
            start = prev_space + 1
    if end < len(base_text):
        next_space = base_text.find(" ", end, min(len(base_text), end + 30))
        if next_space != -1:
            end = next_space

    prefix = "..." if start > 0 else ""
    suffix = "..." if end < len(base_text) else ""
    return prefix + base_text[start:end].strip() + suffix


async def _detect_conflicts(
    session: AsyncSession, processing: DocumentProcessing, clean_text: str
) -> list[ConflictItem]:
    from app.ingestion.chunking import chunk_text
    chunks = chunk_text(clean_text)
    if not chunks:
        return []
    document = await session.get(Document, processing.document_id)
    if document is None:
        raise AppError("DOCUMENT_NOT_FOUND", "Không tìm thấy tài liệu nguồn.", status_code=404)

    # 1. Tier 1: Existing Active Policy Updates
    existing_updates = list((await session.scalars(
        select(PolicyUpdate)
        .where(
            PolicyUpdate.course_id == document.course_id,
            PolicyUpdate.scope_type == "COURSE",
            PolicyUpdate.scope_id == document.course_id,
            PolicyUpdate.status == PolicyUpdateStatus.ACTIVE,
        )
        .order_by(PolicyUpdate.published_at.desc(), PolicyUpdate.created_at.desc())
    )).all())

    doc_ids = {u.source_document_id for u in existing_updates if u.source_document_id}

    # 2. Tier 2: Base Document Chunks (Quy chế gốc)
    base_docs = list((await session.scalars(
        select(Document).where(
            Document.course_id == document.course_id,
            Document.status == DocumentStatus.ACTIVE,
            Document.id != document.id,
        )
    )).all())
    base_doc_ids = [d.id for d in base_docs]
    doc_ids.update(base_doc_ids)

    doc_titles: dict[str, str] = {}
    if doc_ids:
        docs = (await session.scalars(select(Document).where(Document.id.in_(doc_ids)))).all()
        doc_titles = {d.id: d.title for d in docs}

    base_chunks: list[DocumentChunk] = []
    if base_doc_ids:
        all_chunks = list((await session.scalars(
            select(DocumentChunk).where(DocumentChunk.document_id.in_(base_doc_ids))
        )).all())
        base_chunks = [
            c for c in all_chunks
            if not c.chunk_metadata or c.chunk_metadata.get("source_kind") != "POLICY_UPDATE"
        ]

    conflicts: list[ConflictItem] = []
    for new_chunk_index, chunk in enumerate(chunks):
        topic = infer_policy_topic(chunk.content)
        existing_items: list[ExistingConflictItem] = []

        # (a) Check updates tier
        for old in existing_updates:
            if old.policy_topic != topic:
                continue
            if topic == "GENERAL":
                overlap = policy_token_overlap(chunk.content, old.content)
                if overlap < 0.5:
                    continue
            existing_items.append(
                ExistingConflictItem(
                    policy_update_id=old.id,
                    content=old.content,
                    source_document_title=doc_titles.get(old.source_document_id) or "Bản cập nhật",
                    published_at=old.published_at,
                    source_kind="POLICY_UPDATE",
                    chunk_id=old.source_chunk_id,
                    document_id=old.source_document_id,
                )
            )

        # (b) Check base documents tier
        matched_base: list[tuple[float, DocumentChunk]] = []
        for base_chunk in base_chunks:
            overlap = policy_token_overlap(chunk.content, base_chunk.content)
            if topic != "GENERAL":
                topics_in_base = policy_topics_in_text(base_chunk.content)
                if topic in topics_in_base and overlap >= 0.2:
                    matched_base.append((overlap, base_chunk))
            else:
                if overlap >= 0.5:
                    matched_base.append((overlap, base_chunk))

        # Take at most 2 best matching base chunks (sorted by overlap descending)
        matched_base.sort(key=lambda x: x[0], reverse=True)
        for _, b_chunk in matched_base[:2]:
            existing_items.append(
                ExistingConflictItem(
                    policy_update_id=None,
                    content=_extract_snippet(b_chunk.content, chunk.content),
                    source_document_title=doc_titles.get(b_chunk.document_id) or "Quy chế gốc",
                    published_at=None,
                    source_kind="BASE_DOCUMENT",
                    chunk_id=b_chunk.id,
                    document_id=b_chunk.document_id,
                )
            )

        if existing_items:
            conflicts.append(
                ConflictItem(
                    new_chunk_index=new_chunk_index,
                    new_content=chunk.content,
                    policy_topic=topic,
                    existing=existing_items,
                )
            )

    return conflicts


async def detect_conflicts(session: AsyncSession, processing_id: str) -> list[ConflictItem]:
    processing = await get_processing(session, processing_id)
    if processing.status in {"COMPLETED", "DISCARDED"}:
        raise AppError("PROCESSING_CLOSED", "Phiên xử lý đã kết thúc hoặc bị hủy.", status_code=409)
    if processing.status == "FAILED":
        raise AppError("PROCESSING_FAILED", processing.error_message or "Phiên xử lý đã thất bại.", status_code=422)
    items = list((await session.scalars(
        select(DocumentReviewItem)
        .where(DocumentReviewItem.processing_id == processing.id)
        .order_by(DocumentReviewItem.item_index)
    )).all())
    if any(item.status == "PENDING" for item in items):
        raise AppError("REVIEW_REQUIRED", "Hãy xác nhận tất cả nội dung được đánh dấu Cần rà soát trước khi kiểm tra xung đột.", status_code=422)
    clean_text = _build_clean_text(processing, items)
    if not clean_text:
        return []
    return await _detect_conflicts(session, processing, clean_text)


async def _publish_policy_update(
    session: AsyncSession,
    *,
    processing: DocumentProcessing,
    document: Document,
    conflicts: list[ConflictItem],
    resolutions_map: dict[int, str],
) -> tuple[list[PolicyUpdate], FinalizeSummaryResponse]:
    from app.services.audit import add_audit_event

    chunks = list((await session.scalars(
        select(DocumentChunk)
        .where(DocumentChunk.document_id == document.id)
        .order_by(DocumentChunk.chunk_index)
    )).all())
    if not chunks:
        raise AppError(
            "POLICY_UPDATE_CHUNKS_MISSING",
            "Không thể tạo lớp cập nhật vì tài liệu chưa có đoạn chỉ mục.",
            status_code=422,
        )
    published_at = datetime.now(UTC)
    updates: list[PolicyUpdate] = []
    conflict_by_index = {c.new_chunk_index: c for c in conflicts}
    added_count = 0
    replaced_count = 0
    skipped_count = 0

    for chunk in chunks:
        chunk.chunk_metadata = {
            **(chunk.chunk_metadata or {}),
            "retrieval_eligible": False,
            "source_kind": "POLICY_UPDATE",
        }
        topic = infer_policy_topic(chunk.content)
        conflict = conflict_by_index.get(chunk.chunk_index)
        action = resolutions_map.get(chunk.chunk_index) if conflict else "ADD"

        has_policy_update_conflicts = (
            conflict is not None and any(e.source_kind == "POLICY_UPDATE" for e in conflict.existing)
        )
        base_chunk_ids = (
            [e.chunk_id for e in conflict.existing if e.source_kind == "BASE_DOCUMENT" and e.chunk_id]
            if conflict
            else []
        )
        existing_update_ids = (
            [e.policy_update_id for e in conflict.existing if e.source_kind == "POLICY_UPDATE" and e.policy_update_id]
            if conflict
            else []
        )

        # KEEP_BOTH does not apply to base tier conflicts: if received KEEP_BOTH for a chunk that only conflicted with base tier -> treat as REPLACE
        if action == "KEEP_BOTH" and not has_policy_update_conflicts:
            action = "REPLACE"

        if action == "KEEP_OLD":
            skipped_count += 1
            add_audit_event(
                session,
                event_type="POLICY_CONFLICT_RESOLVED",
                actor_id=processing.created_by,
                entity_type="document_chunk",
                entity_id=chunk.id,
                input_snapshot={"action": "KEEP_OLD", "policy_topic": topic, "chunk_index": chunk.chunk_index},
                output_snapshot={"status": "OMITTED"},
            )
            continue

        if action == "REPLACE":
            replaced_count += 1
            supersedes_id = None
            if existing_update_ids:
                existing_records = list((await session.scalars(
                    select(PolicyUpdate).where(PolicyUpdate.id.in_(existing_update_ids))
                )).all())
                for old_rec in existing_records:
                    old_rec.status = PolicyUpdateStatus.SUPERSEDED

                newest_old = max(
                    existing_records,
                    key=lambda x: (x.published_at or datetime.min.replace(tzinfo=UTC), x.created_at),
                ) if existing_records else None
                supersedes_id = newest_old.id if newest_old else None

            update = PolicyUpdate(
                id=f"policy-update-{uuid.uuid4().hex[:18]}",
                source_document_id=document.id,
                source_chunk_id=chunk.id,
                course_id=document.course_id,
                scope_type="COURSE",
                scope_id=document.course_id,
                policy_topic=topic,
                operation="REPLACE",
                content=chunk.content,
                valid_from=date.today(),
                valid_until=None,
                status=PolicyUpdateStatus.ACTIVE,
                supersedes_policy_update_id=supersedes_id,
                created_by=processing.created_by,
                published_at=published_at,
            )
            session.add(update)
            updates.append(update)
            add_audit_event(
                session,
                event_type="POLICY_CONFLICT_RESOLVED",
                actor_id=processing.created_by,
                entity_type="policy_update",
                entity_id=update.id,
                input_snapshot={
                    "action": "REPLACE",
                    "policy_topic": topic,
                    "superseded_policy_update_ids": existing_update_ids,
                    "base_chunk_ids": base_chunk_ids,
                    "chunk_index": chunk.chunk_index,
                },
                output_snapshot={"status": "ACTIVE", "supersedes_policy_update_id": supersedes_id},
            )
        else:
            added_count += 1
            update = PolicyUpdate(
                id=f"policy-update-{uuid.uuid4().hex[:18]}",
                source_document_id=document.id,
                source_chunk_id=chunk.id,
                course_id=document.course_id,
                scope_type="COURSE",
                scope_id=document.course_id,
                policy_topic=topic,
                operation="ADD",
                content=chunk.content,
                valid_from=date.today(),
                valid_until=None,
                status=PolicyUpdateStatus.ACTIVE,
                supersedes_policy_update_id=None,
                created_by=processing.created_by,
                published_at=published_at,
            )
            session.add(update)
            updates.append(update)
            if conflict and action == "KEEP_BOTH":
                add_audit_event(
                    session,
                    event_type="POLICY_CONFLICT_RESOLVED",
                    actor_id=processing.created_by,
                    entity_type="policy_update",
                    entity_id=update.id,
                    input_snapshot={"action": "KEEP_BOTH", "policy_topic": topic, "chunk_index": chunk.chunk_index},
                    output_snapshot={"status": "ACTIVE"},
                )

    add_audit_event(
        session,
        event_type="POLICY_UPDATE_SAVED",
        actor_id=processing.created_by,
        entity_type="document_processing",
        entity_id=processing.id,
        input_snapshot={"document_id": document.id, "mode": "AUTOMATIC_CHUNK_LAYER"},
        output_snapshot={"policy_update_count": len(updates), "status": "ACTIVE"},
    )
    summary = FinalizeSummaryResponse(
        added_count=added_count,
        replaced_count=replaced_count,
        skipped_count=skipped_count,
    )
    return updates, summary


async def finalize_processing(
    session: AsyncSession,
    processing_id: str,
    provider,
    payload: FinalizePayload | None = None,
) -> ProcessingResponse:
    processing = await get_processing(session, processing_id)
    if processing.status == "DISCARDED":
        raise AppError("PROCESSING_DISCARDED", "Phiên xử lý đã bị hủy và không thể xuất bản.", status_code=409)
    if processing.status == "COMPLETED":
        return await processing_response(session, processing)
    if processing.status == "FAILED":
        raise AppError("PROCESSING_FAILED", processing.error_message or "Phiên xử lý đã thất bại.", status_code=422)
    items = list((await session.scalars(
        select(DocumentReviewItem)
        .where(DocumentReviewItem.processing_id == processing.id)
        .order_by(DocumentReviewItem.item_index)
    )).all())
    if any(item.status == "PENDING" for item in items):
        raise AppError("REVIEW_REQUIRED", "Hãy xác nhận tất cả nội dung được đánh dấu Cần rà soát trước khi xuất bản.", status_code=422)

    clean_text = _build_clean_text(processing, items)
    if not clean_text:
        raise AppError("EMPTY_DOCUMENT", "Văn bản sạch không được để trống.", status_code=422)

    conflicts = await _detect_conflicts(session, processing, clean_text)
    resolutions_map: dict[int, str] = {}
    if payload and payload.resolutions:
        resolutions_map = {r.new_chunk_index: r.action for r in payload.resolutions}
    if conflicts:
        missing = [c.new_chunk_index for c in conflicts if c.new_chunk_index not in resolutions_map]
        if missing:
            raise AppError(
                "CONFLICT_RESOLUTION_REQUIRED",
                "Cần chọn phương án xử lý cho tất cả các đoạn có xung đột.",
                status_code=422,
                details={"missing_chunk_indices": missing},
            )

    document = await session.get(Document, processing.document_id)
    if document is None:
        raise AppError("DOCUMENT_NOT_FOUND", "Không tìm thấy tài liệu nguồn.", status_code=404)
    original = local_absolute(processing.original_path or document.source_path)
    clean_path = original.parent / "clean.txt"
    json_path = original.parent / "clean.json"
    clean_path.write_text(clean_text, encoding="utf-8")
    json_path.write_text(
        json.dumps({"document_id": document.id, "processing_id": processing.id, "text": clean_text}, ensure_ascii=False),
        encoding="utf-8",
    )
    document.source_path = local_relative(clean_path)
    document.document_type = "TXT"
    document.content_hash = hashlib.sha256(clean_text.encode("utf-8")).hexdigest()
    processing.clean_text = clean_text
    processing.status = "INGESTING"
    await session.commit()

    from app.ingestion.service import ingest_document
    try:
        await ingest_document(session, document.id, provider=provider)
    except Exception as exc:
        processing = await get_processing(session, processing_id)
        processing.status = "FAILED"
        processing.error_message = exc.message if isinstance(exc, AppError) else "Không thể lập chỉ mục văn bản."
        policy_version = await session.scalar(
            select(PolicyVersion).where(PolicyVersion.document_id == document.id)
        )
        if policy_version:
            policy_version.status = DocumentStatus.FAILED
        await session.commit()
        raise

    updates, summary = await _publish_policy_update(
        session,
        processing=processing,
        document=document,
        conflicts=conflicts,
        resolutions_map=resolutions_map,
    )
    policy_version = await session.scalar(
        select(PolicyVersion).where(PolicyVersion.document_id == document.id)
    )
    now = datetime.now(UTC)
    if policy_version:
        policy_version.status = DocumentStatus.ACTIVE
        policy_version.content_hash = document.content_hash
        policy_version.activated_at = now
    if document.supersedes_document_id:
        older = await session.get(Document, document.supersedes_document_id)
        if older:
            older.status = DocumentStatus.SUPERSEDED
        older_version = await session.scalar(
            select(PolicyVersion).where(PolicyVersion.document_id == document.supersedes_document_id)
        )
        if older_version:
            older_version.status = DocumentStatus.SUPERSEDED
            older_version.superseded_at = now
    processing = await get_processing(session, processing_id)
    processing.status = "COMPLETED"
    await session.commit()
    await session.refresh(processing)
    resp = await processing_response(session, processing)
    resp.finalize_summary = summary
    return resp
