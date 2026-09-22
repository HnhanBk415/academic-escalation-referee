from fastapi import APIRouter, Depends, Header, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums import CaseStatus
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
    session: AsyncSession = Depends(get_session),
) -> list[CaseSummary]:
    return await list_cases(session, status)


@router.get("/{case_id}", response_model=CaseDetail)
async def get_case(
    case_id: str,
    session: AsyncSession = Depends(get_session),
) -> CaseDetail:
    return await get_case_detail(session, case_id)


@router.post("/{case_id}/decision", response_model=DecisionResponse)
async def create_decision(
    case_id: str,
    payload: CaseDecisionCreate,
    request: Request,
    session: AsyncSession = Depends(get_session),
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
) -> DecisionResponse:
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
) -> CaseSummary:
    return await cancel_case(
        session,
        case_id,
        actor_id=payload.actor_id,
        reason=payload.reason,
        request_id=request.state.request_id,
    )

