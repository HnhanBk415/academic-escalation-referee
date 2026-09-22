from fastapi import APIRouter, Depends
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.base import AIProvider
from app.api.deps import get_ai_provider
from app.db.seed import seed_demo
from app.db.session import get_session
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

router = APIRouter()


@router.post("/reset")
async def reset_demo(
    session: AsyncSession = Depends(get_session),
    provider: AIProvider = Depends(get_ai_provider),
) -> dict:
    for model in (
        PolicyException,
        HumanDecision,
        EscalationCase,
        RetrievalEvidence,
        Question,
        AuditEvent,
    ):
        await session.execute(delete(model))
    seed_document_ids = ("group-policy-v1", "project-rubric-v1")
    await session.execute(
        delete(DocumentChunk).where(DocumentChunk.document_id.not_in(seed_document_ids))
    )
    await session.execute(delete(Document).where(Document.id.not_in(seed_document_ids)))
    await session.commit()
    await seed_demo(session, provider=provider)
    return {"status": "reset", "seeded": True}
