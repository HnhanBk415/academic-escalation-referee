from datetime import datetime

from pydantic import BaseModel, Field

from app.core.enums import QuestionStatus, Route, UncertaintyType


class QuestionCreate(BaseModel):
    actor_id: str
    course_id: str
    text: str = Field(min_length=3, max_length=4000)


class ClarificationCreate(BaseModel):
    text: str = Field(min_length=1, max_length=4000)


class CitationResponse(BaseModel):
    label: str
    chunk_id: str
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
    answer: str | None
    clarifying_question: str | None
    case_id: str | None
    final_decision: str | None = None
    final_decision_reason: str | None = None
    exception_id: str | None = None
    citations: list[CitationResponse]
    created_at: datetime
