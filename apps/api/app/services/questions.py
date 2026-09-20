from datetime import date
from time import perf_counter

from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.base import AIProvider
from app.core.config import get_settings
from app.core.enums import (
    CaseStatus,
    DocumentStatus,
    ExceptionStatus,
    QuestionStatus,
    Route,
    ScopeType,
    UncertaintyType,
)
from app.core.errors import AppError
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
from app.rag.service import retrieve_evidence
from app.schemas.questions import CitationResponse, QuestionCreate, QuestionResponse
from app.schemas.referee import RefereeDecision
from app.services.audit import add_audit_event
from app.services.ids import new_id

AUTHORITY_TOKENS = (
    "6 thành viên",
    "sáu thành viên",
    "ngoại lệ",
    "xin phép",
    "phúc khảo",
    "đổi điểm",
    "vượt quá",
)
SUSPICIOUS_TOKENS = (
    "ignore previous",
    "bỏ qua chỉ dẫn",
    "bỏ qua quy định",
    "system prompt",
    "developer message",
)
MISSING_FACT_TOKENS = (
    "thiếu thông tin",
    "chưa rõ môn",
    "nhóm nào",
    "trường hợp này",
    "việc đó",
    "cái này",
)


async def _resolve_group(session: AsyncSession, actor_id: str, course_id: str) -> Group | None:
    return await session.scalar(
        select(Group)
        .join(GroupMembership, GroupMembership.group_id == Group.id)
        .where(GroupMembership.actor_id == actor_id, Group.course_id == course_id)
    )


async def _load_evidence(session: AsyncSession, course_id: str) -> list[dict]:
    rows = (
        await session.execute(
            select(DocumentChunk, Document)
            .join(Document, Document.id == DocumentChunk.document_id)
            .where(
                DocumentChunk.course_id == course_id,
                Document.status == DocumentStatus.ACTIVE,
            )
            .order_by(DocumentChunk.chunk_index)
            .limit(get_settings().rag_context_chunks)
        )
    ).all()
    return [
        {
            "label": f"C{index}",
            "chunk_id": chunk.id,
            "document_title": document.title,
            "page_number": chunk.page_number,
            "heading": chunk.heading,
            "content": chunk.content,
            "score": 1.0,
        }
        for index, (chunk, document) in enumerate(rows, start=1)
    ]


async def _load_exceptions(
    session: AsyncSession,
    *,
    actor_id: str,
    group_id: str | None,
    course_id: str,
) -> list[dict]:
    today = date.today()
    scopes = [
        and_(
            PolicyException.scope_type == ScopeType.STUDENT,
            PolicyException.scope_id == actor_id,
        ),
        and_(
            PolicyException.scope_type == ScopeType.COURSE,
            PolicyException.scope_id == course_id,
        ),
    ]
    if group_id:
        scopes.append(
            and_(
                PolicyException.scope_type == ScopeType.GROUP,
                PolicyException.scope_id == group_id,
            )
        )
    records = (
        await session.scalars(
            select(PolicyException).where(
                PolicyException.course_id == course_id,
                PolicyException.status == ExceptionStatus.ACTIVE,
                PolicyException.valid_from <= today,
                PolicyException.valid_until >= today,
                or_(*scopes),
            )
        )
    ).all()
    return [
        {
            "id": item.id,
            "scope_type": item.scope_type,
            "scope_id": item.scope_id,
            "content": item.content,
            "valid_from": item.valid_from.isoformat(),
            "valid_until": item.valid_until.isoformat(),
        }
        for item in records
    ]


async def _has_conflicting_documents(session: AsyncSession, course_id: str) -> bool:
    conflicting_title = await session.scalar(
        select(Document.title)
        .where(
            Document.course_id == course_id,
            Document.status == DocumentStatus.ACTIVE,
        )
        .group_by(Document.title)
        .having(func.count(func.distinct(Document.content_hash)) > 1)
        .limit(1)
    )
    return conflicting_title is not None


def _guardrail_decision(
    text: str,
    *,
    has_group: bool,
    has_evidence: bool,
    has_exception: bool,
    has_conflicting_evidence: bool,
) -> RefereeDecision | None:
    lowered = text.casefold()
    if not has_group:
        return RefereeDecision(
            route=Route.CLARIFY,
            uncertainty_type=UncertaintyType.MISSING_FACT,
            reason_code="MISSING_GROUP_CONTEXT",
            clarifying_question="Bạn thuộc nhóm nào trong học phần này?",
            confidence=1,
        )
    if any(token in lowered for token in MISSING_FACT_TOKENS):
        return RefereeDecision(
            route=Route.CLARIFY,
            uncertainty_type=UncertaintyType.MISSING_FACT,
            reason_code="MISSING_CONCRETE_FACT",
            clarifying_question="Bạn có thể nêu rõ quy định hoặc tình huống đang hỏi không?",
            confidence=1,
        )
    if any(token in lowered for token in SUSPICIOUS_TOKENS):
        return RefereeDecision(
            route=Route.ESCALATE,
            uncertainty_type=UncertaintyType.SUSPICIOUS_INPUT,
            reason_code="SUSPICIOUS_INPUT",
            decision_question=(
                "Giảng viên có xác nhận yêu cầu này là hợp lệ để tiếp tục xử lý không?"
            ),
            confidence=1,
        )
    if any(token in lowered for token in AUTHORITY_TOKENS) and not has_exception:
        return RefereeDecision(
            route=Route.ESCALATE,
            uncertainty_type=UncertaintyType.AUTHORITY_REQUIRED,
            reason_code="EXCEPTION_REQUIRES_AUTHORITY",
            decision_question="Giảng viên có phê duyệt ngoại lệ được nêu trong yêu cầu này không?",
            confidence=1,
        )
    if has_conflicting_evidence:
        return RefereeDecision(
            route=Route.ESCALATE,
            uncertainty_type=UncertaintyType.CONFLICTING_EVIDENCE,
            reason_code="CONFLICTING_ACTIVE_DOCUMENTS",
            decision_question=(
                "Giảng viên xác nhận phiên bản chính sách nào đang có hiệu lực cho học phần?"
            ),
            confidence=1,
        )
    if not has_evidence:
        return RefereeDecision(
            route=Route.ESCALATE,
            uncertainty_type=UncertaintyType.OUT_OF_POLICY,
            reason_code="INSUFFICIENT_EVIDENCE",
            decision_question=(
                "Giảng viên có thể cung cấp quy định hoặc quyết định áp dụng "
                "cho yêu cầu này không?"
            ),
            confidence=1,
        )
    return None


def _safe_ai_failure() -> RefereeDecision:
    return RefereeDecision(
        route=Route.ESCALATE,
        uncertainty_type=UncertaintyType.AI_UNAVAILABLE,
        reason_code="AI_UNAVAILABLE",
        decision_question="Giảng viên có thể xem xét và đưa ra quyết định cho yêu cầu này không?",
        confidence=0,
    )


async def submit_question(
    session: AsyncSession,
    payload: QuestionCreate,
    *,
    provider: AIProvider,
    request_id: str | None,
) -> QuestionResponse:
    actor = await session.get(Actor, payload.actor_id)
    if actor is None:
        raise AppError("ACTOR_NOT_FOUND", "Không tìm thấy người dùng.", status_code=404)
    course = await session.get(Course, payload.course_id)
    if course is None:
        raise AppError("COURSE_NOT_FOUND", "Không tìm thấy học phần.", status_code=404)

    group = await _resolve_group(session, actor.id, course.id)
    question = Question(
        id=new_id("q"),
        actor_id=actor.id,
        group_id=group.id if group else None,
        course_id=course.id,
        text=payload.text,
        status=QuestionStatus.SUBMITTED,
    )
    session.add(question)
    await session.flush()
    add_audit_event(
        session,
        event_type="QUESTION_SUBMITTED",
        actor_id=actor.id,
        entity_type="question",
        entity_id=question.id,
        request_id=request_id,
        input_snapshot=payload.model_dump(),
    )
    add_audit_event(
        session,
        event_type="CONTEXT_RESOLVED",
        actor_id=actor.id,
        entity_type="question",
        entity_id=question.id,
        request_id=request_id,
        output_snapshot={
            "group_id": group.id if group else None,
            "course_id": course.id,
            "semester": course.semester,
        },
    )

    evidence = await retrieve_evidence(
        session,
        provider=provider,
        question=payload.text,
        course_id=course.id,
    )
    exceptions = await _load_exceptions(
        session,
        actor_id=actor.id,
        group_id=group.id if group else None,
        course_id=course.id,
    )
    has_conflicting_evidence = await _has_conflicting_documents(session, course.id)
    for rank, item in enumerate(evidence, start=1):
        session.add(
            RetrievalEvidence(
                id=new_id("evidence"),
                question_id=question.id,
                chunk_id=item["chunk_id"],
                label=item["label"],
                retrieval_score=item["score"],
                rank=rank,
            )
        )
    add_audit_event(
        session,
        event_type="EVIDENCE_RETRIEVED",
        actor_id=actor.id,
        entity_type="question",
        entity_id=question.id,
        request_id=request_id,
        evidence_ids=[item["chunk_id"] for item in evidence],
        output_snapshot={"count": len(evidence), "exception_ids": [e["id"] for e in exceptions]},
    )

    decision = _guardrail_decision(
        payload.text,
        has_group=group is not None,
        has_evidence=bool(evidence),
        has_exception=bool(exceptions),
        has_conflicting_evidence=has_conflicting_evidence,
    )
    started = perf_counter()
    used_provider = decision is None
    ai_failed = False
    if decision is None:
        try:
            decision = await provider.decide(
                payload.text,
                {
                    "actor_id": actor.id,
                    "group_id": group.id if group else None,
                    "course_id": course.id,
                    "semester": course.semester,
                },
                evidence,
                exceptions,
            )
            valid_labels = {item["label"] for item in evidence}
            if not set(decision.citation_labels).issubset(valid_labels):
                ai_failed = True
                decision = _safe_ai_failure()
        except Exception:
            ai_failed = True
            decision = _safe_ai_failure()
    duration_ms = round((perf_counter() - started) * 1000)

    question.route = decision.route
    question.uncertainty_type = decision.uncertainty_type
    question.reason_code = decision.reason_code
    question.answer = decision.answer
    question.clarifying_question = decision.clarifying_question
    case: EscalationCase | None = None
    if decision.route == Route.ANSWER:
        question.status = QuestionStatus.ANSWERED
        terminal_event = "ANSWER_RETURNED"
    elif decision.route == Route.CLARIFY:
        question.status = QuestionStatus.CLARIFICATION_REQUIRED
        terminal_event = "CLARIFICATION_REQUESTED"
    else:
        question.status = QuestionStatus.ESCALATED
        terminal_event = "CASE_ESCALATED"
        case = EscalationCase(
            id=new_id("case"),
            question_id=question.id,
            status=CaseStatus.UNDER_REVIEW,
            reason_code=decision.reason_code,
            uncertainty_type=decision.uncertainty_type,
            ai_summary=f"Yêu cầu được chuyển cho giảng viên: {payload.text}",
            decision_question=decision.decision_question or "Giảng viên có phê duyệt không?",
            assigned_reviewer_id="lecturer-01",
        )
        session.add(case)

    settings = get_settings()
    if ai_failed:
        add_audit_event(
            session,
            event_type="AI_FAILED",
            actor_id=actor.id,
            entity_type="question",
            entity_id=question.id,
            request_id=request_id,
            reason_code="AI_UNAVAILABLE",
            model_name=settings.ai_mode,
            prompt_version=settings.prompt_version,
        )
    add_audit_event(
        session,
        event_type="REFEREE_DECIDED",
        actor_id=actor.id,
        entity_type="question",
        entity_id=question.id,
        request_id=request_id,
        output_snapshot=decision.model_dump(mode="json"),
        reason_code=decision.reason_code,
        evidence_ids=[item["chunk_id"] for item in evidence],
        model_name=settings.ai_mode if used_provider else "deterministic-guardrail",
        prompt_version=settings.prompt_version,
        duration_ms=duration_ms,
    )
    add_audit_event(
        session,
        event_type=terminal_event,
        actor_id=actor.id,
        entity_type="question",
        entity_id=question.id,
        request_id=request_id,
        reason_code=decision.reason_code,
    )
    await session.commit()
    await session.refresh(question)
    return _build_question_response(question, case, evidence, decision.citation_labels)


def _build_question_response(
    question: Question,
    case: EscalationCase | None,
    evidence: list[dict],
    labels: list[str],
    final_decision: HumanDecision | None = None,
    exception_id: str | None = None,
) -> QuestionResponse:
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
        if item["label"] in labels or question.route == Route.ESCALATE
    ]
    return QuestionResponse(
        question_id=question.id,
        status=question.status,
        route=question.route,
        uncertainty_type=question.uncertainty_type,
        reason_code=question.reason_code or "UNKNOWN",
        answer=question.answer,
        clarifying_question=question.clarifying_question,
        case_id=case.id if case else None,
        final_decision=final_decision.decision if final_decision else None,
        final_decision_reason=final_decision.reason if final_decision else None,
        exception_id=exception_id,
        citations=citations,
        created_at=question.created_at,
    )


async def get_question_response(session: AsyncSession, question_id: str) -> QuestionResponse:
    question = await session.get(Question, question_id)
    if question is None:
        raise AppError("QUESTION_NOT_FOUND", "Không tìm thấy câu hỏi.", status_code=404)
    case = await session.scalar(
        select(EscalationCase).where(EscalationCase.question_id == question.id)
    )
    final_decision = None
    exception_id = None
    if case:
        final_decision = await session.scalar(
            select(HumanDecision)
            .where(HumanDecision.case_id == case.id)
            .order_by(HumanDecision.created_at.desc())
        )
        if final_decision:
            exception = await session.scalar(
                select(PolicyException).where(
                    PolicyException.human_decision_id == final_decision.id
                )
            )
            exception_id = exception.id if exception else None
    evidence = await _evidence_for_question(session, question.id)
    return _build_question_response(
        question,
        case,
        evidence,
        [item["label"] for item in evidence],
        final_decision,
        exception_id,
    )


async def _evidence_for_question(session: AsyncSession, question_id: str) -> list[dict]:
    rows = (
        await session.execute(
            select(RetrievalEvidence, DocumentChunk, Document)
            .join(DocumentChunk, DocumentChunk.id == RetrievalEvidence.chunk_id)
            .join(Document, Document.id == DocumentChunk.document_id)
            .where(RetrievalEvidence.question_id == question_id)
            .order_by(RetrievalEvidence.rank)
        )
    ).all()
    return [
        {
            "label": record.label,
            "chunk_id": chunk.id,
            "document_title": document.title,
            "page_number": chunk.page_number,
            "heading": chunk.heading,
            "content": chunk.content,
            "score": record.retrieval_score,
        }
        for record, chunk, document in rows
    ]
