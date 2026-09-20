from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.core.enums import DocumentStatus


class DocumentCreate(BaseModel):
    id: str = Field(pattern=r"^[a-zA-Z0-9_-]+$", max_length=64)
    course_id: str
    title: str = Field(min_length=3, max_length=300)
    document_type: Literal["MARKDOWN", "TXT", "PDF"]
    source_path: str = Field(min_length=1, max_length=500)
    version: str = Field(min_length=1, max_length=64)
    effective_from: date | None = None
    effective_until: date | None = None


class DocumentResponse(BaseModel):
    id: str
    course_id: str
    title: str
    document_type: str
    source_path: str
    version: str
    status: DocumentStatus
    effective_from: date | None
    effective_until: date | None
    content_hash: str
    chunk_count: int = 0
    created_at: datetime


class IngestResponse(BaseModel):
    document_id: str
    status: DocumentStatus
    chunk_count: int
    content_hash: str
    embedding_dimensions: int
    idempotent: bool
