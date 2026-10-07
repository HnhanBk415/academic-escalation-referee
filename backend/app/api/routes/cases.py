from fastapi import APIRouter, Depends, Header, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_actor
from app.core.auth import CurrentActor, effective_actor_id, production_auth_enabled, require_role
from app.core.enums import ActorRole, CaseStatus
from app.core.errors import AppError
from app.db.session import get_session
from app.schemas.cases import (
    CaseCancelCreate,
    CaseDecisionCreate,
    CaseDetail,
    CaseSummary,
    DecisionResponse,
)
from app.services.cases import cancel_case, decide_case, get_case_detail, list_cases

router = APIRouter()


@router.get("", response_model=list[CaseSummary])
async def get_cases(
    status: CaseStatus | None = Query(default=None),
    current: CurrentActor = Depends(get_current_actor),
    session: AsyncSession = Depends(get_session),
) -> list[CaseSummary]:
    require_role(current, ActorRole.LECTURER, ActorRole.ACADEMIC_AFFAIRS)
    return await list_cases(session, status)


@router.get("/{case_id}", response_model=CaseDetail)
async def get_case(
    case_id: str,
    current: CurrentActor = Depends(get_current_actor),
    session: AsyncSession = Depends(get_session),
) -> CaseDetail:
    detail = await get_case_detail(session, case_id)
    if production_auth_enabled() and current.role == ActorRole.STUDENT and detail.actor_id != current.id:
        raise AppError("CASE_NOT_AUTHORIZED", "Không có quyền xem hồ sơ này.", status_code=403)
    return detail


@router.post("/{case_id}/decision", response_model=DecisionResponse)
async def create_decision(
    case_id: str,
    payload: CaseDecisionCreate,
    request: Request,
    session: AsyncSession = Depends(get_session),
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    current: CurrentActor = Depends(get_current_actor),
) -> DecisionResponse:
    require_role(current, ActorRole.LECTURER)
    payload = payload.model_copy(update={"reviewer_id": effective_actor_id(current, payload.reviewer_id)})
    return await decide_case(
        session,
        case_id,
        payload,
        idempotency_key=idempotency_key,
        request_id=request.state.request_id,
    )


@router.post("/{case_id}/cancel", response_model=CaseSummary)
async def cancel(
    case_id: str,
    payload: CaseCancelCreate,
    request: Request,
    session: AsyncSession = Depends(get_session),
    current: CurrentActor = Depends(get_current_actor),
) -> CaseSummary:
    actor_id = effective_actor_id(current, payload.actor_id)
    if production_auth_enabled():
        detail = await get_case_detail(session, case_id)
        if current.role != ActorRole.STUDENT or detail.actor_id != actor_id:
            raise AppError("CASE_NOT_AUTHORIZED", "Không có quyền hủy hồ sơ này.", status_code=403)
    return await cancel_case(
        session,
        case_id,
        actor_id=actor_id,
        reason=payload.reason,
        request_id=request.state.request_id,
    )
