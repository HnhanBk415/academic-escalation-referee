from pydantic import BaseModel, Field, model_validator

from app.core.enums import Route, UncertaintyType


class RefereeDecision(BaseModel):
    route: Route
    uncertainty_type: UncertaintyType
    reason_code: str
    answer: str | None = None
    clarifying_question: str | None = None
    decision_question: str | None = None
    citation_labels: list[str] = Field(default_factory=list)
    confidence: float = Field(ge=0, le=1)

    @model_validator(mode="after")
    def validate_route_payload(self) -> "RefereeDecision":
        if self.route == Route.ANSWER:
            if not self.answer:
                raise ValueError("ANSWER requires answer")
            if not self.citation_labels:
                raise ValueError("ANSWER requires at least one citation")
        elif self.route == Route.CLARIFY:
            if not self.clarifying_question:
                raise ValueError("CLARIFY requires clarifying_question")
            if self.answer:
                raise ValueError("CLARIFY cannot include a definitive answer")
        elif self.route == Route.ESCALATE and not self.decision_question:
            raise ValueError("ESCALATE requires decision_question")
        return self


class AIHealth(BaseModel):
    mode: str
    available: bool
    model: str
    detail: str | None = None

