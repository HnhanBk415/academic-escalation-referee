from app.schemas.format_checks import FormatSemanticJudgment
from app.schemas.referee import AIHealth, RefereeDecision


class UnavailableProvider:
    def __init__(self, mode: str, detail: str) -> None:
        self.mode = mode
        self.detail = detail

    async def embed(
        self,
        texts: list[str],
        *,
        task_type: str = "RETRIEVAL_DOCUMENT",
    ) -> list[list[float]]:
        raise RuntimeError(self.detail)

    async def decide(
        self,
        question: str,
        actor_context: dict,
        evidence: list[dict],
        applicable_exceptions: list[dict],
    ) -> RefereeDecision:
        raise RuntimeError(self.detail)

    async def judge_format_ambiguity(
        self,
        rule_type: str,
        expected_items: list[str],
        actual_items: list[str],
        criterion_name: str,
        source_citation: str,
    ) -> FormatSemanticJudgment:
        # AI not configured — stay ambiguous so human reviewer picks it up.
        return FormatSemanticJudgment(
            verdict="AMBIGUOUS",
            reason=f"AI không khả dụng ({self.detail}); cần giảng viên phán đoán.",
        )

    async def judge_cover_page(
        self,
        first_page_text: str,
        required_elements: list[str],
    ) -> "CoverPageJudgment":
        from app.schemas.format_checks import CoverPageJudgment

        return CoverPageJudgment(
            is_cover_page=False,
            detected_elements=[],
            missing_elements=required_elements,
            reason=f"AI không khả dụng ({self.detail}); cần giảng viên phán đoán trang bìa.",
        )

    async def extract_regulation_criteria(
        self,
        regulation_text: str,
        allow_semantic_equivalent: bool = True,
    ) -> list["FormatCriterionInput"]:
        return []

    async def extract_submission_content_facts(
        self,
        full_text: str,
        cover_text: str,
    ) -> "LLMSubmissionContentFacts":
        from app.schemas.format_checks import LLMSubmissionContentFacts
        return LLMSubmissionContentFacts()

    async def health(self) -> AIHealth:
        return AIHealth(
            mode=self.mode,
            available=False,
            model="unavailable",
            detail=self.detail,
        )
