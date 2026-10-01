from time import monotonic

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.base import AIProvider
from app.api.deps import get_ai_provider
from app.core.config import get_settings
from app.db.session import get_session
from app.schemas.referee import AIHealth

router = APIRouter()
_ai_health_cache: tuple[float, int, AIHealth] | None = None


@router.get("/health")
async def health(session: AsyncSession = Depends(get_session)) -> dict:
    await session.execute(text("SELECT 1"))
    return {"status": "ok", "database": "ok"}


@router.get("/health/ai", response_model=AIHealth)
async def ai_health(provider: AIProvider = Depends(get_ai_provider)) -> AIHealth:
    global _ai_health_cache
    now = monotonic()
    ttl = get_settings().ai_health_cache_seconds
    if (
        _ai_health_cache is not None
        and _ai_health_cache[1] == id(provider)
        and now - _ai_health_cache[0] < ttl
    ):
        return _ai_health_cache[2]
    result = await provider.health()
    _ai_health_cache = (now, id(provider), result)
    return result

