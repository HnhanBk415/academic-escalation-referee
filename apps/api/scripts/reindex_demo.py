import argparse
import asyncio

from sqlalchemy import delete, func, select

from app.ai.factory import build_ai_provider
from app.db.session import SessionLocal
from app.ingestion.service import ingest_document
from app.models import (
    AuditEvent,
    Document,
    DocumentChunk,
    EscalationCase,
    HumanDecision,
    PolicyException,
    Question,
    RetrievalEvidence,
)

DEMO_DOCUMENT_IDS = ("group-policy-v1", "project-rubric-v1")


async def main(*, force_clear_demo_history: bool = False) -> None:
    provider = build_ai_provider()
    health = await provider.health()
    if health.mode != "gemini" or not health.available:
        raise RuntimeError("Gemini must be configured before re-indexing")

    async with SessionLocal() as session:
        question_count = await session.scalar(select(func.count()).select_from(Question))
        if question_count and not force_clear_demo_history:
            raise RuntimeError(
                "Re-indexing would clear demo questions and audit history. "
                "Use a fresh database, or rerun with --force-clear-demo-history."
            )
        # Re-indexing invalidates evidence pointers; clearing history requires an explicit flag.
        for model in (
            PolicyException,
            HumanDecision,
            EscalationCase,
            RetrievalEvidence,
            Question,
            AuditEvent,
        ):
            await session.execute(delete(model))
        await session.execute(
            delete(DocumentChunk).where(DocumentChunk.document_id.in_(DEMO_DOCUMENT_IDS))
        )
        for document_id in DEMO_DOCUMENT_IDS:
            document = await session.get(Document, document_id)
            if document is None:
                raise RuntimeError(f"Missing seeded document: {document_id}")
            document.status = "PENDING"
            document.content_hash = ""
        await session.commit()

        for document_id in DEMO_DOCUMENT_IDS:
            result = await ingest_document(session, document_id, provider=provider)
            print(
                f"Indexed {result.document_id}: {result.chunk_count} chunks, "
                f"{result.embedding_dimensions} dimensions"
            )
    print("Gemini demo re-index: PASS")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--force-clear-demo-history", action="store_true")
    arguments = parser.parse_args()
    asyncio.run(main(force_clear_demo_history=arguments.force_clear_demo_history))
