from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, Request, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.base import AIProvider
from app.api.deps import get_ai_provider, get_current_actor
from app.core.auth import (
    CurrentActor,
    effective_actor_id,
    production_auth_enabled,
    require_role,
)
from app.core.enums import ActorRole
from app.db.session import get_session
from app.schemas.format_checks import (
    FormatCheckResponse,
    FormatCriteriaDraftCreate,
    FormatCriteriaSetResponse,
    FormatDraftFromDocumentsCreate,
    FormatMetricResponse,
    FormatReviewCaseResponse,
    FormatReviewDecisionCreate,
)
from app.services.format_checks import (
    approve_criteria_set,
    check_format,
    create_draft,
    decide_review_case,
    draft_from_documents,
    format_metrics,
    list_criteria_sets,
    list_review_cases,
    list_student_review_cases,
)

router = APIRouter()
SessionDependency = Annotated[AsyncSession, Depends(get_session)]


@router.get("/criteria", response_model=list[FormatCriteriaSetResponse])
async def get_criteria(
    course_id: str,
    session: SessionDependency,
    report_type: str | None = None,
    current: CurrentActor = Depends(get_current_actor),
) -> list[FormatCriteriaSetResponse]:
    return await list_criteria_sets(
        session,
        course_id,
        report_type=report_type,
        active_only=production_auth_enabled() and current.role == ActorRole.STUDENT,
    )


@router.post("/criteria/drafts", response_model=FormatCriteriaSetResponse, status_code=201)
async def create_criteria_draft(payload: FormatCriteriaDraftCreate, request: Request, session: SessionDependency, current: CurrentActor = Depends(get_current_actor)) -> FormatCriteriaSetResponse:
    require_role(current, ActorRole.LECTURER)
    payload = payload.model_copy(update={"lecturer_id": effective_actor_id(current, payload.lecturer_id)})
    return await create_draft(session, payload, request.state.request_id)


@router.post("/criteria/drafts/from-documents", response_model=FormatCriteriaSetResponse, status_code=201)
async def create_document_draft(
    payload: FormatDraftFromDocumentsCreate,
    request: Request,
    session: SessionDependency,
    provider: AIProvider = Depends(get_ai_provider),
    current: CurrentActor = Depends(get_current_actor),
) -> FormatCriteriaSetResponse:
    require_role(current, ActorRole.LECTURER)
    payload = payload.model_copy(update={"lecturer_id": effective_actor_id(current, payload.lecturer_id)})
    return await draft_from_documents(session, payload, request.state.request_id, ai=provider)


@router.post("/criteria/{criteria_set_id}/approve", response_model=FormatCriteriaSetResponse)
async def approve_criteria(criteria_set_id: str, lecturer_id: str, request: Request, session: SessionDependency, current: CurrentActor = Depends(get_current_actor)) -> FormatCriteriaSetResponse:
    require_role(current, ActorRole.LECTURER)
    return await approve_criteria_set(session, criteria_set_id, effective_actor_id(current, lecturer_id), request.state.request_id)


@router.post("/checks", response_model=FormatCheckResponse)
async def submit_check(
    request: Request,
    session: SessionDependency,
    course_id: Annotated[str, Form(...)],
    actor_id: Annotated[str, Form()] = "demo-student",
    report_type: Annotated[str, Form()] = "default",
    file: UploadFile = File(...),
    provider=Depends(get_ai_provider),
    current: CurrentActor = Depends(get_current_actor),
) -> FormatCheckResponse:
    require_role(current, ActorRole.STUDENT)
    return await check_format(
        session,
        course_id=course_id,
        actor_id=effective_actor_id(current, actor_id),
        report_type=report_type,
        filename=file.filename or "submission",
        payload=await file.read(),
        request_id=request.state.request_id,
        ai=provider,
    )


@router.get("/reviews", response_model=list[FormatReviewCaseResponse])
async def get_reviews(course_id: str, lecturer_id: str, session: SessionDependency, current: CurrentActor = Depends(get_current_actor)) -> list[FormatReviewCaseResponse]:
    require_role(current, ActorRole.LECTURER)
    return await list_review_cases(session, course_id, effective_actor_id(current, lecturer_id))


@router.get("/reviews/student", response_model=list[FormatReviewCaseResponse])
async def get_student_reviews(course_id: str, actor_id: str, session: SessionDependency, current: CurrentActor = Depends(get_current_actor)) -> list[FormatReviewCaseResponse]:
    require_role(current, ActorRole.STUDENT)
    return await list_student_review_cases(session, course_id, effective_actor_id(current, actor_id))


@router.post("/reviews/{review_id}/decision", response_model=FormatReviewCaseResponse)
async def decide_review(review_id: str, payload: FormatReviewDecisionCreate, request: Request, session: SessionDependency, current: CurrentActor = Depends(get_current_actor)) -> FormatReviewCaseResponse:
    require_role(current, ActorRole.LECTURER)
    payload = payload.model_copy(update={"reviewer_id": effective_actor_id(current, payload.reviewer_id)})
    return await decide_review_case(session, review_id, payload, request.state.request_id)


@router.get("/metrics", response_model=list[FormatMetricResponse])
async def get_metrics(course_id: str, lecturer_id: str, session: SessionDependency, current: CurrentActor = Depends(get_current_actor)) -> list[FormatMetricResponse]:
    require_role(current, ActorRole.LECTURER)
    return await format_metrics(session, course_id, effective_actor_id(current, lecturer_id))
