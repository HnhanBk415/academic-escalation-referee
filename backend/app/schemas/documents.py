from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.core.enums import DocumentStatus


class DocumentCreate(BaseModel):
    id: str = Field(pattern=r"^[a-zA-Z0-9_-]+$", max_length=64)
    course_id: str
    title: str = Field(min_length=3, max_length=300)
    document_type: Literal["MARKDOWN", "TXT", "PDF", "DOCX", "IMAGE"]
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
    supersedes_document_id: str | None = None
    chunk_count: int = 0
    created_at: datetime


class IngestResponse(BaseModel):
    document_id: str
    status: DocumentStatus
    chunk_count: int
    content_hash: str
    embedding_dimensions: int
    idempotent: bool


class ReviewItemResponse(BaseModel):
    id: str
    item_index: int
    predicted_text: str
    confirmed_text: str | None
    confidence: float
    context_before: str
    context_after: str
    page_number: int | None
    crop_url: str | None
    status: str


class ProcessingResponse(BaseModel):
    id: str
    document: DocumentResponse
    original_filename: str | None
    original_path: str | None
    extraction_method: str
    status: str
    confidence_threshold: float
    raw_text: str
    clean_text: str | None
    error_message: str | None
    review_items: list[ReviewItemResponse]
    pending_review_count: int
    created_at: datetime


class ReviewItemUpdate(BaseModel):
    confirmed_text: str = Field(min_length=0, max_length=5000)
    keep_prediction: bool = False


class ProcessingCreate(BaseModel):
    """JSON alternative to multipart upload for direct, local text entry."""

    course_id: str
    title: str = Field(min_length=3, max_length=300)
    version: str = Field(min_length=1, max_length=64)
    text_content: str = Field(min_length=1, max_length=1_000_000)
    effective_from: date | None = None
    effective_until: date | None = None
    supersedes_document_id: str | None = None
    confidence_threshold: float = Field(default=0.80, ge=0.0, le=1.0)


class ProcessingFinalize(BaseModel):
    operation: Literal["ADD", "REPLACE", "REVOKE", "CLARIFY"] = "ADD"
    policy_topic: str = Field(default="GENERAL", min_length=1, max_length=100)
    scope_type: Literal["COURSE", "GROUP", "STUDENT"] = "COURSE"
    scope_id: str | None = Field(default=None, max_length=64)
    valid_from: date | None = None
    valid_until: date | None = None
    supersedes_policy_update_id: str | None = None
