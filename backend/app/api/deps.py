from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.base import AIProvider
from app.core.auth import CurrentActor
from app.core.auth import get_current_actor as _get_current_actor
from app.db.session import get_session


def get_ai_provider(request: Request) -> AIProvider:
    return request.app.state.ai_provider


async def get_current_actor(
    request: Request, session: AsyncSession = Depends(get_session)
) -> CurrentActor:
    return await _get_current_actor(request, session)
