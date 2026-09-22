from datetime import datetime
from typing import Any

from pydantic import BaseModel


class AuditEventResponse(BaseModel):
    id: str
    request_id: str | None
    event_type: str
    actor_id: str | None
    entity_type: str
    entity_id: str
    input_snapshot: dict[str, Any]
    output_snapshot: dict[str, Any]
    reason_code: str | None
    evidence_ids: list[str]
    model_name: str | None
    prompt_version: str | None
    duration_ms: int | None
    undo_of_event_id: str | None
    created_at: datetime

