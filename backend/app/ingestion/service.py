import hashlib
import re
from datetime import date
from pathlib import Path

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.base import AIProvider
from app.ai.fake import FakeProvider
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
    model_name = (
        "deterministic-fake-v1"
        if isinstance(provider, FakeProvider)
        else get_settings().gemini_embed_model
    )
    dimensions = get_settings().embedding_dimensions

    existing_chunks = (
        await session.scalars(
            select(DocumentChunk).where(DocumentChunk.document_id == document.id)
        )
    ).all()
    is_model_match = (
        bool(existing_chunks)
        and all(
            chunk.embedding is not None
            and len(chunk.embedding) == dimensions
            and (chunk.chunk_metadata or {}).get("embedding_model") == model_name
            for chunk in existing_chunks
        )
    )

    if (
        document.status == DocumentStatus.ACTIVE
        and document.content_hash == content_hash
        and is_model_match
    ):
        return IngestResponse(
            document_id=document.id,
            status=DocumentStatus.ACTIVE,
            chunk_count=len(existing_chunks),
            content_hash=content_hash,
            embedding_dimensions=dimensions,
            idempotent=True,
        )

    document.status = DocumentStatus.INGESTING
    await session.flush()
    try:
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
        mismatched_doc_ids = set()
        for indexed in indexed_chunks:
            metadata = indexed.chunk_metadata or {}
            indexed_model = metadata.get("embedding_model")
            indexed_dimensions = metadata.get("embedding_dimensions")
            if (indexed_model and indexed_model != model_name) or (indexed_dimensions and indexed_dimensions != dimensions):
                mismatched_doc_ids.add(indexed.document_id)
        if mismatched_doc_ids:
            print(f"[Ingestion] Purging {len(mismatched_doc_ids)} stale document(s) with outdated embedding model...", flush=True)
            await session.execute(
                delete(DocumentChunk).where(DocumentChunk.document_id.in_(mismatched_doc_ids))
            )
            await session.flush()

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


KNOWN_DOCUMENT_MAP = {
    "dadn-rubric.pdf": ("dadn-hk242-rubric", "Hướng dẫn chấm bài môn Đồ án Đa ngành", "DADN-HK242"),
    "dadn-course-plan.pdf": ("dadn-hk242-course-plan", "Kế hoạch môn học Đồ án Đa ngành HK242", "DADN-HK242"),
    "dadn-work-plan.pdf": ("dadn-hk242-work-plan", "Kế hoạch làm việc Đồ án Đa ngành HK242", "DADN-HK242"),
}

EXTENSION_MAP = {
    ".pdf": "PDF",
    ".md": "MARKDOWN",
    ".txt": "TXT",
}


async def scan_and_sync_documents(
    session: AsyncSession,
    provider: AIProvider,
    default_course_id: str = "DADN-HK242",
) -> list[IngestResponse]:
    """
    Scans the data/sample-documents directory for all PDF/MD/TXT files,
    registers any missing Document entities, and ingests them into the vector database.
    """
    if not ALLOWED_DOCUMENT_ROOT.is_dir():
        print(f"[Auto-Scan] Directory not found: {ALLOWED_DOCUMENT_ROOT}", flush=True)
        return []

    results: list[IngestResponse] = []
    files = sorted(ALLOWED_DOCUMENT_ROOT.iterdir(), key=lambda p: p.name)
    for file_path in files:
        if not file_path.is_file() or file_path.name.startswith((".", "~")):
            continue
        ext = file_path.suffix.lower()
        if ext not in EXTENSION_MAP:
            continue

        doc_type = EXTENSION_MAP[ext]
        filename = file_path.name
        if filename in KNOWN_DOCUMENT_MAP:
            doc_id, title, course_id = KNOWN_DOCUMENT_MAP[filename]
        else:
            clean_stem = re.sub(r"[^a-zA-Z0-9_-]", "-", file_path.stem.lower()).strip("-")
            doc_id = f"doc-{clean_stem}" if clean_stem else f"doc-{new_id('doc')}"
            title = file_path.stem.replace("-", " ").replace("_", " ").title()
            course_id = default_course_id

        raw = file_path.read_bytes()
        content_hash = hashlib.sha256(raw).hexdigest()
        rel_path = f"data/sample-documents/{filename}"

        doc = await session.get(Document, doc_id)
        if doc is None:
            doc = Document(
                id=doc_id,
                course_id=course_id,
                title=title,
                document_type=doc_type,
                source_path=rel_path,
                version="1.0",
                status=DocumentStatus.ACTIVE,
                effective_from=date(2025, 1, 1),
                effective_until=date(2030, 12, 31),
                content_hash=content_hash,
            )
            session.add(doc)
            await session.commit()
            print(f"[Auto-Scan] Registered new document: {doc_id} ('{filename}')", flush=True)
        else:
            needs_update = False
            if doc.effective_until is None or doc.effective_until < date(2030, 1, 1):
                doc.effective_until = date(2030, 12, 31)
                needs_update = True
            if doc.status != DocumentStatus.ACTIVE and doc.status != DocumentStatus.INGESTING:
                doc.status = DocumentStatus.ACTIVE
                needs_update = True
            if doc.content_hash != content_hash:
                doc.content_hash = content_hash
                needs_update = True
            if needs_update:
                await session.commit()

        try:
            res = await ingest_document(session, doc_id, provider=provider)
            results.append(res)
            status_text = "up-to-date" if res.idempotent else f"ingested ({res.chunk_count} chunks)"
            print(f"[Auto-Scan] Document '{filename}' ({doc_id}) is {status_text}.", flush=True)
        except Exception as exc:
            print(f"[Auto-Scan Error] Failed to ingest '{filename}': {exc}", flush=True)

    return results

