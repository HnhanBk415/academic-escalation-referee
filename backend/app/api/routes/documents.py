from typing import Annotated

from datetime import date
from pathlib import Path
import uuid

from fastapi import APIRouter, Depends, File, Form, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.base import AIProvider
from app.api.deps import get_ai_provider, get_current_actor
from app.core.auth import CurrentActor, require_role
from app.core.enums import ActorRole
from app.db.session import get_session
from app.ingestion.local_processing import (
    SUPPORTED_SUFFIXES,
    _root,
    create_processing,
    finalize_processing,
    get_processing,
    local_absolute,
    processing_response,
    safe_filename,
    update_review_item,
)
from app.ingestion.service import ingest_document
from app.schemas.documents import (
    DocumentCreate, DocumentResponse, IngestResponse, ProcessingCreate,
    ProcessingResponse, ReviewItemUpdate,
)
from app.services.documents import (
    get_document_response,
    list_documents_response,
    register_document,
)

router = APIRouter()
SessionDependency = Annotated[AsyncSession, Depends(get_session)]
ProviderDependency = Annotated[AIProvider, Depends(get_ai_provider)]


@router.get("", response_model=list[DocumentResponse])
async def list_documents(
    session: SessionDependency,
    course_id: str | None = None,
    current: CurrentActor = Depends(get_current_actor),
) -> list[DocumentResponse]:
    return await list_documents_response(session, course_id=course_id)


@router.post("/sync", response_model=list[IngestResponse])
async def sync_documents(
    session: SessionDependency,
    provider: ProviderDependency,
    current: CurrentActor = Depends(get_current_actor),
) -> list[IngestResponse]:
    require_role(current, ActorRole.LECTURER, ActorRole.ACADEMIC_AFFAIRS)
    from app.ingestion.service import scan_and_sync_documents
    return await scan_and_sync_documents(session, provider=provider)


@router.post("", response_model=DocumentResponse, status_code=201)
async def create_document(
    payload: DocumentCreate,
    session: SessionDependency,
    current: CurrentActor = Depends(get_current_actor),
) -> DocumentResponse:
    require_role(current, ActorRole.LECTURER, ActorRole.ACADEMIC_AFFAIRS)
    return await register_document(session, payload)


@router.post("/{document_id}/ingest", response_model=IngestResponse)
async def ingest(
    document_id: str,
    session: SessionDependency,
    provider: ProviderDependency,
    current: CurrentActor = Depends(get_current_actor),
) -> IngestResponse:
    require_role(current, ActorRole.LECTURER, ActorRole.ACADEMIC_AFFAIRS)
    return await ingest_document(session, document_id, provider=provider)


def _store_upload(filename: str, content: bytes) -> Path:
    if not content:
        raise ValueError("empty upload")
    folder = _root() / f"upload-{uuid.uuid4().hex}"
    folder.mkdir(parents=True, exist_ok=False)
    path = folder / safe_filename(filename)
    path.write_bytes(content)
    return path


@router.post("/processing/text", response_model=ProcessingResponse, status_code=201)
async def process_direct_text(
    payload: ProcessingCreate,
    session: SessionDependency,
    current: CurrentActor = Depends(get_current_actor),
) -> ProcessingResponse:
    """Create a fully local processing session from lecturer-entered text."""
    require_role(current, ActorRole.LECTURER, ActorRole.ACADEMIC_AFFAIRS)
    folder = _root() / f"entry-{uuid.uuid4().hex}"
    folder.mkdir(parents=True, exist_ok=False)
    path = folder / "entered-text.txt"
    path.write_text(payload.text_content, encoding="utf-8")
    processing = await create_processing(
        session, course_id=payload.course_id, title=payload.title, version=payload.version,
        actor_id=current.id, source_path=path, original_filename=None, document_type="TXT",
        effective_from=payload.effective_from, effective_until=payload.effective_until,
        supersedes_document_id=payload.supersedes_document_id,
        confidence_threshold=payload.confidence_threshold,
    )
    return await processing_response(session, processing)


@router.post("/processing/upload", response_model=ProcessingResponse, status_code=201)
async def process_upload(
    session: SessionDependency,
    current: CurrentActor = Depends(get_current_actor),
    file: UploadFile = File(...),
    course_id: str = Form(...),
    title: str = Form(...),
    version: str = Form(...),
    effective_from: date | None = Form(None),
    effective_until: date | None = Form(None),
    supersedes_document_id: str | None = Form(None),
    confidence_threshold: float = Form(0.80),
) -> ProcessingResponse:
    require_role(current, ActorRole.LECTURER, ActorRole.ACADEMIC_AFFAIRS)
    filename = file.filename or "document"
    suffix = Path(filename).suffix.lower()
    document_type = SUPPORTED_SUFFIXES.get(suffix)
    if document_type is None:
        from app.core.errors import AppError
        raise AppError("UNSUPPORTED_DOCUMENT_TYPE", "Chỉ nhận PDF, DOCX, PNG, JPG hoặc JPEG.", status_code=422)
    content = await file.read()
    from app.core.config import get_settings
    from app.core.errors import AppError
    if len(content) > get_settings().upload_max_bytes:
        raise AppError("UPLOAD_TOO_LARGE", "Tệp vượt quá giới hạn upload Local.", status_code=413)
    if not 0 <= confidence_threshold <= 1:
        raise AppError("INVALID_CONFIDENCE_THRESHOLD", "Ngưỡng tin cậy phải nằm trong khoảng 0 đến 1.", status_code=422)
    try:
        path = _store_upload(filename, content)
    except ValueError as exc:
        raise AppError("EMPTY_UPLOAD", "Tệp tải lên đang trống.", status_code=422) from exc
    processing = await create_processing(
        session, course_id=course_id, title=title, version=version, actor_id=current.id,
        source_path=path, original_filename=filename, document_type=document_type,
        effective_from=effective_from, effective_until=effective_until,
        supersedes_document_id=supersedes_document_id, confidence_threshold=confidence_threshold,
    )
    return await processing_response(session, processing)


@router.get("/processing/{processing_id}", response_model=ProcessingResponse)
async def processing_detail(
    processing_id: str, session: SessionDependency,
    current: CurrentActor = Depends(get_current_actor),
) -> ProcessingResponse:
    require_role(current, ActorRole.LECTURER, ActorRole.ACADEMIC_AFFAIRS)
    return await processing_response(session, await get_processing(session, processing_id))


@router.patch("/processing/{processing_id}/review-items/{review_id}", response_model=ProcessingResponse)
async def confirm_review_item(
    processing_id: str, review_id: str, payload: ReviewItemUpdate, session: SessionDependency,
    current: CurrentActor = Depends(get_current_actor),
) -> ProcessingResponse:
    require_role(current, ActorRole.LECTURER, ActorRole.ACADEMIC_AFFAIRS)
    processing = await update_review_item(
        session, processing_id, review_id, payload.confirmed_text, payload.keep_prediction
    )
    return await processing_response(session, processing)


@router.post("/processing/{processing_id}/finalize", response_model=ProcessingResponse)
async def finalize_document_processing(
    processing_id: str, session: SessionDependency, provider: ProviderDependency,
    current: CurrentActor = Depends(get_current_actor),
) -> ProcessingResponse:
    require_role(current, ActorRole.LECTURER, ActorRole.ACADEMIC_AFFAIRS)
    return await finalize_processing(session, processing_id, provider)


@router.get("/processing/{processing_id}/review-items/{review_id}/crop")
async def review_crop(
    processing_id: str, review_id: str, session: SessionDependency,
    current: CurrentActor = Depends(get_current_actor),
) -> FileResponse:
    require_role(current, ActorRole.LECTURER, ActorRole.ACADEMIC_AFFAIRS)
    processing = await get_processing(session, processing_id)
    from app.models import DocumentReviewItem
    item = await session.get(DocumentReviewItem, review_id)
    if item is None or item.processing_id != processing.id or not item.crop_path:
        from app.core.errors import AppError
        raise AppError("REVIEW_CROP_NOT_FOUND", "Không tìm thấy ảnh crop cho mục rà soát.", status_code=404)
    return FileResponse(local_absolute(item.crop_path), media_type="image/png")


@router.get("/processing/{processing_id}/export/{format}")
async def export_clean_document(
    processing_id: str, format: str, session: SessionDependency,
    current: CurrentActor = Depends(get_current_actor),
) -> FileResponse:
    require_role(current, ActorRole.LECTURER, ActorRole.ACADEMIC_AFFAIRS)
    processing = await get_processing(session, processing_id)
    if processing.status != "COMPLETED" or not processing.original_path:
        from app.core.errors import AppError
        raise AppError("PROCESSING_NOT_READY", "Tài liệu cần được xác nhận và lập chỉ mục trước khi xuất.", status_code=422)
    if format not in {"txt", "json"}:
        from app.core.errors import AppError
        raise AppError("UNSUPPORTED_EXPORT_FORMAT", "Chỉ hỗ trợ xuất TXT hoặc JSON.", status_code=422)
    export_path = local_absolute(processing.original_path).parent / f"clean.{format}"
    return FileResponse(export_path, filename=f"{processing_id}-clean.{format}")


@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: str,
    session: SessionDependency,
    current: CurrentActor = Depends(get_current_actor),
) -> DocumentResponse:
    return await get_document_response(session, document_id)
