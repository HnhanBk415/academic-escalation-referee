"""Offline document extraction and human-review workflow.

All adapters in this module execute on the host.  OCR uses a locally installed
Tesseract binary with Vietnamese language data; imports are intentionally lazy
so a deployment that only accepts DOCX/TXT does not require OCR packages.
"""

import hashlib
import json
import re
import shutil
import uuid
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.enums import DocumentStatus
from app.core.errors import AppError
from app.models import Course, Document, DocumentProcessing, DocumentReviewItem
from app.schemas.documents import DocumentResponse, ProcessingResponse, ReviewItemResponse

SUPPORTED_SUFFIXES = {".pdf": "PDF", ".docx": "DOCX", ".png": "IMAGE", ".jpg": "IMAGE", ".jpeg": "IMAGE"}


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


def _require_tesseract() -> None:
    command = get_settings().ocr_tesseract_cmd
    if not Path(command).is_file() and shutil.which(command) is None:
        raise AppError(
            "LOCAL_OCR_UNAVAILABLE",
            "Không tìm thấy Tesseract Local. Cài Tesseract và bộ ngôn ngữ vie, hoặc nhập văn bản thủ công.",
            status_code=422,
        )


def _ocr_image(image: Any, page_number: int) -> list[OCRToken]:
    _require_tesseract()
    try:
        import pytesseract
        from pytesseract import Output

        pytesseract.pytesseract.tesseract_cmd = get_settings().ocr_tesseract_cmd
        data = pytesseract.image_to_data(
            image, lang=get_settings().ocr_languages, output_type=Output.DICT
        )
    except Exception as exc:
        raise AppError(
            "LOCAL_OCR_FAILED",
            "OCR Local không thể nhận diện tài liệu. Hãy kiểm tra Tesseract, dữ liệu ngôn ngữ vie và chất lượng ảnh.",
            status_code=422,
        ) from exc
    tokens: list[OCRToken] = []
    for index, raw_text in enumerate(data["text"]):
        text = (raw_text or "").strip()
        if not text:
            continue
        try:
            confidence = max(0.0, min(1.0, float(data["conf"][index]) / 100))
        except (TypeError, ValueError):
            confidence = 0.0
        tokens.append(
            OCRToken(
                text=text,
                confidence=confidence,
                page_number=page_number,
                box=(
                    int(data["left"][index]), int(data["top"][index]),
                    int(data["width"][index]), int(data["height"][index]),
                ),
            )
        )
    return tokens


def _pdf_images(path: Path) -> list[Any]:
    try:
        from PIL import Image
    except ImportError as exc:
        raise AppError("LOCAL_OCR_UNAVAILABLE", "Thiếu thư viện xử lý ảnh Local (Pillow).", status_code=422) from exc
    try:
        import fitz
    except ImportError as exc:
        raise AppError("LOCAL_OCR_UNAVAILABLE", "Thiếu thư viện render PDF Local (PyMuPDF).", status_code=422) from exc
    try:
        pdf = fitz.open(path)
        return [Image.frombytes("RGB", (pix.width, pix.height), pix.samples) for page in pdf for pix in [page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)]]
    except Exception as exc:
        raise AppError("INVALID_DOCUMENT_FILE", "Không thể mở hoặc render PDF đã tải lên.", status_code=422) from exc


def extract_locally(path: Path, document_type: str) -> tuple[str, str, list[OCRToken], list[Any]]:
    """Return raw text, extractor label, OCR tokens and OCR page images."""
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
        from pypdf import PdfReader
        try:
            text = "\n".join(page.extract_text() or "" for page in PdfReader(path).pages).strip()
        except Exception as exc:
            raise AppError("INVALID_DOCUMENT_FILE", "Không thể đọc PDF đã tải lên.", status_code=422) from exc
        # Native PDF text is safer and more accurate.  OCR is only used for scans.
        if text:
            return text, "PDF_NATIVE", [], []
        images = _pdf_images(path)
    elif document_type == "IMAGE":
        try:
            from PIL import Image
            images = [Image.open(path).convert("RGB")]
        except Exception as exc:
            raise AppError("INVALID_DOCUMENT_FILE", "Không thể mở ảnh đã tải lên.", status_code=422) from exc
    else:
        raise AppError("UNSUPPORTED_DOCUMENT_TYPE", "Định dạng tài liệu không được hỗ trợ.", status_code=422)
    tokens = [token for page, image in enumerate(images, start=1) for token in _ocr_image(image, page)]
    text = " ".join(token.text for token in tokens).strip()
    if not text:
        raise AppError("OCR_EMPTY_RESULT", "OCR không nhận diện được văn bản. Vui lòng dùng ảnh rõ hơn hoặc nhập thủ công.", status_code=422)
    return text, "LOCAL_TESSERACT_OCR", tokens, images


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
    processing = DocumentProcessing(
        id=processing_id, document_id=document_id, original_filename=original_filename,
        original_path=local_relative(source_path), extraction_method="PENDING", status="PROCESSING",
        confidence_threshold=confidence_threshold, created_by=actor_id,
    )
    session.add_all([document, processing])
    # Persist the session before invoking a parser/OCR engine so failures stay
    # traceable instead of rolling the upload record back out of existence.
    await session.commit()
    await session.refresh(processing)
    try:
        raw_text, method, tokens, images = extract_locally(source_path, document_type)
        processing.raw_text = raw_text
        processing.extraction_method = method
        processing.status = "REVIEW_REQUIRED" if tokens else "READY_TO_CONFIRM"
        words = raw_text.split()
        for item_index, token in enumerate(tokens):
            if token.confidence >= confidence_threshold:
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
            # `raw_text` is assembled from this token stream, so the token
            # ordinal is the stable context/replacement position even when a
            # word appears more than once.
            word_index = item_index
            session.add(DocumentReviewItem(
                id=f"review-{uuid.uuid4().hex[:20]}", processing_id=processing.id,
                item_index=item_index, predicted_text=token.text, confidence=token.confidence,
                context_before=" ".join(words[max(0, word_index - 3):word_index]),
                context_after=" ".join(words[word_index + 1:word_index + 4]),
                page_number=token.page_number, crop_path=crop_path, status="PENDING",
            ))
        await session.commit()
        await session.refresh(processing)
        return processing
    except Exception as exc:
        await session.rollback()
        processing = await session.get(DocumentProcessing, processing_id)
        if processing:
            processing.status = "FAILED"
            processing.error_message = exc.message if isinstance(exc, AppError) else "Lỗi xử lý Local không xác định."
            document = await session.get(Document, document_id)
            if document:
                document.status = DocumentStatus.FAILED
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

    words = processing.raw_text.split()
    replacements = {
        item.item_index: item.confirmed_text if item.confirmed_text is not None else item.predicted_text
        for item in items
    }
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
    # A document submitted through this workflow is a new regulation version.
    # It retires any older version with the same course/title, including records
    # imported before this module existed. Explicit lineage is preserved as well.
    processing.clean_text = clean_text
    processing.status = "INGESTING"
    await session.commit()

    from app.ingestion.service import ingest_document
    try:
        await ingest_document(session, document.id, provider=provider)
    except Exception as exc:
        processing = await get_processing(session, processing_id)
        processing.status = "FAILED"
        processing.error_message = exc.message if isinstance(exc, AppError) else "Không thể lập chỉ mục văn bản Local."
        await session.commit()
        raise
    # Do not retire an older regulation until the newer one has been indexed
    # successfully.  This preserves a usable answer source if indexing fails.
    older_documents = list((await session.scalars(
        select(Document).where(
            Document.course_id == document.course_id,
            Document.title == document.title,
            Document.id != document.id,
            Document.status == DocumentStatus.ACTIVE,
        )
    )).all())
    for older in older_documents:
        older.status = DocumentStatus.SUPERSEDED
    if document.supersedes_document_id:
        older = await session.get(Document, document.supersedes_document_id)
        if older:
            older.status = DocumentStatus.SUPERSEDED
    processing = await get_processing(session, processing_id)
    processing.status = "COMPLETED"
    await session.commit()
    await session.refresh(processing)
    return await processing_response(session, processing)
