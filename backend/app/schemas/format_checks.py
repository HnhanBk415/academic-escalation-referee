from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, Field, model_validator

from app.core.enums import (
    FormatCheckOverallStatus,
    FormatCriteriaSetStatus,
    FormatCriterionResultStatus,
    FormatCriterionRuleType,
    FormatReviewStatus,
)


class FormatCriterionInput(BaseModel):
    name: str = Field(min_length=2, max_length=300)
    description: str = Field(min_length=2, max_length=4000)
    rule_type: FormatCriterionRuleType
    expected_value: dict[str, Any] = Field(default_factory=dict)
    source_citation: str | None = Field(default=None, max_length=4000)
    source_document_id: str | None = None
    review_only: bool = False


class FormatCriteriaDraftCreate(BaseModel):
    course_id: str
    lecturer_id: str
    title: str = Field(min_length=2, max_length=300)
    criteria: list[FormatCriterionInput] = Field(default_factory=list, max_length=100)
    source_document_ids: list[str] = Field(default_factory=list, max_length=30)


class FormatDraftFromDocumentsCreate(BaseModel):
    course_id: str
    lecturer_id: str
    title: str = Field(min_length=2, max_length=300)
    document_ids: list[str] = Field(min_length=1, max_length=30)
    include_template_structure: bool = False
    allow_semantic_equivalent: bool = True


class FormatCriterionResponse(FormatCriterionInput):
    id: str
    position: int
    automatable: bool


class FormatCriteriaSetResponse(BaseModel):
    id: str
    course_id: str
    version: int
    title: str
    status: FormatCriteriaSetStatus
    source_document_ids: list[str]
    created_by: str
    approved_by: str | None
    approved_at: datetime | None
    created_at: datetime
    criteria: list[FormatCriterionResponse]


class FormatCriterionResult(BaseModel):
    criterion_id: str
    name: str
    status: FormatCriterionResultStatus
    message: str
    expected_value: dict[str, Any]
    actual_value: dict[str, Any] | None = None
    source_citation: str | None = None
    category: str | None = None
    evidence: str | None = None
    suggestion: str | None = None


class FormatCheckResponse(BaseModel):
    overall_status: FormatCheckOverallStatus
    message: str
    criteria_set_id: str | None = None
    criteria_version: int | None = None
    criteria_approved_at: datetime | None = None
    results: list[FormatCriterionResult] = Field(default_factory=list)
    review_case_id: str | None = None
    checklist_summary: list[dict[str, Any]] | None = None
    report_facts: dict[str, Any] | None = None


class FormatReviewDecisionCreate(BaseModel):
    reviewer_id: str
    decision: FormatReviewStatus
    reason: str = Field(min_length=3, max_length=4000)

    @model_validator(mode="after")
    def only_terminal_decisions(self) -> "FormatReviewDecisionCreate":
        if self.decision == FormatReviewStatus.UNDER_REVIEW:
            raise ValueError("A review decision must accept the presentation or require a fix")
        return self


class FormatReviewCaseResponse(BaseModel):
    id: str
    course_id: str
    criteria_set_id: str
    actor_id: str
    filename: str
    extracted_snapshot: dict[str, Any]
    ambiguous_results: list[dict[str, Any]]
    status: FormatReviewStatus
    decision_reason: str | None
    decided_at: datetime | None
    expires_at: datetime
    created_at: datetime


class FormatMetricResponse(BaseModel):
    course_id: str
    metric_date: date
    total_checks: int
    passed_checks: int
    needs_fix_checks: int
    unable_to_check_checks: int


class FormatSemanticJudgment(BaseModel):
    """Result of an AI semantic equivalence check for an ambiguous format criterion."""

    verdict: str  # "PASS" | "FAIL" | "AMBIGUOUS"
    reason: str   # Short Vietnamese explanation (≤ 200 chars)
