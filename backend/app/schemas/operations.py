from datetime import datetime

from pydantic import BaseModel


class OperationsActivity(BaseModel):
    id: str
    event_type: str
    entity_type: str
    entity_id: str
    actor_id: str | None
    created_at: datetime


class OperationsOverview(BaseModel):
    total_questions: int
    open_cases: int
    overdue_cases: int
    active_exceptions: int
    active_documents: int
    recent_activity: list[OperationsActivity]
