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

    async def health(self) -> AIHealth:
        return AIHealth(
            mode=self.mode,
            available=False,
            model="unavailable",
            detail=self.detail,
        )
