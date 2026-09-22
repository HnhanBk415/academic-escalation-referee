from functools import lru_cache
from typing import Literal, Union

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "../.env", "../../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_env: str = "development"
    database_url: str = "sqlite+aiosqlite:///./aer.db"

    ai_mode: Literal["fake", "gemini"] = "fake"
    gemini_api_key: str = ""
    gemini_chat_model: str = "gemini-3.6-flash"
    gemini_embed_model: str = "gemini-embedding-001"
    embedding_dimensions: int = 768
    ai_request_timeout_seconds: float = 30
    ai_max_concurrency: int = 1

    rag_top_k: int = 8
    rag_context_chunks: int = 5
    rag_min_score: float = 0.15
    prompt_version: str = "referee-v1"
    public_base_url: str = "http://localhost:8000"
    cors_origins: list[str] = Field(
        default_factory=lambda: [
            "http://localhost:5173",   # Vite dev server
            "http://localhost:3000",   # alternative dev port
            "http://localhost",        # Docker nginx on port 80
            "http://localhost:80",
        ]
    )

    @field_validator("cors_origins", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, list[str]]) -> list[str]:
        if isinstance(v, str):
            return [i.strip() for i in v.split(",") if i.strip()]
        return v


@lru_cache
def get_settings() -> Settings:
    return Settings()

