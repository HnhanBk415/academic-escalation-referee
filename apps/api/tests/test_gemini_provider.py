from types import SimpleNamespace

import pytest

from app.ai.factory import build_ai_provider
from app.ai.gemini import GeminiProvider
from app.ai.unavailable import UnavailableProvider
from app.core.config import Settings
from app.schemas.referee import RefereeDecision


class FakeGeminiModels:
    def __init__(self) -> None:
        self.embed_kwargs = None
        self.generate_kwargs = None

    async def embed_content(self, **kwargs):  # type: ignore[no-untyped-def]
        self.embed_kwargs = kwargs
        count = len(kwargs["contents"])
        return SimpleNamespace(
            embeddings=[SimpleNamespace(values=[0.25] * 768) for _ in range(count)]
        )

    async def generate_content(self, **kwargs):  # type: ignore[no-untyped-def]
        self.generate_kwargs = kwargs
        return SimpleNamespace(
            parsed={
                "route": "ANSWER",
                "uncertainty_type": "NONE",
                "reason_code": "POLICY_GROUNDED_ANSWER",
                "answer": "Mỗi nhóm có từ 3 đến 5 sinh viên.",
                "clarifying_question": None,
                "decision_question": None,
                "citation_labels": ["C1"],
                "confidence": 0.95,
            }
        )


def gemini_settings() -> Settings:
    return Settings(
        _env_file=None,
        ai_mode="gemini",
        gemini_api_key="test-key",
        embedding_dimensions=768,
    )


@pytest.mark.asyncio
async def test_gemini_provider_requests_768_dimensions_and_structured_output():
    provider = GeminiProvider(gemini_settings())
    models = FakeGeminiModels()
    provider.client = SimpleNamespace(aio=SimpleNamespace(models=models))

    vectors = await provider.embed(["policy", "rubric"])
    assert len(vectors) == 2
    assert all(len(vector) == 768 for vector in vectors)
    assert models.embed_kwargs["config"].output_dimensionality == 768

    decision = await provider.decide(
        "Một nhóm có bao nhiêu người?",
        {"course_id": "CO3001"},
        [{"label": "C1", "content": "Mỗi nhóm có từ 3 đến 5 sinh viên."}],
        [],
    )
    assert isinstance(decision, RefereeDecision)
    assert decision.route == "ANSWER"
    assert models.generate_kwargs["config"].response_schema is RefereeDecision


@pytest.mark.asyncio
async def test_missing_gemini_key_builds_safe_unavailable_provider():
    provider = build_ai_provider(
        Settings(_env_file=None, ai_mode="gemini", gemini_api_key="")
    )
    assert isinstance(provider, UnavailableProvider)
    health = await provider.health()
    assert health.available is False
    assert health.mode == "gemini"
