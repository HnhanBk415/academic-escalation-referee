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
    pending_format_reviews: int
    active_format_policy_profiles: int
    courses_without_active_format_policy: int
    format_checks_today: int
    format_needs_fix_today: int
    format_needs_review_today: int
    format_unable_to_check_today: int
    recent_activity: list[OperationsActivity]
