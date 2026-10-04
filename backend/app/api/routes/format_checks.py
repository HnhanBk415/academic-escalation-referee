from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, Request, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

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
async def get_criteria(course_id: str, session: SessionDependency) -> list[FormatCriteriaSetResponse]:
    return await list_criteria_sets(session, course_id)


@router.post("/criteria/drafts", response_model=FormatCriteriaSetResponse, status_code=201)
async def create_criteria_draft(payload: FormatCriteriaDraftCreate, request: Request, session: SessionDependency) -> FormatCriteriaSetResponse:
    return await create_draft(session, payload, request.state.request_id)


@router.post("/criteria/drafts/from-documents", response_model=FormatCriteriaSetResponse, status_code=201)
async def create_document_draft(payload: FormatDraftFromDocumentsCreate, request: Request, session: SessionDependency) -> FormatCriteriaSetResponse:
    return await draft_from_documents(session, payload, request.state.request_id)


@router.post("/criteria/{criteria_set_id}/approve", response_model=FormatCriteriaSetResponse)
async def approve_criteria(criteria_set_id: str, lecturer_id: str, request: Request, session: SessionDependency) -> FormatCriteriaSetResponse:
    return await approve_criteria_set(session, criteria_set_id, lecturer_id, request.state.request_id)


@router.post("/checks", response_model=FormatCheckResponse)
async def submit_check(
    request: Request,
    session: SessionDependency,
    course_id: Annotated[str, Form(...)],
    actor_id: Annotated[str, Form()] = "demo-student",
    file: UploadFile = File(...),
) -> FormatCheckResponse:
    return await check_format(
        session,
        course_id=course_id,
        actor_id=actor_id,
        filename=file.filename or "submission",
        payload=await file.read(),
        request_id=request.state.request_id,
    )


@router.get("/reviews", response_model=list[FormatReviewCaseResponse])
async def get_reviews(course_id: str, lecturer_id: str, session: SessionDependency) -> list[FormatReviewCaseResponse]:
    return await list_review_cases(session, course_id, lecturer_id)


@router.get("/reviews/student", response_model=list[FormatReviewCaseResponse])
async def get_student_reviews(course_id: str, actor_id: str, session: SessionDependency) -> list[FormatReviewCaseResponse]:
    return await list_student_review_cases(session, course_id, actor_id)


@router.post("/reviews/{review_id}/decision", response_model=FormatReviewCaseResponse)
async def decide_review(review_id: str, payload: FormatReviewDecisionCreate, request: Request, session: SessionDependency) -> FormatReviewCaseResponse:
    return await decide_review_case(session, review_id, payload, request.state.request_id)


@router.get("/metrics", response_model=list[FormatMetricResponse])
async def get_metrics(course_id: str, lecturer_id: str, session: SessionDependency) -> list[FormatMetricResponse]:
    return await format_metrics(session, course_id, lecturer_id)
