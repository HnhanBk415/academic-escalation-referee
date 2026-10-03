from datetime import UTC, date, datetime

from pydantic import BaseModel, Field, field_validator, model_validator

from app.core.enums import CaseStatus, DecisionValue, ScopeType
from app.core.policy_topics import canonical_policy_topic
from app.schemas.questions import CitationResponse


class ExceptionCreate(BaseModel):
    scope_type: ScopeType
    scope_id: str
    course_id: str
    content: str = Field(min_length=3, max_length=4000)
    policy_topic: str | None = Field(default=None, min_length=2, max_length=100)
    valid_from: date
    valid_until: date

    @model_validator(mode="after")
    def validate_period(self) -> "ExceptionCreate":
        if self.valid_until < self.valid_from:
            raise ValueError("valid_until must not be before valid_from")
        if self.policy_topic is not None:
            self.policy_topic = canonical_policy_topic(self.policy_topic)
        return self


class CaseDecisionCreate(BaseModel):
    reviewer_id: str
    decision: DecisionValue
    reason: str = Field(min_length=3, max_length=4000)
    create_exception: bool = False
    exception: ExceptionCreate | None = None

    @model_validator(mode="after")
    def validate_exception(self) -> "CaseDecisionCreate":
        if self.decision == DecisionValue.FORWARDED:
            raise ValueError("The demo lecturer must approve or reject; forwarding is disabled")
        if self.exception is not None:
            if self.decision != DecisionValue.APPROVED:
                raise ValueError("Only APPROVED decisions may create an exception")
            # Supplying exception details is the explicit save action. Do not
            # silently discard them because a client omitted the legacy flag.
            self.create_exception = True
        if self.create_exception:
            if self.decision != DecisionValue.APPROVED:
                raise ValueError("Only APPROVED decisions may create an exception")
            if self.exception is None:
                raise ValueError("exception is required when create_exception is true")
        return self


class CaseCancelCreate(BaseModel):
    actor_id: str
    reason: str = Field(min_length=3, max_length=4000)


class CaseSummary(BaseModel):
    id: str
    question_id: str
    status: CaseStatus
    reason_code: str
    uncertainty_type: str
    escalation_target: str | None = None
    decision_question: str
    assigned_reviewer_id: str | None
    created_at: datetime
    sla_due_at: datetime | None = None
    sla_overdue: bool = False

    @field_validator("created_at", "sla_due_at", mode="after")
    @classmethod
    def normalize_timestamps_to_utc(cls, value: datetime | None) -> datetime | None:
        if value is None:
            return None
        if value.tzinfo is None:
            return value.replace(tzinfo=UTC)
        return value.astimezone(UTC)


class CaseDetail(CaseSummary):
    original_question: str
    actor_id: str
    group_id: str | None
    group_name: str | None
    course_id: str
    policy_topic: str | None
    ai_summary: str
    citations: list[CitationResponse]


class DecisionResponse(BaseModel):
    decision_id: str
    case_id: str
    status: CaseStatus
    decision: DecisionValue
    exception_id: str | None = None

