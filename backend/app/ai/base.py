from typing import Any, Protocol

from app.schemas.format_checks import (
    CoverPageJudgment,
    FormatCriterionInput,
    FormatSemanticJudgment,
    LLMSubmissionContentFacts,
)
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

    async def judge_cover_page(
        self,
        first_page_text: str,
        required_elements: list[str],
    ) -> CoverPageJudgment: ...

    async def extract_regulation_criteria(
        self,
        regulation_text: str,
        allow_semantic_equivalent: bool = True,
    ) -> list[FormatCriterionInput]: ...

    async def extract_submission_content_facts(
        self,
        full_text: str,
        cover_text: str,
    ) -> LLMSubmissionContentFacts: ...

    async def health(self) -> AIHealth: ...


