from typing import Protocol

from app.schemas.format_checks import FormatSemanticJudgment
from app.schemas.referee import AIHealth, RefereeDecision


class AIProvider(Protocol):
    async def embed(
        self,
        texts: list[str],
        *,
        task_type: str = "RETRIEVAL_DOCUMENT",
    ) -> list[list[float]]: ...

    async def decide(
        self,
        question: str,
        actor_context: dict,
        evidence: list[dict],
        applicable_exceptions: list[dict],
    ) -> RefereeDecision: ...

    async def judge_format_ambiguity(
        self,
        rule_type: str,
        expected_items: list[str],
        actual_items: list[str],
        criterion_name: str,
        source_citation: str,
    ) -> FormatSemanticJudgment: ...

    async def health(self) -> AIHealth: ...
