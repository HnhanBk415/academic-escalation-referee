from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.base import AIProvider
from app.api.deps import get_ai_provider
from app.core.errors import AppError
from app.db.session import get_session
from app.models import Question
from app.schemas.questions import (
    ClarificationCreate,
    DashboardCounts,
    QuestionCreate,
    QuestionResponse,
)
from app.services.questions import (
    dashboard_counts,
    get_question_response,
    list_questions_response,
    submit_question,
)

router = APIRouter()


@router.get("/counts", response_model=DashboardCounts)
async def get_dashboard_counts(
    session: AsyncSession = Depends(get_session),
) -> DashboardCounts:
    return await dashboard_counts(session)


@router.get("", response_model=list[QuestionResponse])
async def list_questions(
    actor_id: str | None = None,
    course_id: str | None = None,
    limit: int = Query(default=100, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    session: AsyncSession = Depends(get_session),
) -> list[QuestionResponse]:
    return await list_questions_response(
        session,
        actor_id=actor_id,
        course_id=course_id,
        limit=limit,
        offset=offset,
    )


@router.post("", response_model=QuestionResponse, status_code=201)
async def create_question(
    payload: QuestionCreate,
    request: Request,
    session: AsyncSession = Depends(get_session),
    provider: AIProvider = Depends(get_ai_provider),
) -> QuestionResponse:
    return await submit_question(
        session,
        payload,
        provider=provider,
        request_id=request.state.request_id,
    )


@router.get("/{question_id}", response_model=QuestionResponse)
async def get_question(
    question_id: str,
    session: AsyncSession = Depends(get_session),
) -> QuestionResponse:
    return await get_question_response(session, question_id)


@router.post("/{question_id}/clarifications", response_model=QuestionResponse, status_code=201)
async def clarify_question(
    question_id: str,
    payload: ClarificationCreate,
    request: Request,
    session: AsyncSession = Depends(get_session),
    provider: AIProvider = Depends(get_ai_provider),
) -> QuestionResponse:
    original = await session.get(Question, question_id)
    if original is None:
        raise AppError("QUESTION_NOT_FOUND", "Không tìm thấy câu hỏi.", status_code=404)
    if original.status != "CLARIFICATION_REQUIRED":
        raise AppError(
            "CLARIFICATION_NOT_EXPECTED",
            "Câu hỏi này không chờ thông tin bổ sung.",
            status_code=409,
        )
    return await submit_question(
        session,
        QuestionCreate(
            actor_id=original.actor_id,
            course_id=original.course_id,
            text=f"{original.text}\nThông tin bổ sung: {payload.text}",
        ),
        provider=provider,
        request_id=request.state.request_id,
    )

