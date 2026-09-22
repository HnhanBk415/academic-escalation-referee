from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums import DocumentStatus
from app.core.errors import AppError
from app.models import Course, Document, DocumentChunk
from app.schemas.documents import DocumentCreate, DocumentResponse


async def register_document(
    session: AsyncSession,
    payload: DocumentCreate,
) -> DocumentResponse:
    if await session.get(Document, payload.id):
        raise AppError("DOCUMENT_ALREADY_EXISTS", "Document ID đã tồn tại.", status_code=409)
    if await session.get(Course, payload.course_id) is None:
        raise AppError("COURSE_NOT_FOUND", "Không tìm thấy học phần.", status_code=404)
    document = Document(
        id=payload.id,
        course_id=payload.course_id,
        title=payload.title,
        document_type=payload.document_type,
        source_path=payload.source_path,
        version=payload.version,
        status=DocumentStatus.PENDING,
        effective_from=payload.effective_from,
        effective_until=payload.effective_until,
        content_hash="",
    )
    session.add(document)
    await session.commit()
    await session.refresh(document)
    return await document_response(session, document)


async def document_response(
    session: AsyncSession,
    document: Document,
) -> DocumentResponse:
    chunk_count = await session.scalar(
        select(func.count()).select_from(DocumentChunk).where(
            DocumentChunk.document_id == document.id
        )
    )
    return DocumentResponse(
        id=document.id,
        course_id=document.course_id,
        title=document.title,
        document_type=document.document_type,
        source_path=document.source_path,
        version=document.version,
        status=document.status,
        effective_from=document.effective_from,
        effective_until=document.effective_until,
        content_hash=document.content_hash,
        chunk_count=chunk_count or 0,
        created_at=document.created_at,
    )


async def get_document_response(
    session: AsyncSession,
    document_id: str,
) -> DocumentResponse:
    document = await session.get(Document, document_id)
    if document is None:
        raise AppError("DOCUMENT_NOT_FOUND", "Không tìm thấy tài liệu.", status_code=404)
    return await document_response(session, document)
