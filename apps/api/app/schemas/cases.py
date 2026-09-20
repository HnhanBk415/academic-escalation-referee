from datetime import date, datetime

from pydantic import BaseModel, Field, model_validator

from app.core.enums import CaseStatus, DecisionValue, ScopeType
from app.schemas.questions import CitationResponse


class ExceptionCreate(BaseModel):
    scope_type: ScopeType
    scope_id: str
    course_id: str
    content: str = Field(min_length=3, max_length=4000)
    valid_from: date
    valid_until: date

    @model_validator(mode="after")
    def validate_period(self) -> "ExceptionCreate":
        if self.valid_until < self.valid_from:
            raise ValueError("valid_until must not be before valid_from")
        return self


class CaseDecisionCreate(BaseModel):
    reviewer_id: str
    decision: DecisionValue
    reason: str = Field(min_length=3, max_length=4000)
    create_exception: bool = False
    exception: ExceptionCreate | None = None

    @model_validator(mode="after")
    def validate_exception(self) -> "CaseDecisionCreate":
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
    decision_question: str
    assigned_reviewer_id: str | None
    created_at: datetime


class CaseDetail(CaseSummary):
    original_question: str
    actor_id: str
    group_id: str | None
    course_id: str
    ai_summary: str
    citations: list[CitationResponse]


class DecisionResponse(BaseModel):
    decision_id: str
    case_id: str
    status: CaseStatus
    decision: DecisionValue
    exception_id: str | None = None

