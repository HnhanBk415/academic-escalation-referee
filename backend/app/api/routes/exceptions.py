from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_actor
from app.core.auth import CurrentActor, effective_actor_id, require_role
from app.core.enums import ActorRole
from app.db.session import get_session
from app.schemas.exceptions import (
    CourseExceptionOverview,
    ExceptionResponse,
    ExceptionRevokeCreate,
)
from app.services.exceptions import exception_overview, list_exceptions, revoke_exception

router = APIRouter()


@router.get("", response_model=list[ExceptionResponse])
async def get_exceptions(
    current: CurrentActor = Depends(get_current_actor),
    session: AsyncSession = Depends(get_session),
) -> list[ExceptionResponse]:
    require_role(current, ActorRole.LECTURER, ActorRole.ACADEMIC_AFFAIRS)
    return await list_exceptions(session)


@router.get("/overview", response_model=list[CourseExceptionOverview])
async def get_exception_overview(
    current: CurrentActor = Depends(get_current_actor),
    session: AsyncSession = Depends(get_session),
) -> list[CourseExceptionOverview]:
    require_role(current, ActorRole.LECTURER, ActorRole.ACADEMIC_AFFAIRS)
    return await exception_overview(session)


@router.post("/{exception_id}/revoke", response_model=ExceptionResponse)
async def revoke(
    exception_id: str,
    payload: ExceptionRevokeCreate,
    request: Request,
    session: AsyncSession = Depends(get_session),
    current: CurrentActor = Depends(get_current_actor),
) -> ExceptionResponse:
    require_role(current, ActorRole.LECTURER)
    return await revoke_exception(
        session,
        exception_id,
        actor_id=effective_actor_id(current, payload.actor_id),
        reason=payload.reason,
        request_id=request.state.request_id,
    )
