from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.base import AIProvider
from app.api.deps import get_ai_provider, get_current_actor
from app.core.auth import CurrentActor, effective_actor_id, production_auth_enabled, require_role
from app.core.enums import ActorRole, QuestionStatus
from app.core.errors import AppError
from app.db.session import get_session
from app.models import Question
from app.schemas.questions import (
    ClarificationCreate,
    DashboardCounts,
    QuestionCreate,
    QuestionResponse,
)
from app.services.audit import add_audit_event
from app.services.questions import (
    dashboard_counts,
    get_question_response,
    list_questions_response,
    submit_question,
)

router = APIRouter()


@router.get("/counts", response_model=DashboardCounts)
async def get_dashboard_counts(
    current: CurrentActor = Depends(get_current_actor),
    session: AsyncSession = Depends(get_session),
) -> DashboardCounts:
    return await dashboard_counts(session)


@router.get("", response_model=list[QuestionResponse])
async def list_questions(
    actor_id: str | None = None,
    course_id: str | None = None,
    group_id: str | None = None,
    limit: int = Query(default=100, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    current: CurrentActor = Depends(get_current_actor),
    session: AsyncSession = Depends(get_session),
) -> list[QuestionResponse]:
    if production_auth_enabled() and current.role == ActorRole.STUDENT:
        actor_id = effective_actor_id(current, actor_id)
    return await list_questions_response(
        session,
        actor_id=actor_id,
        course_id=course_id,
        group_id=group_id,
        limit=limit,
        offset=offset,
    )


@router.post("", response_model=QuestionResponse, status_code=201)
async def create_question(
    payload: QuestionCreate,
    request: Request,
    session: AsyncSession = Depends(get_session),
    provider: AIProvider = Depends(get_ai_provider),
    current: CurrentActor = Depends(get_current_actor),
) -> QuestionResponse:
    require_role(current, ActorRole.STUDENT)
    payload = payload.model_copy(update={"actor_id": effective_actor_id(current, payload.actor_id)})
    return await submit_question(
        session,
        payload,
        provider=provider,
        request_id=request.state.request_id,
    )


@router.get("/{question_id}", response_model=QuestionResponse)
async def get_question(
    question_id: str,
    current: CurrentActor = Depends(get_current_actor),
    session: AsyncSession = Depends(get_session),
) -> QuestionResponse:
    question = await session.get(Question, question_id)
    if question is None:
        raise AppError("QUESTION_NOT_FOUND", "Không tìm thấy câu hỏi.", status_code=404)
    if production_auth_enabled() and current.role == ActorRole.STUDENT and question.actor_id != current.id:
        raise AppError("QUESTION_NOT_AUTHORIZED", "Không có quyền xem câu hỏi này.", status_code=403)
    return await get_question_response(session, question_id)


@router.post("/{question_id}/clarifications", response_model=QuestionResponse, status_code=201)
async def clarify_question(
    question_id: str,
    payload: ClarificationCreate,
    request: Request,
    session: AsyncSession = Depends(get_session),
    provider: AIProvider = Depends(get_ai_provider),
    current: CurrentActor = Depends(get_current_actor),
) -> QuestionResponse:
    original = await session.get(Question, question_id)
    if original is None:
        raise AppError("QUESTION_NOT_FOUND", "Không tìm thấy câu hỏi.", status_code=404)
    require_role(current, ActorRole.STUDENT)
    if production_auth_enabled() and original.actor_id != current.id:
        raise AppError("QUESTION_NOT_AUTHORIZED", "Không có quyền bổ sung câu hỏi này.", status_code=403)
    if original.status != QuestionStatus.CLARIFICATION_REQUIRED:
        raise AppError(
            "CLARIFICATION_NOT_EXPECTED",
            "Câu hỏi này không chờ thông tin bổ sung.",
            status_code=409,
        )
    if original.group_id and payload.group_id and original.group_id != payload.group_id:
        raise AppError(
            "CLARIFICATION_GROUP_MISMATCH",
            "Không thể đổi nhóm trong cùng một lượt hỏi bổ sung.",
            status_code=422,
        )
    selected_group_id = payload.group_id or original.group_id
    child = await submit_question(
        session,
        QuestionCreate(
            actor_id=original.actor_id,
            course_id=original.course_id,
            group_id=selected_group_id,
            text=f"{original.text}\nThông tin bổ sung: {payload.text}",
        ),
        provider=provider,
        request_id=request.state.request_id,
        parent_question_id=original.id,
        clarification_round=original.clarification_round + 1,
    )
    original.status = QuestionStatus.CLARIFICATION_RECEIVED
    add_audit_event(
        session,
        event_type="CLARIFICATION_RESPONSE_RECEIVED",
        actor_id=original.actor_id,
        entity_type="question",
        entity_id=original.id,
        request_id=request.state.request_id,
        output_snapshot={"child_question_id": child.question_id},
    )
    await session.commit()
    return child
