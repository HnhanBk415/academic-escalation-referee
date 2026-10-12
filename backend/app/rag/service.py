import math
import re
from datetime import date

from sqlalchemy import or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.base import AIProvider
from app.core.config import get_settings
from app.core.enums import DocumentStatus
from app.models import Document, DocumentChunk

STOP_WORDS = {
    "ai",
    "bao",
    "bị",
    "có",
    "của",
    "cho",
    "đó",
    "được",
    "em",
    "gì",
    "khi",
    "là",
    "mỗi",
    "nào",
    "nhiêu",
    "phải",
    "sau",
    "thế",
    "thì",
    "trong",
    "và",
    "với",
}


def _tokens(value: str) -> set[str]:
    return {
        token
        for token in re.findall(r"\w+", value.casefold(), flags=re.UNICODE)
        if token not in STOP_WORDS
    }


def _cosine(left: list[float], right: list[float]) -> float:
    dot = sum(a * b for a, b in zip(left, right, strict=True))
    left_norm = math.sqrt(sum(value * value for value in left))
    right_norm = math.sqrt(sum(value * value for value in right))
    if not left_norm or not right_norm:
        return 0.0
    return dot / (left_norm * right_norm)


def _deduplicate(items: list[dict], limit: int) -> list[dict]:
    seen: set[str] = set()
    selected: list[dict] = []
    for item in items:
        if item["content_hash"] in seen:
            continue
        seen.add(item["content_hash"])
        selected.append(item)
        if len(selected) == limit:
            break
    for index, item in enumerate(selected, start=1):
        item["label"] = f"C{index}"
    return selected


def _reciprocal_rank_fusion(
    dense_items: list[dict],
    keyword_items: list[dict],
    *,
    rrf_k: int,
) -> list[dict]:
    """Fuse semantic and exact-match rankings without comparing raw scores."""
    combined: dict[str, dict] = {}
    for source, items in (("dense", dense_items), ("keyword", keyword_items)):
        for rank, item in enumerate(items, start=1):
            key = str(item["chunk_id"])
            merged = combined.setdefault(
                key,
                {
                    **item,
                    "dense_rank": None,
                    "keyword_rank": None,
                    "dense_score": None,
                    "keyword_score": None,
                    "score": 0.0,
                },
            )
            merged[f"{source}_rank"] = rank
            merged[f"{source}_score"] = float(item["score"])
            merged["score"] += 1.0 / (rrf_k + rank)
    return sorted(combined.values(), key=lambda item: item["score"], reverse=True)


async def _candidate_chunks(session: AsyncSession, course_id: str) -> list[tuple]:
    today = date.today()
    candidates = list(
        (
            await session.execute(
                select(DocumentChunk, Document)
                .join(Document, Document.id == DocumentChunk.document_id)
                .where(
                    DocumentChunk.course_id == course_id,
                    Document.status == DocumentStatus.ACTIVE,
                    or_(Document.effective_from.is_(None), Document.effective_from <= today),
                    or_(Document.effective_until.is_(None), Document.effective_until >= today),
                )
            )
        ).all()
    )
    return [
        (chunk, document)
        for chunk, document in candidates
        if not (chunk.chunk_metadata or {}).get("superseded", False)
        and (chunk.chunk_metadata or {}).get("retrieval_eligible", True) is not False
    ]


async def _postgres_vector_search(
    session: AsyncSession,
    course_id: str,
    vector: list[float],
    limit: int,
    embedding_model: str,
) -> list[dict]:
    settings = get_settings()
    # HNSW applies metadata predicates after its approximate candidate walk.
    # A higher ef_search prevents sparse course/version filters from returning
    # too few candidates while still avoiding a sequential vector scan.
    await session.execute(text(f"SET LOCAL hnsw.ef_search = {settings.rag_hnsw_ef_search}"))
    vector_literal = "[" + ",".join(str(value) for value in vector) + "]"
    statement = text(
        """
        SELECT dc.id AS chunk_id, dc.content, dc.content_hash, dc.heading, dc.page_number,
               d.id AS document_id, d.title AS document_title,
               1 - (dc.embedding <=> CAST(:embedding AS vector)) AS score
        FROM document_chunks dc
        JOIN documents d ON d.id = dc.document_id
        WHERE dc.course_id = :course_id
          AND d.status = 'ACTIVE'
          AND (d.effective_from IS NULL OR d.effective_from <= CURRENT_DATE)
          AND (d.effective_until IS NULL OR d.effective_until >= CURRENT_DATE)
          AND dc.embedding IS NOT NULL
          AND dc.metadata->>'embedding_model' = :embedding_model
          AND COALESCE((dc.metadata->>'superseded')::boolean, false) = false
          AND COALESCE(dc.metadata->>'retrieval_eligible', 'true') = 'true'
        ORDER BY dc.embedding <=> CAST(:embedding AS vector)
        LIMIT :limit
        """
    )
    rows = (
        await session.execute(
            statement,
            {
                "embedding": vector_literal,
                "course_id": course_id,
                "limit": limit,
                "embedding_model": embedding_model,
            },
        )
    ).mappings()
    return [dict(row) for row in rows]


async def _postgres_full_text_search(
    session: AsyncSession,
    course_id: str,
    question: str,
    limit: int,
    embedding_model: str,
) -> list[dict]:
    """Exact lexical retrieval with the same mandatory metadata filter as vectors."""
    statement = text(
        """
        SELECT dc.id AS chunk_id, dc.content, dc.content_hash, dc.heading, dc.page_number,
               d.id AS document_id, d.title AS document_title,
               ts_rank_cd(dc.search_vector, query) AS score
        FROM document_chunks dc
        JOIN documents d ON d.id = dc.document_id
        CROSS JOIN websearch_to_tsquery('simple', unaccent(:question)) AS query
        WHERE dc.course_id = :course_id
          AND d.status = 'ACTIVE'
          AND (d.effective_from IS NULL OR d.effective_from <= CURRENT_DATE)
          AND (d.effective_until IS NULL OR d.effective_until >= CURRENT_DATE)
          AND dc.metadata->>'embedding_model' = :embedding_model
          AND COALESCE((dc.metadata->>'superseded')::boolean, false) = false
          AND COALESCE(dc.metadata->>'retrieval_eligible', 'true') = 'true'
          AND dc.search_vector @@ query
        ORDER BY ts_rank_cd(dc.search_vector, query) DESC, dc.id
        LIMIT :limit
        """
    )
    rows = (
        await session.execute(
            statement,
            {
                "question": question,
                "course_id": course_id,
                "limit": limit,
                "embedding_model": embedding_model,
            },
        )
    ).mappings()
    return [dict(row) for row in rows]


async def _portable_vector_search(
    session: AsyncSession,
    course_id: str,
    vector: list[float],
    limit: int,
) -> list[dict]:
    items: list[dict] = []
    for chunk, document in await _candidate_chunks(session, course_id):
        metadata = chunk.chunk_metadata or {}
        if (
            not chunk.embedding
            or len(chunk.embedding) != len(vector)
            or metadata.get("embedding_model") != get_settings().gemini_embed_model
            or metadata.get("retrieval_eligible", True) is False
            or metadata.get("superseded", False)
        ):
            continue
        items.append(
            {
                "chunk_id": chunk.id,
                "content": chunk.content,
                "content_hash": chunk.content_hash,
                "heading": chunk.heading,
                "page_number": chunk.page_number,
                "document_id": document.id,
                "document_title": document.title,
                "score": _cosine(chunk.embedding, vector),
            }
        )
    return sorted(items, key=lambda item: item["score"], reverse=True)[:limit]


async def _keyword_search(
    session: AsyncSession,
    course_id: str,
    question: str,
    limit: int,
) -> list[dict]:
    query_tokens = _tokens(question)
    items: list[dict] = []
    for chunk, document in await _candidate_chunks(session, course_id):
        chunk_tokens = _tokens(chunk.content)
        score = len(query_tokens & chunk_tokens) / max(len(query_tokens), 1)
        if score:
            items.append(
                {
                    "chunk_id": chunk.id,
                    "content": chunk.content,
                    "content_hash": chunk.content_hash,
                    "heading": chunk.heading,
                    "page_number": chunk.page_number,
                    "document_id": document.id,
                    "document_title": document.title,
                    "score": score,
                }
            )
    return sorted(items, key=lambda item: item["score"], reverse=True)[:limit]


async def retrieve_evidence(
    session: AsyncSession,
    *,
    provider: AIProvider,
    question: str,
    course_id: str,
) -> list[dict]:
    settings = get_settings()
    if settings.ai_mode == "fake":
        items = await _keyword_search(
            session, course_id, question, settings.rag_top_k
        )
        relevant = [item for item in items if float(item["score"]) >= settings.rag_min_score]
        return _deduplicate(relevant, settings.rag_context_chunks)
    dense_items: list[dict] = []
    try:
        vector = (
            await provider.embed([question], task_type="RETRIEVAL_QUERY")
        )[0]
        if len(vector) != settings.embedding_dimensions:
            raise ValueError("Query embedding dimension mismatch")
        bind = session.get_bind()
        if bind.dialect.name == "postgresql":
            dense_items = await _postgres_vector_search(
                session,
                course_id,
                vector,
                settings.rag_dense_candidates,
                settings.gemini_embed_model,
            )
        else:
            dense_items = await _portable_vector_search(
                session, course_id, vector, settings.rag_dense_candidates
            )
    except Exception as exc:
        print(
            f"[RAG Error] Vector search failed ({exc}), "
            "falling back to keyword search",
            flush=True,
        )
        dense_items = []
    dense_relevant = [
        item for item in dense_items if float(item["score"]) >= settings.rag_min_score
    ]
    try:
        bind = session.get_bind()
        if bind.dialect.name == "postgresql":
            keyword_items = await _postgres_full_text_search(
                session,
                course_id,
                question,
                settings.rag_keyword_candidates,
                settings.gemini_embed_model,
            )
        else:
            keyword_items = await _keyword_search(
                session, course_id, question, settings.rag_keyword_candidates
            )
    except Exception as exc:
        print(f"[RAG Error] Full-text search failed ({exc}), using portable keyword search", flush=True)
        keyword_items = await _keyword_search(
            session, course_id, question, settings.rag_keyword_candidates
        )
    fused = _reciprocal_rank_fusion(
        dense_relevant,
        keyword_items,
        rrf_k=settings.rag_rrf_k,
    )
    return _deduplicate(fused, settings.rag_context_chunks)
