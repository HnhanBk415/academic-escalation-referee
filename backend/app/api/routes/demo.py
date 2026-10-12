from fastapi import APIRouter, Depends, Request
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.factory import build_ai_provider
from app.api.deps import get_current_actor
from app.core.auth import CurrentActor, require_role
from app.core.enums import ActorRole
from app.core.errors import AppError
from app.db.session import get_session
from app.models import (
    Actor,
    Course,
    Document,
    DocumentChunk,
    EscalationCase,
    Group,
    GroupMembership,
    HumanDecision,
    PolicyException,
    Question,
    RetrievalEvidence,
)
from app.schemas.demo import (
    DemoCatalogResponse,
    DemoCourseResponse,
    DemoGroupResponse,
    DemoLecturerResponse,
)
from app.services.audit import add_audit_event

router = APIRouter()


@router.get("/catalog", response_model=DemoCatalogResponse)
async def get_demo_catalog(
    current: CurrentActor = Depends(get_current_actor),
    session: AsyncSession = Depends(get_session),
) -> DemoCatalogResponse:
    lecturer = await session.get(Actor, "lecturer-01")
    if lecturer is None:
        raise AppError(
            "DEMO_LECTURER_NOT_FOUND",
            "Không tìm thấy giảng viên demo.",
            status_code=500,
        )

    courses = (await session.scalars(select(Course).order_by(Course.code))).all()
    groups = (await session.scalars(select(Group).order_by(Group.name))).all()
    groups_by_course: dict[str, list[Group]] = {}
    for group in groups:
        groups_by_course.setdefault(group.course_id, []).append(group)

    return DemoCatalogResponse(
        lecturer=DemoLecturerResponse(id=lecturer.id, display_name=lecturer.display_name),
        courses=[
            DemoCourseResponse(
                id=course.id,
                code=course.code,
                name=course.name,
                semester=course.semester,
                groups=[
                    DemoGroupResponse(id=group.id, name=group.name)
                    for group in groups_by_course.get(course.id, [])
                ],
            )
            for course in courses
        ],
    )


@router.post("/reset")
async def reset_demo(
    request: Request,
    current: CurrentActor = Depends(get_current_actor),
    session: AsyncSession = Depends(get_session),
) -> dict:
    require_role(current, ActorRole.ACADEMIC_AFFAIRS)
    from app.db.seed import seed_demo

    models_to_reset = (
        PolicyException,
        HumanDecision,
        EscalationCase,
        RetrievalEvidence,
        Question,
        DocumentChunk,
        Document,
        GroupMembership,
        Group,
        Course,
    )
    deleted_counts = {
        model.__tablename__: int(
            await session.scalar(select(func.count()).select_from(model)) or 0
        )
        for model in models_to_reset
    }
    for model in models_to_reset:
        await session.execute(delete(model))
    await session.commit()

    # Re-seed lecturers, students, groups from demo-config.json & sync documents
    ai_provider = getattr(request.app.state, "ai_provider", None) or build_ai_provider()
    await seed_demo(session, provider=ai_provider)

    add_audit_event(
        session,
        event_type="DEMO_RESET",
        entity_type="demo",
        entity_id="demo",
        request_id=request.state.request_id,
        output_snapshot={
            "deleted_counts": deleted_counts,
        },
    )
    await session.commit()
    return {
        "status": "reset",
        "seeded": True,
        "documents_reingested": True,
        "audit_preserved": True,
    }
