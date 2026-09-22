import hashlib
from pathlib import Path

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.base import AIProvider
from app.core.config import get_settings
from app.core.enums import DocumentStatus
from app.core.errors import AppError
from app.ingestion.chunking import chunk_text
from app.ingestion.extractors import extract_text
from app.models import Document, DocumentChunk
from app.schemas.documents import IngestResponse
from app.services.ids import new_id

def _find_repo_root() -> Path:
    current = Path(__file__).resolve()
    for parent in current.parents:
        if (parent / "data" / "sample-documents").is_dir():
            return parent
    return current.parents[2] if len(current.parents) > 2 else current.parent


REPOSITORY_ROOT = _find_repo_root()
ALLOWED_DOCUMENT_ROOT = (REPOSITORY_ROOT / "data" / "sample-documents").resolve()


def resolve_source_path(source_path: str) -> Path:
    candidate = Path(source_path)
    if not candidate.is_absolute():
        candidate = REPOSITORY_ROOT / candidate
    resolved = candidate.resolve()
    if not resolved.is_relative_to(ALLOWED_DOCUMENT_ROOT):
        raise AppError(
            "DOCUMENT_PATH_NOT_ALLOWED",
            "Tài liệu phải nằm trong data/sample-documents.",
            status_code=422,
        )
    if not resolved.is_file():
        raise AppError("DOCUMENT_FILE_NOT_FOUND", "Không tìm thấy file tài liệu.", status_code=404)
    return resolved


async def ingest_document(
    session: AsyncSession,
    document_id: str,
    *,
    provider: AIProvider,
) -> IngestResponse:
    document = await session.get(Document, document_id)
    if document is None:
        raise AppError("DOCUMENT_NOT_FOUND", "Không tìm thấy tài liệu.", status_code=404)

    path = resolve_source_path(document.source_path)
    raw = path.read_bytes()
    content_hash = hashlib.sha256(raw).hexdigest()
    existing_count = await session.scalar(
        select(func.count()).select_from(DocumentChunk).where(
            DocumentChunk.document_id == document.id
        )
    )
    if (
        document.status == DocumentStatus.ACTIVE
        and document.content_hash == content_hash
        and existing_count
    ):
        return IngestResponse(
            document_id=document.id,
            status=DocumentStatus.ACTIVE,
            chunk_count=existing_count,
            content_hash=content_hash,
            embedding_dimensions=get_settings().embedding_dimensions,
            idempotent=True,
        )

    document.status = DocumentStatus.INGESTING
    await session.flush()
    try:
        model_name = (
            get_settings().gemini_embed_model
            if get_settings().ai_mode == "gemini"
            else "deterministic-fake-v1"
        )
        indexed_chunks = (
            await session.scalars(
                select(DocumentChunk)
                .join(Document, Document.id == DocumentChunk.document_id)
                .where(
                    Document.status == DocumentStatus.ACTIVE,
                    Document.id != document.id,
                )
            )
        ).all()
        dimensions = get_settings().embedding_dimensions
        for indexed in indexed_chunks:
            metadata = indexed.chunk_metadata or {}
            indexed_model = metadata.get("embedding_model")
            indexed_dimensions = metadata.get("embedding_dimensions")
            if indexed_model and indexed_model != model_name:
                raise AppError(
                    "EMBEDDING_INDEX_MISMATCH",
                    "Embedding model đã thay đổi; cần re-index toàn bộ tài liệu.",
                    status_code=409,
                )
            if indexed_dimensions and indexed_dimensions != dimensions:
                raise AppError(
                    "EMBEDDING_INDEX_MISMATCH",
                    "Embedding dimensions đã thay đổi; cần re-index toàn bộ tài liệu.",
                    status_code=409,
                )
        text = extract_text(path, document.document_type)
        chunks = chunk_text(text)
        if not chunks:
            raise AppError("EMPTY_DOCUMENT", "Tài liệu không chứa văn bản có thể ingest.")
        vectors = await provider.embed(
            [chunk.content for chunk in chunks],
            task_type="RETRIEVAL_DOCUMENT",
        )
        if len(vectors) != len(chunks) or any(len(vector) != dimensions for vector in vectors):
            raise AppError(
                "INVALID_EMBEDDING_DIMENSIONS",
                f"Embedding phải có đúng {dimensions} chiều.",
                status_code=502,
            )
        await session.execute(
            delete(DocumentChunk).where(DocumentChunk.document_id == document.id)
        )
        for index, (chunk, vector) in enumerate(zip(chunks, vectors, strict=True)):
            chunk_hash = hashlib.sha256(chunk.content.encode("utf-8")).hexdigest()
            session.add(
                DocumentChunk(
                    id=new_id("chunk"),
                    document_id=document.id,
                    course_id=document.course_id,
                    chunk_index=index,
                    heading=chunk.heading,
                    page_number=chunk.page_number,
                    content=chunk.content,
                    content_hash=chunk_hash,
                    embedding=vector,
                    chunk_metadata={
                        "embedding_model": model_name,
                        "embedding_dimensions": dimensions,
                        "source_path": document.source_path,
                    },
                )
            )
        document.content_hash = content_hash
        document.status = DocumentStatus.ACTIVE
        await session.commit()
        return IngestResponse(
            document_id=document.id,
            status=DocumentStatus.ACTIVE,
            chunk_count=len(chunks),
            content_hash=content_hash,
            embedding_dimensions=dimensions,
            idempotent=False,
        )
    except Exception:
        await session.rollback()
        document = await session.get(Document, document_id)
        if document:
            document.status = DocumentStatus.FAILED
            await session.commit()
        raise
