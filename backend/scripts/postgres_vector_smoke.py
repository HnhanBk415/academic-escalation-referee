import asyncio

from app.ai.fake import FakeProvider
from app.db.session import SessionLocal
from app.rag.service import retrieve_evidence


async def main() -> None:
    async with SessionLocal() as session:
        evidence = await retrieve_evidence(
            session,
            provider=FakeProvider(),
            question="Một nhóm đồ án có bao nhiêu thành viên?",
            course_id="CO3001",
        )
    if not evidence:
        raise RuntimeError("PostgreSQL vector retrieval returned no evidence")
    if evidence[0]["document_title"] != "Quy định nhóm đồ án CO3001":
        raise RuntimeError(f"Unexpected first result: {evidence[0]['document_title']}")
    print(
        "PostgreSQL pgvector smoke: PASS "
        f"({evidence[0]['chunk_id']}, score={evidence[0]['score']:.4f})"
    )


if __name__ == "__main__":
    asyncio.run(main())
