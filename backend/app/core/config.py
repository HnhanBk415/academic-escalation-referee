from functools import lru_cache
from typing import Literal

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "../.env", "../../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_env: str = "development"
    database_url: str = "sqlite+aiosqlite:///./aer.db"

    # `demo` preserves the hackathon's role-switching experience. A deployed
    # environment must use `password`; the API then derives identity from a
    # signed Bearer token rather than client-supplied actor ids.
    auth_mode: Literal["demo", "password"] = "demo"
    auth_secret_key: str = ""
    auth_users_json: str = ""
    auth_token_ttl_minutes: int = 480

    ai_mode: Literal["fake", "gemini"] = "fake"
    gemini_api_key: str = ""
    gemini_chat_model: str = "gemini-3.1-flash-lite"
    gemini_embed_model: str = "gemini-embedding-001"
    # The OCR/Vision client is intentionally separate from the RAG answer
    # provider. It never falls back to GEMINI_API_KEY.
    gemini_vision_api_key: str = ""
    gemini_vision_model: str = "gemini-3.8-flash"
    embedding_dimensions: int = 768
    ai_request_timeout_seconds: float = 30
    ai_max_concurrency: int = 1
    ai_health_cache_seconds: float = 45

    rag_top_k: int = 8
    rag_context_chunks: int = 5
    rag_min_score: float = 0.15
    # Uploaded originals and review crops remain in this local root. Image/PDF
    # bytes are additionally sent to Gemini only with the vision provider.
    local_document_storage_dir: str = "data/local-documents"
    ocr_confidence_threshold: float = 0.80
    upload_max_bytes: int = 25 * 1024 * 1024
    prompt_version: str = "referee-v3-structured-exceptions"
    public_base_url: str = "http://localhost:8000"
    cors_origins_raw: str = Field(
        default="http://localhost:5173,http://localhost:3000,http://localhost,http://localhost:80",
        validation_alias=AliasChoices("cors_origins", "CORS_ORIGINS", "cors_origins_raw"),
    )

    @property
    def cors_origins(self) -> list[str]:
        if not self.cors_origins_raw:
            return []
        raw = self.cors_origins_raw.strip()
        if raw.startswith("[") and raw.endswith("]"):
            try:
                import json
                items = json.loads(raw)
                return [str(i).strip() for i in items if str(i).strip()]
            except Exception:
                pass
        return [i.strip() for i in raw.split(",") if i.strip()]

@lru_cache
def get_settings() -> Settings:
    return Settings()
