from typing import Protocol

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

    async def health(self) -> AIHealth: ...
