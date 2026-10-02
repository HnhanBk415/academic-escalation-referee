from datetime import datetime

from pydantic import BaseModel, Field

from app.core.enums import QuestionStatus, Route, UncertaintyType


class QuestionCreate(BaseModel):
    actor_id: str = "demo-student"
    course_id: str
    group_id: str | None = None
    text: str = Field(min_length=3, max_length=4000)


class ClarificationCreate(BaseModel):
    text: str = Field(min_length=1, max_length=4000)
    group_id: str | None = None


class CitationResponse(BaseModel):
    label: str
    chunk_id: str
    document_id: str
    document_title: str
    page_number: int | None
    heading: str | None
    quote: str


class QuestionResponse(BaseModel):
    question_id: str
    status: QuestionStatus
    route: Route
    uncertainty_type: UncertaintyType
    reason_code: str
    policy_topic: str | None = None
    escalation_target: str | None = None
    answer: str | None
    clarifying_question: str | None
    case_id: str | None
    final_decision: str | None = None
    final_decision_reason: str | None = None
    exception_id: str | None = None
    applied_exception_id: str | None = None
    parent_question_id: str | None = None
    clarification_round: int = 0
    citations: list[CitationResponse]
    created_at: datetime
    text: str | None = None
    course_id: str | None = None
    group_id: str | None = None
    actor_id: str | None = None


class DashboardCounts(BaseModel):
    pending_questions: int
    under_review_cases: int

