from pydantic import BaseModel, Field, model_validator

from app.core.enums import EscalationTarget, PolicyCoverage, Route, UncertaintyType
from app.core.policy_topics import canonical_policy_topic


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
    applied_exception_id: str | None = None

    @model_validator(mode="before")
    @classmethod
    def normalize_policy_topic(cls, value):  # type: ignore[no-untyped-def]
        if isinstance(value, dict):
            value = dict(value)
            if "policy_topic" in value:
                value["policy_topic"] = canonical_policy_topic(value["policy_topic"])
            if "reason_code" in value and value["reason_code"]:
                rc = str(value["reason_code"]).strip()
                if len(rc) > 100:
                    rc = rc[:97] + "..."
                value["reason_code"] = rc
            if value.get("route") in (Route.ESCALATE, "ESCALATE"):
                if not value.get("decision_question"):
                    value["decision_question"] = "Giảng viên có xem xét và phê duyệt yêu cầu này không?"
                if not value.get("escalation_target"):
                    value["escalation_target"] = EscalationTarget.COURSE_LECTURER
        return value

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
            PolicyCoverage.SUSPICIOUS: Route.REJECT,
            PolicyCoverage.AI_UNAVAILABLE: Route.ESCALATE,
            PolicyCoverage.UNRESOLVED: Route.ESCALATE,
        }
        if self.route != expected_routes[self.policy_coverage]:
            raise ValueError("route is inconsistent with policy_coverage")
        if self.route == Route.ANSWER:
            if not self.answer:
                raise ValueError("ANSWER requires answer")
            if (
                not self.citation_labels
                and self.policy_coverage != PolicyCoverage.APPLICABLE_EXCEPTION
            ):
                raise ValueError("ANSWER requires at least one citation")
        elif self.route == Route.CLARIFY:
            if not self.clarifying_question:
                raise ValueError("CLARIFY requires clarifying_question")
            if self.answer:
                raise ValueError("CLARIFY cannot include a definitive answer")
        elif self.route == Route.ESCALATE and not self.decision_question:
            raise ValueError("ESCALATE requires decision_question")
        elif self.route in (Route.OUT_OF_SCOPE, Route.REJECT) and not self.answer:
            raise ValueError(f"{self.route} requires a user-facing answer")
        if self.policy_coverage == PolicyCoverage.APPLICABLE_EXCEPTION:
            if not self.applied_exception_id:
                raise ValueError("APPLICABLE_EXCEPTION requires applied_exception_id")
        elif self.applied_exception_id is not None:
            raise ValueError("applied_exception_id is only allowed for APPLICABLE_EXCEPTION")
        if self.route == Route.ESCALATE and self.escalation_target not in (
            None,
            EscalationTarget.COURSE_LECTURER,
        ):
            raise ValueError("ESCALATE must target the course lecturer in the demo")
        return self


class AIHealth(BaseModel):
    mode: str
    available: bool
    model: str
    detail: str | None = None

