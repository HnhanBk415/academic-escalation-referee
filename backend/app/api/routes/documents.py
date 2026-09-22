from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.base import AIProvider
from app.api.deps import get_ai_provider
from app.db.session import get_session
from app.ingestion.service import ingest_document
from app.schemas.documents import DocumentCreate, DocumentResponse, IngestResponse
from app.services.documents import (
    get_document_response,
    list_documents_response,
    register_document,
)

router = APIRouter()
SessionDependency = Annotated[AsyncSession, Depends(get_session)]
ProviderDependency = Annotated[AIProvider, Depends(get_ai_provider)]


@router.get("", response_model=list[DocumentResponse])
async def list_documents(
    session: SessionDependency,
    course_id: str | None = None,
) -> list[DocumentResponse]:
    return await list_documents_response(session, course_id=course_id)


@router.post("/sync", response_model=list[IngestResponse])
async def sync_documents(
    session: SessionDependency,
    provider: ProviderDependency,
) -> list[IngestResponse]:
    from app.ingestion.service import scan_and_sync_documents
    return await scan_and_sync_documents(session, provider=provider)


@router.post("", response_model=DocumentResponse, status_code=201)
async def create_document(
    payload: DocumentCreate,
    session: SessionDependency,
) -> DocumentResponse:
    return await register_document(session, payload)


@router.post("/{document_id}/ingest", response_model=IngestResponse)
async def ingest(
    document_id: str,
    session: SessionDependency,
    provider: ProviderDependency,
) -> IngestResponse:
    return await ingest_document(session, document_id, provider=provider)


@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: str,
    session: SessionDependency,
) -> DocumentResponse:
    return await get_document_response(session, document_id)
