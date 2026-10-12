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

    async def health(self) -> AIHealth:
        return AIHealth(
            mode=self.mode,
            available=False,
            model="unavailable",
            detail=self.detail,
        )
