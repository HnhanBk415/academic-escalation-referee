
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums import (
    ActorRole,
    CaseStatus,
    DecisionValue,
    DocumentStatus,
    ExceptionStatus,
    ScopeType,
)
from app.core.errors import AppError
from app.models import (
    Actor,
    Document,
    EscalationCase,
    HumanDecision,
    PolicyException,
    Question,
)
from app.schemas.cases import (
    CaseDecisionCreate,
    CaseDetail,
    CaseSummary,
    DecisionResponse,
)
from app.schemas.questions import CitationResponse
from app.services.audit import add_audit_event
from app.services.ids import new_id
from app.services.questions import _evidence_for_question


async def list_cases(session: AsyncSession, status: CaseStatus | None = None) -> list[CaseSummary]:
    statement = select(EscalationCase).order_by(EscalationCase.created_at.desc())
    if status:
        statement = statement.where(EscalationCase.status == status)
    cases = (await session.scalars(statement)).all()
    return [
        CaseSummary(
            id=item.id,
            question_id=item.question_id,
            status=item.status,
            reason_code=item.reason_code,
            uncertainty_type=item.uncertainty_type,
            decision_question=item.decision_question,
            assigned_reviewer_id=item.assigned_reviewer_id,
            created_at=item.created_at,
        )
        for item in cases
    ]


async def get_case_detail(session: AsyncSession, case_id: str) -> CaseDetail:
    case = await session.get(EscalationCase, case_id)
    if case is None:
        raise AppError("CASE_NOT_FOUND", "Không tìm thấy hồ sơ chuyển cấp.", status_code=404)
    question = await session.get(Question, case.question_id)
    if question is None:
        raise AppError("QUESTION_NOT_FOUND", "Không tìm thấy câu hỏi gốc.", status_code=500)
    evidence = await _evidence_for_question(session, question.id)
    citations = [
        CitationResponse(
            label=item["label"],
            chunk_id=item["chunk_id"],
            document_title=item["document_title"],
            page_number=item["page_number"],
            heading=item["heading"],
            quote=item["content"],
        )
        for item in evidence
    ]
    return CaseDetail(
        id=case.id,
        question_id=case.question_id,
        status=case.status,
        reason_code=case.reason_code,
        uncertainty_type=case.uncertainty_type,
        decision_question=case.decision_question,
        assigned_reviewer_id=case.assigned_reviewer_id,
        created_at=case.created_at,
        original_question=question.text,
        actor_id=question.actor_id,
        group_id=question.group_id,
        course_id=question.course_id,
        ai_summary=case.ai_summary,
        citations=citations,
    )


async def _validate_reviewer(session: AsyncSession, reviewer_id: str) -> Actor:
    reviewer = await session.get(Actor, reviewer_id)
    if reviewer is None or reviewer.role != ActorRole.LECTURER:
        raise AppError(
            "REVIEWER_NOT_AUTHORIZED",
            "Chỉ giảng viên demo mới có thể thực hiện thao tác này.",
            status_code=403,
        )
    return reviewer


def _validate_exception_scope(payload: CaseDecisionCreate, question: Question) -> None:
    exception = payload.exception
    if not payload.create_exception or exception is None:
        return
    if exception.course_id != question.course_id:
        raise AppError("INVALID_EXCEPTION_SCOPE", "Ngoại lệ không thuộc học phần của câu hỏi.")
    expected_scope_ids = {
        ScopeType.STUDENT: question.actor_id,
        ScopeType.GROUP: question.group_id,
        ScopeType.COURSE: question.course_id,
    }
    if exception.scope_id != expected_scope_ids[exception.scope_type]:
        raise AppError(
            "INVALID_EXCEPTION_SCOPE",
            "Phạm vi ngoại lệ không khớp với người học, nhóm hoặc học phần của hồ sơ.",
        )


async def decide_case(
    session: AsyncSession,
    case_id: str,
    payload: CaseDecisionCreate,
    *,
    idempotency_key: str | None,
    request_id: str | None,
) -> DecisionResponse:
    await _validate_reviewer(session, payload.reviewer_id)
    if idempotency_key:
        existing = await session.scalar(
            select(HumanDecision).where(HumanDecision.idempotency_key == idempotency_key)
        )
        if existing:
            if existing.case_id != case_id:
                raise AppError(
                    "IDEMPOTENCY_KEY_REUSED",
                    "Idempotency key đã được dùng cho hồ sơ khác.",
                    status_code=409,
                )
            existing_exception = await session.scalar(
                select(PolicyException).where(
                    PolicyException.human_decision_id == existing.id
                )
            )
            case = await session.get(EscalationCase, case_id)
            return DecisionResponse(
                decision_id=existing.id,
                case_id=case_id,
                status=case.status if case else CaseStatus.DECIDED,
                decision=existing.decision,
                exception_id=existing_exception.id if existing_exception else None,
            )

    case = await session.get(EscalationCase, case_id)
    if case is None:
        raise AppError("CASE_NOT_FOUND", "Không tìm thấy hồ sơ chuyển cấp.", status_code=404)
    if case.status == CaseStatus.CANCELLED:
        raise AppError("CASE_CANCELLED", "Hồ sơ đã bị hủy.", status_code=409)
    if case.status == CaseStatus.DECIDED:
        raise AppError("CASE_ALREADY_DECIDED", "Hồ sơ đã có quyết định.", status_code=409)
    question = await session.get(Question, case.question_id)
    if question is None:
        raise AppError("QUESTION_NOT_FOUND", "Không tìm thấy câu hỏi gốc.", status_code=500)
    _validate_exception_scope(payload, question)

    decision = HumanDecision(
        id=new_id("decision"),
        case_id=case.id,
        reviewer_id=payload.reviewer_id,
        decision=payload.decision,
        reason=payload.reason,
        idempotency_key=idempotency_key,
    )
    session.add(decision)
    if payload.decision == DecisionValue.NEED_MORE_INFO:
        case.status = CaseStatus.WAITING_FOR_STUDENT
    elif payload.decision == DecisionValue.FORWARDED:
        case.status = CaseStatus.FORWARDED
    else:
        case.status = CaseStatus.DECIDED
    add_audit_event(
        session,
        event_type="DECISION_RECORDED",
        actor_id=payload.reviewer_id,
        entity_type="case",
        entity_id=case.id,
        request_id=request_id,
        input_snapshot=payload.model_dump(mode="json"),
        output_snapshot={"status": case.status, "decision_id": decision.id},
        reason_code=payload.decision,
    )
    add_audit_event(
        session,
        event_type="STUDENT_NOTIFIED",
        actor_id=payload.reviewer_id,
        entity_type="question",
        entity_id=question.id,
        request_id=request_id,
        output_snapshot={"decision": payload.decision, "reason": payload.reason},
    )

    exception_id: str | None = None
    if payload.create_exception and payload.exception:
        policy_document = await session.scalar(
            select(Document).where(
                Document.course_id == question.course_id,
                Document.status == DocumentStatus.ACTIVE,
            )
        )
        if policy_document is None:
            raise AppError(
                "ACTIVE_POLICY_NOT_FOUND",
                "Không tìm thấy chính sách đang hoạt động để liên kết ngoại lệ.",
                status_code=409,
            )
        exception_id = new_id("exception")
        exception = PolicyException(
            id=exception_id,
            source_policy_document_id=policy_document.id,
            human_decision_id=decision.id,
            course_id=payload.exception.course_id,
            scope_type=payload.exception.scope_type,
            scope_id=payload.exception.scope_id,
            content=payload.exception.content,
            valid_from=payload.exception.valid_from,
            valid_until=payload.exception.valid_until,
            status=ExceptionStatus.ACTIVE,
            created_by=payload.reviewer_id,
        )
        session.add(exception)
        add_audit_event(
            session,
            event_type="EXCEPTION_CREATED",
            actor_id=payload.reviewer_id,
            entity_type="exception",
            entity_id=exception.id,
            request_id=request_id,
            input_snapshot=payload.exception.model_dump(mode="json"),
            reason_code="HUMAN_APPROVED",
        )
    await session.commit()
    return DecisionResponse(
        decision_id=decision.id,
        case_id=case.id,
        status=case.status,
        decision=decision.decision,
        exception_id=exception_id,
    )


async def cancel_case(
    session: AsyncSession,
    case_id: str,
    *,
    actor_id: str,
    reason: str,
    request_id: str | None,
) -> CaseSummary:
    await _validate_reviewer(session, actor_id)
    case = await session.get(EscalationCase, case_id)
    if case is None:
        raise AppError("CASE_NOT_FOUND", "Không tìm thấy hồ sơ chuyển cấp.", status_code=404)
    if case.status == CaseStatus.DECIDED:
        raise AppError(
            "CASE_ALREADY_DECIDED",
            "Không thể hủy hồ sơ đã quyết định.",
            status_code=409,
        )
    if case.status != CaseStatus.CANCELLED:
        case.status = CaseStatus.CANCELLED
        add_audit_event(
            session,
            event_type="CASE_CANCELLED",
            actor_id=actor_id,
            entity_type="case",
            entity_id=case.id,
            request_id=request_id,
            input_snapshot={"reason": reason},
        )
        await session.commit()
    return CaseSummary(
        id=case.id,
        question_id=case.question_id,
        status=case.status,
        reason_code=case.reason_code,
        uncertainty_type=case.uncertainty_type,
        decision_question=case.decision_question,
        assigned_reviewer_id=case.assigned_reviewer_id,
        created_at=case.created_at,
    )
