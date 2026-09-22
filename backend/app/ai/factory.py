from app.ai.base import AIProvider
from app.ai.fake import FakeProvider
from app.ai.unavailable import UnavailableProvider
from app.core.config import Settings, get_settings


def build_ai_provider(settings: Settings | None = None) -> AIProvider:
    selected = settings or get_settings()
    if selected.ai_mode == "fake":
        return FakeProvider()
    if not selected.gemini_api_key:
        return UnavailableProvider("gemini", "GEMINI_API_KEY is not configured")
    from app.ai.gemini import GeminiProvider

    return GeminiProvider(selected)
