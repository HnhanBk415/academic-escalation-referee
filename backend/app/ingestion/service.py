import hashlib
import re
from datetime import date
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.base import AIProvider
from app.ai.fake import FakeProvider
from app.core.config import get_settings
from app.core.enums import DocumentStatus
from app.core.errors import AppError
from app.ingestion.chunking import chunk_text
from app.ingestion.extractors import extract_text
from app.models import Document, DocumentChunk, RetrievalEvidence
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


def stable_chunk_id(document_id: str, chunk_index: int) -> str:
    readable = f"chunk-{document_id}-{chunk_index}"
    if len(readable) <= 64:
        return readable
    digest = hashlib.sha256(f"{document_id}:{chunk_index}".encode()).hexdigest()[:32]
    return f"chunk_{digest}"


def resolve_source_path(source_path: str) -> Path:
    candidate = Path(source_path)
    if not candidate.is_absolute():
        candidate = REPOSITORY_ROOT / candidate
    resolved = candidate.resolve()
    if not resolved.is_file():
        matches = [p for p in ALLOWED_DOCUMENT_ROOT.rglob(candidate.name) if p.is_file()]
        if matches:
            resolved = matches[0].resolve()
        else:
            raise AppError("DOCUMENT_FILE_NOT_FOUND", "Không tìm thấy file tài liệu.", status_code=404)
    if not resolved.is_relative_to(ALLOWED_DOCUMENT_ROOT):
        raise AppError(
            "DOCUMENT_PATH_NOT_ALLOWED",
            "Tài liệu phải nằm trong data/sample-documents.",
            status_code=422,
        )
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
        existing_by_index = {chunk.chunk_index: chunk for chunk in existing_chunks}
        for index, (chunk, vector) in enumerate(zip(chunks, vectors, strict=True)):
            chunk_hash = hashlib.sha256(chunk.content.encode("utf-8")).hexdigest()
            metadata = {
                "embedding_model": model_name,
                "embedding_dimensions": dimensions,
                "source_path": document.source_path,
                "superseded": False,
            }
            stored_chunk = existing_by_index.get(index)
            if stored_chunk is None:
                session.add(
                    DocumentChunk(
                        id=stable_chunk_id(document.id, index),
                        document_id=document.id,
                        course_id=document.course_id,
                        chunk_index=index,
                        heading=chunk.heading,
                        page_number=chunk.page_number,
                        content=chunk.content,
                        content_hash=chunk_hash,
                        embedding=vector,
                        chunk_metadata=metadata,
                    )
                )
            else:
                # Keep the chunk id stable so historical RetrievalEvidence rows
                # and citations remain valid across a re-index.
                stored_chunk.course_id = document.course_id
                stored_chunk.heading = chunk.heading
                stored_chunk.page_number = chunk.page_number
                stored_chunk.content = chunk.content
                stored_chunk.content_hash = chunk_hash
                stored_chunk.embedding = vector
                stored_chunk.chunk_metadata = metadata

        stale_chunks = [
            chunk for index, chunk in existing_by_index.items() if index >= len(chunks)
        ]
        if stale_chunks:
            stale_ids = [chunk.id for chunk in stale_chunks]
            referenced_ids = set(
                await session.scalars(
                    select(RetrievalEvidence.chunk_id).where(
                        RetrievalEvidence.chunk_id.in_(stale_ids)
                    )
                )
            )
            for stale_chunk in stale_chunks:
                if stale_chunk.id not in referenced_ids:
                    await session.delete(stale_chunk)
                    continue
                # Retain cited historical content but remove it from future
                # retrieval candidates.
                stale_chunk.embedding = None
                stale_chunk.chunk_metadata = {
                    **(stale_chunk.chunk_metadata or {}),
                    "superseded": True,
                }
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


EXTENSION_MAP = {
    ".pdf": "PDF",
    ".md": "MARKDOWN",
    ".txt": "TXT",
}


def _extract_document_title(file_path: Path, ext: str) -> str:
    """Extract a human-friendly title from markdown header or filename."""
    if ext in (".md", ".txt"):
        try:
            for line in file_path.read_text(encoding="utf-8").splitlines()[:10]:
                line = line.strip()
                if line.startswith("#"):
                    cleaned = line.lstrip("#").strip()
                    if cleaned:
                        return cleaned
        except Exception:
            pass
    stem = file_path.stem
    clean_title = re.sub(r"[-_]+", " ", stem).strip()
    return clean_title.title()


async def scan_and_sync_documents(
    session: AsyncSession,
    provider: AIProvider,
    default_course_id: str = "DADN",
) -> list[IngestResponse]:
    """
    Scans the data/sample-documents directory for all PDF/MD/TXT files across all course subdirectories,
    dynamically discovers courses and groups based on folder names, registers Document entities,
    and ingests them into the vector database.
    """
    from app.models import Course, Group

    if not ALLOWED_DOCUMENT_ROOT.is_dir():
        print(f"[Auto-Scan] Directory not found: {ALLOWED_DOCUMENT_ROOT}", flush=True)
        return []

    # 1. Discover all course subdirectories and ensure courses & groups exist
    course_dirs = [
        d for d in ALLOWED_DOCUMENT_ROOT.iterdir()
        if d.is_dir() and not d.name.startswith((".", "~"))
    ]
    for c_dir in course_dirs:
        c_id = c_dir.name
        existing_course = await session.get(Course, c_id)
        if existing_course is None:
            code = c_id.split("-")[0].strip()
            c_name = re.sub(r"[-_]+", " ", c_id).strip().title()
            sem = "242" if "242" in c_id else "261"
            session.add(Course(id=c_id, code=code, name=c_name, semester=sem))

            grp_a_id = f"{c_id.lower()}-group-a"
            grp_b_id = f"{c_id.lower()}-group-b"
            if await session.get(Group, grp_a_id) is None:
                session.add(Group(id=grp_a_id, course_id=c_id, name=f"{code} Group A", semester=sem))
            if await session.get(Group, grp_b_id) is None:
                session.add(Group(id=grp_b_id, course_id=c_id, name=f"{code} Group B", semester=sem))
            await session.commit()

    results: list[IngestResponse] = []
    files = sorted(
        [p for p in ALLOWED_DOCUMENT_ROOT.rglob("*") if p.is_file()],
        key=lambda p: (str(p.parent), p.name),
    )

    for file_path in files:
        if file_path.name.startswith((".", "~")):
            continue
        ext = file_path.suffix.lower()
        if ext not in EXTENSION_MAP:
            continue

        doc_type = EXTENSION_MAP[ext]
        filename = file_path.name

        # Infer course_id from parent folder if inside a subfolder
        inferred_course_id = (
            file_path.parent.name
            if file_path.parent != ALLOWED_DOCUMENT_ROOT and file_path.parent.name
            else default_course_id
        )
        course_id = inferred_course_id

        # Derive clean document ID and Title dynamically from file and folder name
        clean_stem = re.sub(r"[^a-zA-Z0-9_-]", "-", file_path.stem.lower()).strip("-")
        clean_course = re.sub(r"[^a-zA-Z0-9_-]", "-", course_id.lower()).strip("-")

        # Keep document ID stable and unique per course
        if clean_stem.startswith(clean_course):
            doc_id = clean_stem
        else:
            is_shared_filename = any(
                (other_dir / filename).is_file()
                for other_dir in course_dirs
                if other_dir.name != course_id
            )
            doc_id = f"{clean_course}-{clean_stem}" if is_shared_filename else clean_stem

        title = _extract_document_title(file_path, ext)
        raw = file_path.read_bytes()
        content_hash = hashlib.sha256(raw).hexdigest()
        rel_path = file_path.relative_to(REPOSITORY_ROOT).as_posix()

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
            print(f"[Auto-Scan] Registered new document: {doc_id} ('{filename}' in course '{course_id}')", flush=True)
        else:
            needs_update = False
            if doc.source_path != rel_path:
                doc.source_path = rel_path
                needs_update = True
            if doc.course_id != course_id:
                doc.course_id = course_id
                needs_update = True
            if doc.title != title and title:
                doc.title = title
                needs_update = True
            if doc.effective_until is None or doc.effective_until < date(2030, 1, 1):
                doc.effective_until = date(2030, 12, 31)
                needs_update = True
            if doc.status != DocumentStatus.ACTIVE and doc.status != DocumentStatus.INGESTING:
                doc.status = DocumentStatus.ACTIVE
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

