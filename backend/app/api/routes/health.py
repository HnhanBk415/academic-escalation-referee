from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.base import AIProvider
from app.api.deps import get_ai_provider
from app.db.session import get_session
from app.schemas.referee import AIHealth

router = APIRouter()


@router.get("/health")
async def health(session: AsyncSession = Depends(get_session)) -> dict:
    await session.execute(text("SELECT 1"))
    return {"status": "ok", "database": "ok"}


@router.get("/health/ai", response_model=AIHealth)
async def ai_health(provider: AIProvider = Depends(get_ai_provider)) -> AIHealth:
    return await provider.health()

