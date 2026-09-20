from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.models import AuditEvent
from app.schemas.audit import AuditEventResponse

router = APIRouter()


def _response(event: AuditEvent) -> AuditEventResponse:
    return AuditEventResponse(
        id=event.id,
        request_id=event.request_id,
        event_type=event.event_type,
        actor_id=event.actor_id,
        entity_type=event.entity_type,
        entity_id=event.entity_id,
        input_snapshot=event.input_snapshot,
        output_snapshot=event.output_snapshot,
        reason_code=event.reason_code,
        evidence_ids=event.evidence_ids,
        model_name=event.model_name,
        prompt_version=event.prompt_version,
        duration_ms=event.duration_ms,
        undo_of_event_id=event.undo_of_event_id,
        created_at=event.created_at,
    )


@router.get("", response_model=list[AuditEventResponse])
async def get_audit(
    limit: int = Query(default=100, ge=1, le=500),
    session: AsyncSession = Depends(get_session),
) -> list[AuditEventResponse]:
    events = (
        await session.scalars(
            select(AuditEvent).order_by(AuditEvent.created_at.desc()).limit(limit)
        )
    ).all()
    return [_response(event) for event in events]


@router.get("/{entity_type}/{entity_id}", response_model=list[AuditEventResponse])
async def get_entity_audit(
    entity_type: str,
    entity_id: str,
    session: AsyncSession = Depends(get_session),
) -> list[AuditEventResponse]:
    events = (
        await session.scalars(
            select(AuditEvent)
            .where(
                AuditEvent.entity_type == entity_type,
                AuditEvent.entity_id == entity_id,
            )
            .order_by(AuditEvent.created_at)
        )
    ).all()
    return [_response(event) for event in events]

