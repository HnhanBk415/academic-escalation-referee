"""Gemini Vision document extraction and human-review workflow."""

import hashlib
import json
import mimetypes
import re
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
from app.core.policy_topics import canonical_policy_topic, infer_policy_topic
from app.models import (
    Course,
    Document,
    DocumentChunk,
    DocumentProcessing,
    DocumentReviewItem,
    PolicyUpdate,
    PolicyVersion,
)
from app.schemas.documents import DocumentResponse, ProcessingResponse, ReviewItemResponse

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
    if processing.status in {"COMPLETED", "FAILED"}:
        raise AppError("PROCESSING_CLOSED", "Phiên xử lý đã kết thúc và không thể sửa.", status_code=409)
    item = await session.get(DocumentReviewItem, review_id)
    if item is None or item.processing_id != processing.id:
        raise AppError("REVIEW_ITEM_NOT_FOUND", "Không tìm thấy mục cần rà soát.", status_code=404)
    item.confirmed_text = item.predicted_text if keep_prediction else confirmed_text.strip()
    item.status = "CONFIRMED"
    await session.commit()
    await session.refresh(processing)
    return processing


async def _legacy_publish_policy_update(
    session: AsyncSession, *, processing: DocumentProcessing, document: Document, publication: dict,
) -> PolicyUpdate:
    operation = publication["operation"]
    scope_type = publication["scope_type"]
    scope_id = publication.get("scope_id") or (document.course_id if scope_type == "COURSE" else None)
    if not scope_id:
        raise AppError("UPDATE_SCOPE_REQUIRED", "Cần chọn đối tượng áp dụng cho cập nhật quy định.", status_code=422)
    if scope_type == "COURSE" and scope_id != document.course_id:
        raise AppError("UPDATE_SCOPE_INVALID", "Phạm vi COURSE phải trùng với học phần của tài liệu.", status_code=422)
    target_id = publication.get("supersedes_policy_update_id")
    target = await session.get(PolicyUpdate, target_id) if target_id else None
    if target and target.course_id != document.course_id:
        raise AppError("UPDATE_TARGET_INVALID", "Bản cập nhật được chọn không thuộc học phần này.", status_code=422)
    if operation == "REVOKE" and target is None:
        raise AppError("UPDATE_TARGET_REQUIRED", "Thu hồi cần chọn bản cập nhật cần thu hồi.", status_code=422)
    source_chunk = await session.scalar(
        select(DocumentChunk)
        .where(DocumentChunk.document_id == document.id)
        .order_by(DocumentChunk.chunk_index)
    )
    if operation == "REPLACE":
        targets = [target] if target else list((await session.scalars(
            select(PolicyUpdate).where(
                PolicyUpdate.course_id == document.course_id,
                PolicyUpdate.scope_type == scope_type,
                PolicyUpdate.scope_id == scope_id,
                PolicyUpdate.policy_topic == canonical_policy_topic(publication["policy_topic"]),
                PolicyUpdate.status == PolicyUpdateStatus.ACTIVE,
            )
        )).all())
        for item in targets:
            if item:
                item.status = PolicyUpdateStatus.SUPERSEDED
    elif operation == "REVOKE" and target:
        target.status = PolicyUpdateStatus.REVOKED

    update = PolicyUpdate(
        id=f"policy-update-{uuid.uuid4().hex[:18]}",
        source_document_id=document.id,
        source_chunk_id=source_chunk.id if source_chunk else None,
        course_id=document.course_id,
        scope_type=scope_type,
        scope_id=scope_id,
        policy_topic=canonical_policy_topic(publication["policy_topic"]),
        operation=operation,
        content=processing.clean_text or processing.raw_text,
        valid_from=publication.get("valid_from") or date.today(),
        valid_until=publication.get("valid_until"),
        status=PolicyUpdateStatus.REVOKED if operation == "REVOKE" else PolicyUpdateStatus.ACTIVE,
        supersedes_policy_update_id=target.id if target else None,
        created_by=processing.created_by,
        published_at=datetime.now(UTC),
    )
    session.add(update)
    from app.services.audit import add_audit_event
    add_audit_event(
        session,
        event_type="POLICY_UPDATE_PUBLISHED",
        actor_id=processing.created_by,
        entity_type="policy_update",
        entity_id=update.id,
        input_snapshot={
            "operation": operation,
            "policy_topic": update.policy_topic,
            "scope_type": scope_type,
            "scope_id": scope_id,
            "supersedes_policy_update_id": update.supersedes_policy_update_id,
        },
        output_snapshot={"status": update.status, "source_document_id": document.id},
    )
    return update


async def _publish_policy_update(
    session: AsyncSession, *, processing: DocumentProcessing, document: Document,
) -> list[PolicyUpdate]:
    """Save each indexed chunk as a course-level update layer.

    The lecturer's confirmation is the only publication action. Topic and
    relevance are inferred from each chunk later while answering, so a file
    name neither grants nor removes priority.
    """
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
    for chunk in chunks:
        chunk.chunk_metadata = {
            **(chunk.chunk_metadata or {}),
            "retrieval_eligible": False,
            "source_kind": "POLICY_UPDATE",
        }
        update = PolicyUpdate(
            id=f"policy-update-{uuid.uuid4().hex[:18]}",
            source_document_id=document.id,
            source_chunk_id=chunk.id,
            course_id=document.course_id,
            scope_type="COURSE",
            scope_id=document.course_id,
            policy_topic=infer_policy_topic(chunk.content),
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
    from app.services.audit import add_audit_event
    add_audit_event(
        session,
        event_type="POLICY_UPDATE_SAVED",
        actor_id=processing.created_by,
        entity_type="document_processing",
        entity_id=processing.id,
        input_snapshot={"document_id": document.id, "mode": "AUTOMATIC_CHUNK_LAYER"},
        output_snapshot={"policy_update_count": len(updates), "status": "ACTIVE"},
    )
    return updates


async def finalize_processing(session: AsyncSession, processing_id: str, provider) -> ProcessingResponse:
    processing = await get_processing(session, processing_id)
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

    replacements = {
        item.item_index: item.confirmed_text if item.confirmed_text is not None else item.predicted_text
        for item in items
    }
    lines = processing.raw_text.splitlines()
    if lines:
        clean_text = "\n".join(replacements.get(index, line) for index, line in enumerate(lines)).strip()
    else:
        words = processing.raw_text.split()
        clean_text = " ".join(replacements.get(index, word) for index, word in enumerate(words)).strip()
    if not clean_text:
        raise AppError("EMPTY_DOCUMENT", "Văn bản sạch không được để trống.", status_code=422)
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
    await _publish_policy_update(session, processing=processing, document=document)
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
    return await processing_response(session, processing)
