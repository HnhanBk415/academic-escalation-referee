from fastapi import APIRouter, Depends, Request
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.db.session import get_session
from app.models import (
    Actor,
    Course,
    Document,
    DocumentChunk,
    EscalationCase,
    Group,
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
    session: AsyncSession = Depends(get_session),
) -> dict:
    deleted_counts = {
        model.__tablename__: int(
            await session.scalar(select(func.count()).select_from(model)) or 0
        )
        for model in (PolicyException, HumanDecision, EscalationCase, RetrievalEvidence, Question)
    }
    for model in (
        PolicyException,
        HumanDecision,
        EscalationCase,
        RetrievalEvidence,
        Question,
    ):
        await session.execute(delete(model))
    seed_document_ids = (
        "group-policy-v1",
        "project-rubric-v1",
        "dadn-hk242-rubric",
        "dadn-hk242-course-plan",
        "dadn-hk242-work-plan",
    )
    await session.execute(
        delete(DocumentChunk).where(DocumentChunk.document_id.not_in(seed_document_ids))
    )
    await session.execute(delete(Document).where(Document.id.not_in(seed_document_ids)))
    add_audit_event(
        session,
        event_type="DEMO_RESET",
        entity_type="demo",
        entity_id="demo",
        request_id=request.state.request_id,
        output_snapshot={"deleted_counts": deleted_counts},
    )
    await session.commit()
    return {
        "status": "reset",
        "seeded": True,
        "documents_reingested": False,
        "audit_preserved": True,
    }
