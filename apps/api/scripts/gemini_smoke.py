import asyncio

from app.ai.factory import build_ai_provider
from app.core.config import get_settings


async def main() -> None:
    settings = get_settings()
    provider = build_ai_provider(settings)
    health = await provider.health()
    if health.mode != "gemini" or not health.available:
        raise RuntimeError(f"Gemini is not configured: {health.detail}")

    policy = "Mỗi nhóm đồ án có từ 3 đến 5 sinh viên."
    vectors = await provider.embed([policy], task_type="RETRIEVAL_DOCUMENT")
    if len(vectors) != 1 or len(vectors[0]) != 768:
        raise RuntimeError("Gemini embedding did not return exactly 768 dimensions")

    decision = await provider.decide(
        "Một nhóm đồ án có bao nhiêu thành viên?",
        {
            "actor_id": "student-a1",
            "group_id": "group-a",
            "course_id": "CO3001",
            "semester": "261",
        },
        [
            {
                "label": "C1",
                "chunk_id": "smoke-policy",
                "content": policy,
            }
        ],
        [],
    )
    print(f"Gemini model: {settings.gemini_chat_model}")
    print(f"Embedding model: {settings.gemini_embed_model}")
    print(f"Embedding dimensions: {len(vectors[0])}")
    print(f"Decision route: {decision.route}")
    print(f"Citation labels: {','.join(decision.citation_labels)}")
    print("Gemini smoke: PASS")


if __name__ == "__main__":
    asyncio.run(main())
