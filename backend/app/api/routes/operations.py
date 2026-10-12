from datetime import UTC, date, datetime

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_actor
from app.core.auth import CurrentActor, require_role
from app.core.enums import (
    ActorRole,
    CaseStatus,
    DocumentStatus,
    ExceptionStatus,
)
from app.db.session import get_session
from app.models import (
    AuditEvent,
    Document,
    EscalationCase,
    PolicyException,
    Question,
)
from app.schemas.operations import OperationsActivity, OperationsOverview

router = APIRouter()


def _is_overdue(case: EscalationCase) -> bool:
    if case.status in (CaseStatus.DECIDED, CaseStatus.CANCELLED) or case.sla_due_at is None:
        return False
    due_at = case.sla_due_at
    if due_at.tzinfo is None:
        due_at = due_at.replace(tzinfo=UTC)
    return due_at < datetime.now(UTC)


@router.get("/overview", response_model=OperationsOverview)
async def get_operations_overview(
    current: CurrentActor = Depends(get_current_actor),
    session: AsyncSession = Depends(get_session),
) -> OperationsOverview:
    require_role(current, ActorRole.ACADEMIC_AFFAIRS)
    open_cases = await session.scalar(
        select(func.count()).select_from(EscalationCase).where(
            EscalationCase.status.in_((CaseStatus.UNDER_REVIEW, CaseStatus.WAITING_FOR_STUDENT))
        )
    )
    cases_with_due_dates = (
        await session.scalars(
            select(EscalationCase).where(EscalationCase.sla_due_at.is_not(None))
        )
    ).all()
    recent_events = (
        await session.scalars(select(AuditEvent).order_by(AuditEvent.created_at.desc()).limit(8))
    ).all()
    return OperationsOverview(
        total_questions=int(await session.scalar(select(func.count()).select_from(Question)) or 0),
        open_cases=int(open_cases or 0),
        overdue_cases=sum(_is_overdue(item) for item in cases_with_due_dates),
        active_exceptions=int(
            await session.scalar(
                select(func.count()).select_from(PolicyException).where(
                    PolicyException.status == ExceptionStatus.ACTIVE,
                    PolicyException.valid_from <= date.today(),
                    PolicyException.valid_until >= date.today(),
                )
            )
            or 0
        ),
        active_documents=int(
            await session.scalar(
                select(func.count()).select_from(Document).where(
                    Document.status == DocumentStatus.ACTIVE
                )
            )
            or 0
        ),
        recent_activity=[
            OperationsActivity(
                id=item.id,
                event_type=item.event_type,
                entity_type=item.entity_type,
                entity_id=item.entity_id,
                actor_id=item.actor_id,
                created_at=item.created_at,
            )
            for item in recent_events
        ],
    )
