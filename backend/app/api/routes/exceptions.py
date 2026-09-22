from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.schemas.exceptions import ExceptionResponse, ExceptionRevokeCreate
from app.services.exceptions import list_exceptions, revoke_exception

router = APIRouter()


@router.get("", response_model=list[ExceptionResponse])
async def get_exceptions(
    session: AsyncSession = Depends(get_session),
) -> list[ExceptionResponse]:
    return await list_exceptions(session)


@router.post("/{exception_id}/revoke", response_model=ExceptionResponse)
async def revoke(
    exception_id: str,
    payload: ExceptionRevokeCreate,
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> ExceptionResponse:
    return await revoke_exception(
        session,
        exception_id,
        actor_id=payload.actor_id,
        reason=payload.reason,
        request_id=request.state.request_id,
    )

