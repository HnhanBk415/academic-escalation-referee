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


class CoverPageJudgment(BaseModel):
    """Result of an AI model assessment of a report's cover page."""

    is_cover_page: bool = Field(description="True nếu văn bản trang đầu chứa cấu trúc trang bìa học thuật hợp lệ")
    detected_elements: list[str] = Field(default_factory=list, description="Các thành phần trang bìa phát hiện được")
    missing_elements: list[str] = Field(default_factory=list, description="Các thành phần bắt buộc chưa tìm thấy")
    reason: str = Field(default="", description="Nhận xét tóm tắt bằng tiếng Việt (≤ 200 ký tự)")


class LLMSubmissionContentFacts(BaseModel):
    """Structured content elements extracted by LLM from student report text."""

    cover_page_detected_fields: list[str] = Field(
        default_factory=list,
        description="Các trường thông tin tìm thấy ở trang bìa: tên trường, tên khoa, tên đề tài, GVHD, sinh viên, MSSV, năm thực hiện...",
    )
    headings: list[str] = Field(
        default_factory=list,
        description="Danh sách các tiêu đề chương và mục con xuất hiện trong bài nộp",
    )
    has_member_contribution_table: bool = Field(
        default=False,
        description="True nếu có bảng phân công đóng góp thành viên / lời cam đoan",
    )
    member_table_columns: list[str] = Field(
        default_factory=list,
        description="Các tên cột tìm thấy trong bảng phân công thành viên (ví dụ: STT, Họ và tên, MSSV, Nhiệm vụ, Tỷ lệ đóng góp, Chữ ký...)",
    )
    has_table_of_contents: bool = Field(
        default=False,
        description="True nếu có phần Mục lục",
    )
    has_list_of_figures: bool = Field(
        default=False,
        description="True nếu có Danh mục hình ảnh",
    )
    has_list_of_tables: bool = Field(
        default=False,
        description="True nếu có Danh mục bảng biểu",
    )
    has_references_section: bool = Field(
        default=False,
        description="True nếu có phần Tài liệu tham khảo",
    )
    references_style: str | None = Field(
        default=None,
        description="Chuẩn trích dẫn nếu nhận diện được (ví dụ IEEE, APA)",
    )
    table_captions: list[str] = Field(
        default_factory=list,
        description="Danh sách các tiêu đề/chú thích bảng biểu trong văn bản",
    )
    figure_captions: list[str] = Field(
        default_factory=list,
        description="Danh sách các tiêu đề/chú thích hình ảnh trong văn bản",
    )


class LLMCriterionItem(BaseModel):
    name: str = Field(description="Tên tiêu chí kèm số thứ tự (ví dụ: '1. Khổ giấy và thiết lập căn lề', '4.1 Mục bắt buộc: Chương 1: Khái niệm')")
    description: str = Field(description="Mô tả chi tiết yêu cầu được nêu trong quy chế")
    rule_type: str = Field(description="'MEASUREMENT' hoặc 'PRESENCE' hoặc 'TEMPLATE'")
    expected_value_json: str = Field(description="JSON string của thông số kiểm tra")
    source_citation: str = Field(default="", description="Đoạn trích nguyên văn làm căn cứ trong tài liệu")


class LLMCriteriaExtraction(BaseModel):
    criteria: list[LLMCriterionItem] = Field(default_factory=list, description="Danh sách các tiêu chí thể thức và đề cương trích xuất từ quy chế")


class LLMBatchCriterionJudgment(BaseModel):
    criterion_id: str = Field(description="ID của tiêu chí cần đánh giá")
    verdict: str = Field(description="'PASS', 'AMBIGUOUS', 'FAIL', hoặc 'MISSING_STUDENT_INPUT'")
    reason: str = Field(description="Giải thích ngắn gọn bằng tiếng Việt (≤ 200 ký tự)")
    detected_element: str | None = Field(default=None, description="Thành phần/đề mục tương ứng tìm thấy trong bài nộp")


class LLMBatchReviewResponse(BaseModel):
    judgments: list[LLMBatchCriterionJudgment] = Field(
        default_factory=list,
        description="Danh sách kết quả rà soát đồng loạt cho các tiêu chí ngữ nghĩa",
    )



