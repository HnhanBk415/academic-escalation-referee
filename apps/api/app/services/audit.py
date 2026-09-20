from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AuditEvent
from app.services.ids import new_id


def add_audit_event(
    session: AsyncSession,
    *,
    event_type: str,
    entity_type: str,
    entity_id: str,
    actor_id: str | None = None,
    request_id: str | None = None,
    input_snapshot: dict[str, Any] | None = None,
    output_snapshot: dict[str, Any] | None = None,
    reason_code: str | None = None,
    evidence_ids: list[str] | None = None,
    model_name: str | None = None,
    prompt_version: str | None = None,
    duration_ms: int | None = None,
    undo_of_event_id: str | None = None,
) -> AuditEvent:
    event = AuditEvent(
        id=new_id("audit"),
        request_id=request_id,
        event_type=event_type,
        actor_id=actor_id,
        entity_type=entity_type,
        entity_id=entity_id,
        input_snapshot=input_snapshot or {},
        output_snapshot=output_snapshot or {},
        reason_code=reason_code,
        evidence_ids=evidence_ids or [],
        model_name=model_name,
        prompt_version=prompt_version,
        duration_ms=duration_ms,
        undo_of_event_id=undo_of_event_id,
    )
    session.add(event)
    return event
