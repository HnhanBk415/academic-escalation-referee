from pydantic import BaseModel, Field, model_validator

from app.core.enums import EscalationTarget, PolicyCoverage, Route, UncertaintyType


class RefereeDecision(BaseModel):
    route: Route
    policy_coverage: PolicyCoverage
    policy_topic: str = Field(min_length=2, max_length=100, pattern=r"^[A-Z][A-Z0-9_]*$")
    uncertainty_type: UncertaintyType
    reason_code: str
    escalation_target: EscalationTarget | None = None
    answer: str | None = None
    clarifying_question: str | None = None
    decision_question: str | None = None
    citation_labels: list[str] = Field(default_factory=list)
    confidence: float = Field(ge=0, le=1)

    @model_validator(mode="after")
    def validate_route_payload(self) -> "RefereeDecision":
        expected_routes = {
            PolicyCoverage.DIRECT: Route.ANSWER,
            PolicyCoverage.CONDITIONAL: Route.ANSWER,
            PolicyCoverage.APPLICABLE_EXCEPTION: Route.ANSWER,
            PolicyCoverage.MISSING_FACT: Route.CLARIFY,
            PolicyCoverage.REQUIRES_APPROVAL: Route.ESCALATE,
            PolicyCoverage.REQUESTS_WAIVER: Route.ESCALATE,
            PolicyCoverage.NO_POLICY: Route.ESCALATE,
            PolicyCoverage.CONFLICTING: Route.ESCALATE,
            PolicyCoverage.SUSPICIOUS: Route.ESCALATE,
        }
        if self.route != expected_routes[self.policy_coverage]:
            raise ValueError("route is inconsistent with policy_coverage")
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

