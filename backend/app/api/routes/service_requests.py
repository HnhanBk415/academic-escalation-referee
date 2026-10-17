from fastapi import APIRouter, Depends, Header, Query, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.base import AIProvider
from app.api.deps import get_ai_provider, get_current_actor
from app.core.auth import CurrentActor
from app.core.enums import ActorRole
from app.core.errors import AppError
from app.db.session import get_session
from app.models import AuditEvent, ServiceRequest
from app.schemas.audit import AuditEventResponse
from app.schemas.service_routing import (
    ServiceClarification,
    ServiceDecision,
    ServiceHandoff,
    ServiceRequestCreate,
    ServiceRequestResponse,
    ServiceStaffReview,
)
from app.services.service_routing import (
    catalog,
    clarify_service_request,
    confirm_service_request,
    create_service_request,
    decide_service_request,
    get_service_request,
    handoff_triage_request,
    review_service_request,
)

router = APIRouter()


@router.get("/catalog")
async def get_catalog(current: CurrentActor = Depends(get_current_actor)) -> list[dict]:
    return catalog()


@router.post("", response_model=ServiceRequestResponse, status_code=201)
async def create(
    payload: ServiceRequestCreate,
    request: Request,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    current: CurrentActor = Depends(get_current_actor),
    provider: AIProvider = Depends(get_ai_provider),
    session: AsyncSession = Depends(get_session),
) -> ServiceRequestResponse:
    return await create_service_request(
        session,
        payload,
        actor=current,
        provider=provider,
        request_id=request.state.request_id,
        idempotency_key=idempotency_key,
    )


@router.get("", response_model=list[ServiceRequestResponse])
async def list_items(
    status: str | None = None,
    limit: int = Query(default=50, ge=1, le=200),
    current: CurrentActor = Depends(get_current_actor),
    session: AsyncSession = Depends(get_session),
) -> list[ServiceRequestResponse]:
    query = select(ServiceRequest)
    if current.role == ActorRole.STUDENT:
        query = query.where(ServiceRequest.actor_id == current.id)
    elif current.role == ActorRole.LECTURER:
        query = query.where(ServiceRequest.service_id == "faculty_cs")
    elif current.role == ActorRole.ACADEMIC_AFFAIRS:
        query = query.where(ServiceRequest.service_id.in_(("academic_affairs", "triage_desk")))
    elif current.role == ActorRole.CLINIC:
        query = query.where(ServiceRequest.service_id == "clinic")
    else:
        query = query.where(ServiceRequest.actor_id == current.id)
    if status:
        query = query.where(ServiceRequest.status == status)
    rows = (await session.scalars(query.order_by(ServiceRequest.created_at.desc()).limit(limit))).all()
    responses = []
    for item in rows:
        _, response = await get_service_request(session, item.id, current)
        responses.append(response)
    return responses


@router.get("/{item_id}", response_model=ServiceRequestResponse)
async def detail(
    item_id: str,
    current: CurrentActor = Depends(get_current_actor),
    session: AsyncSession = Depends(get_session),
) -> ServiceRequestResponse:
    _, response = await get_service_request(session, item_id, current)
    return response


@router.get("/{item_id}/events", response_model=list[AuditEventResponse])
async def events(
    item_id: str,
    current: CurrentActor = Depends(get_current_actor),
    session: AsyncSession = Depends(get_session),
) -> list[AuditEventResponse]:
    await get_service_request(session, item_id, current)
    rows = (
        await session.scalars(
            select(AuditEvent)
            .where(AuditEvent.entity_type == "service_request", AuditEvent.entity_id == item_id)
            .order_by(AuditEvent.created_at)
        )
    ).all()
    return [AuditEventResponse.model_validate(row, from_attributes=True) for row in rows]


@router.post("/{item_id}/clarify", response_model=ServiceRequestResponse)
async def clarify(
    item_id: str,
    payload: ServiceClarification,
    current: CurrentActor = Depends(get_current_actor),
    provider: AIProvider = Depends(get_ai_provider),
    session: AsyncSession = Depends(get_session),
) -> ServiceRequestResponse:
    item, _ = await get_service_request(session, item_id, current)
    return await clarify_service_request(
        session, item, actor=current, text=payload.text, slots=payload.slots, provider=provider
    )


@router.post("/{item_id}/confirm", response_model=ServiceRequestResponse)
async def confirm(
    item_id: str,
    current: CurrentActor = Depends(get_current_actor),
    session: AsyncSession = Depends(get_session),
) -> ServiceRequestResponse:
    item, _ = await get_service_request(session, item_id, current)
    return await confirm_service_request(session, item, current)


@router.post("/{item_id}/decision", response_model=ServiceRequestResponse)
async def decide(
    item_id: str,
    payload: ServiceDecision,
    current: CurrentActor = Depends(get_current_actor),
    session: AsyncSession = Depends(get_session),
) -> ServiceRequestResponse:
    if current.role != ActorRole.LECTURER:
        raise AppError("ROLE_NOT_AUTHORIZED", "Chỉ giảng viên được phê duyệt.", status_code=403)
    item, _ = await get_service_request(session, item_id, current)
    return await decide_service_request(
        session, item, actor=current, approved=payload.approved, reason=payload.reason
    )


@router.post("/{item_id}/handoff", response_model=ServiceRequestResponse)
async def handoff(
    item_id: str,
    payload: ServiceHandoff,
    current: CurrentActor = Depends(get_current_actor),
    session: AsyncSession = Depends(get_session),
) -> ServiceRequestResponse:
    if current.role != ActorRole.ACADEMIC_AFFAIRS:
        raise AppError("ROLE_NOT_AUTHORIZED", "Chỉ bộ phận điều phối được bàn giao.", status_code=403)
    item, _ = await get_service_request(session, item_id, current)
    return await handoff_triage_request(
        session,
        item,
        actor=current,
        destination_name=payload.destination_name,
        note=payload.note,
    )


@router.post("/{item_id}/review", response_model=ServiceRequestResponse)
async def review(
    item_id: str,
    payload: ServiceStaffReview,
    current: CurrentActor = Depends(get_current_actor),
    session: AsyncSession = Depends(get_session),
) -> ServiceRequestResponse:
    item, _ = await get_service_request(session, item_id, current)
    return await review_service_request(
        session,
        item,
        actor=current,
        message=payload.message,
        outcome=payload.outcome,
    )
