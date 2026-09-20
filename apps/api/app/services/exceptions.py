from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums import ExceptionStatus
from app.core.errors import AppError
from app.models import PolicyException
from app.schemas.exceptions import ExceptionResponse
from app.services.audit import add_audit_event
from app.services.cases import _validate_reviewer


def exception_response(item: PolicyException) -> ExceptionResponse:
    return ExceptionResponse(
        id=item.id,
        course_id=item.course_id,
        scope_type=item.scope_type,
        scope_id=item.scope_id,
        content=item.content,
        valid_from=item.valid_from,
        valid_until=item.valid_until,
        status=item.status,
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
