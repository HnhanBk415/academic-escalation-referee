from functools import lru_cache
from typing import Any, Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "../../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_env: str = "development"
    database_url: str = "sqlite+aiosqlite:///./aer.db"
    port: int = 8000

    ai_mode: Literal["fake", "gemini"] = "fake"
    gemini_api_key: str = ""
    gemini_chat_model: str = "gemini-2.5-flash"
    gemini_embed_model: str = "gemini-embedding-001"
    embedding_dimensions: int = 768
    ai_request_timeout_seconds: float = 60
    ai_max_concurrency: int = 1

    rag_top_k: int = 8
    rag_context_chunks: int = 5
    rag_min_score: float = 0.15
    prompt_version: str = "referee-v2"
    public_base_url: str = "http://localhost:8000"
    cors_origins: list[str] = Field(default_factory=lambda: ["http://localhost:5173", "http://localhost:8000"])

    @field_validator("database_url", mode="before")
    @classmethod
    def clean_database_url(cls, v: Any) -> Any:
        if isinstance(v, str):
            return v.strip().replace("\r", "").replace("\n", "")
        return v

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, v: Any) -> list[str]:
        if isinstance(v, str):
            v_clean = v.strip()
            if v_clean.startswith("[") and v_clean.endswith("]"):
                import json
                return json.loads(v_clean)
            return [origin.strip() for origin in v_clean.split(",") if origin.strip()]
        return v


@lru_cache
def get_settings() -> Settings:
    return Settings()
