from datetime import date, datetime

from pydantic import BaseModel, Field

from app.core.enums import ExceptionStatus, ScopeType


class ExceptionResponse(BaseModel):
    id: str
    course_id: str
    scope_type: ScopeType
    scope_id: str
    content: str
    valid_from: date
    valid_until: date
    status: ExceptionStatus
    created_by: str
    created_at: datetime
    revoked_by: str | None
    revoked_at: datetime | None
    revocation_reason: str | None


class ExceptionRevokeCreate(BaseModel):
    actor_id: str
    reason: str = Field(min_length=3, max_length=4000)

