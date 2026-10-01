from datetime import UTC, date, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums import ExceptionStatus, ScopeType
from app.core.errors import AppError
from app.models import Course, Group, PolicyException
from app.schemas.exceptions import (
    CourseExceptionOverview,
    ExceptionResponse,
    GroupExceptionOverview,
)
from app.services.audit import add_audit_event
from app.services.cases import _validate_reviewer


def exception_response(item: PolicyException) -> ExceptionResponse:
    today = date.today()
    if item.status == ExceptionStatus.REVOKED:
        effective_status = "REVOKED"
    elif item.valid_until < today:
        effective_status = "EXPIRED"
    elif item.valid_from > today:
        effective_status = "UPCOMING"
    else:
        effective_status = "ACTIVE"
    return ExceptionResponse(
        id=item.id,
        course_id=item.course_id,
        scope_type=item.scope_type,
        scope_id=item.scope_id,
        policy_topic=item.policy_topic,
        content=item.content,
        valid_from=item.valid_from,
        valid_until=item.valid_until,
        status=item.status,
        effective_status=effective_status,
        is_effective=effective_status == "ACTIVE",
        created_by=item.created_by,
        created_at=item.created_at,
        revoked_by=item.revoked_by,
        revoked_at=item.revoked_at,
        revocation_reason=item.revocation_reason,
    )


async def list_exceptions(session: AsyncSession) -> list[ExceptionResponse]:
    items = (
        await session.scalars(
            select(PolicyException).order_by(PolicyException.created_at.desc())
        )
    ).all()
    return [exception_response(item) for item in items]


async def exception_overview(session: AsyncSession) -> list[CourseExceptionOverview]:
    courses = (await session.scalars(select(Course).order_by(Course.code))).all()
    groups = (await session.scalars(select(Group).order_by(Group.name))).all()
    exceptions = (
        await session.scalars(
            select(PolicyException).order_by(PolicyException.created_at.desc())
        )
    ).all()
    groups_by_course: dict[str, list[Group]] = {}
    for group in groups:
        groups_by_course.setdefault(group.course_id, []).append(group)
    exceptions_by_course: dict[str, list[PolicyException]] = {}
    for item in exceptions:
        exceptions_by_course.setdefault(item.course_id, []).append(item)

    result: list[CourseExceptionOverview] = []
    for course in courses:
        course_items = exceptions_by_course.get(course.id, [])
        result.append(
            CourseExceptionOverview(
                course_id=course.id,
                course_code=course.code,
                course_name=course.name,
                semester=course.semester,
                course_exceptions=[
                    exception_response(item)
                    for item in course_items
                    if item.scope_type == ScopeType.COURSE
                ],
                groups=[
                    GroupExceptionOverview(
                        group_id=group.id,
                        group_name=group.name,
                        semester=group.semester,
                        exceptions=[
                            exception_response(item)
                            for item in course_items
                            if item.scope_type == ScopeType.GROUP
                            and item.scope_id == group.id
                        ],
                    )
                    for group in groups_by_course.get(course.id, [])
                ],
                student_exceptions=[
                    exception_response(item)
                    for item in course_items
                    if item.scope_type == ScopeType.STUDENT
                ],
            )
        )
    return result


async def revoke_exception(
    session: AsyncSession,
    exception_id: str,
    *,
    actor_id: str,
    reason: str,
    request_id: str | None,
) -> ExceptionResponse:
    await _validate_reviewer(session, actor_id)
    item = await session.get(PolicyException, exception_id)
    if item is None:
        raise AppError("EXCEPTION_NOT_FOUND", "Không tìm thấy ngoại lệ.", status_code=404)
    if item.status == ExceptionStatus.REVOKED:
        return exception_response(item)
    item.status = ExceptionStatus.REVOKED
    item.revoked_by = actor_id
    item.revoked_at = datetime.now(UTC)
    item.revocation_reason = reason
    add_audit_event(
        session,
        event_type="EXCEPTION_REVOKED",
        actor_id=actor_id,
        entity_type="exception",
        entity_id=item.id,
        request_id=request_id,
        input_snapshot={"reason": reason},
        output_snapshot={"status": ExceptionStatus.REVOKED},
    )
    await session.commit()
    await session.refresh(item)
    return exception_response(item)
