from datetime import date
from time import perf_counter

from sqlalchemy import and_, func, or_, select
from sqlalchemy import case as sql_case
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.base import AIProvider
from app.core.config import get_settings
from app.core.enums import (
    CaseStatus,
    DocumentStatus,
    ExceptionStatus,
    PolicyCoverage,
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
from app.schemas.questions import (
    CitationResponse,
    DashboardCounts,
    QuestionCreate,
    QuestionResponse,
)
from app.schemas.referee import RefereeDecision
from app.services.audit import add_audit_event
from app.services.ids import new_id


def _provider_failure_snapshot(error: Exception) -> dict[str, str]:
    snapshot = {"failure_type": type(error).__name__}
    code = getattr(error, "code", None) or getattr(error, "status_code", None)
    if code is not None:
        snapshot["provider_code"] = str(code)
    return snapshot


SUSPICIOUS_TOKENS = (
    "ignore previous",
    "bỏ qua chỉ dẫn",
    "system prompt",
    "developer message",
)
async def _resolve_group(session: AsyncSession, actor_id: str, course_id: str) -> Group | None:
    groups = (
        await session.scalars(
            select(Group)
            .join(GroupMembership, GroupMembership.group_id == Group.id)
            .where(GroupMembership.actor_id == actor_id, Group.course_id == course_id)
            .order_by(Group.id)
        )
    ).all()
    if len(groups) > 1:
        raise AppError(
            "AMBIGUOUS_GROUP_CONTEXT",
            "Sinh viên đang thuộc nhiều nhóm trong cùng học phần; "
            "cần sửa dữ liệu nhóm trước khi xử lý.",
            status_code=409,
        )
    return groups[0] if groups else None


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
            select(PolicyException)
            .where(
                PolicyException.course_id == course_id,
                PolicyException.status == ExceptionStatus.ACTIVE,
                PolicyException.valid_from <= today,
                PolicyException.valid_until >= today,
                or_(*scopes),
            )
            .order_by(
                sql_case(
                    (PolicyException.scope_type == ScopeType.STUDENT, 0),
                    (PolicyException.scope_type == ScopeType.GROUP, 1),
                    else_=2,
                ),
                PolicyException.created_at.desc(),
            )
        )
    ).all()
    return [
        {
            "id": item.id,
            "scope_type": item.scope_type,
            "scope_id": item.scope_id,
            "policy_topic": item.policy_topic,
            "content": item.content,
            "valid_from": item.valid_from.isoformat(),
            "valid_until": item.valid_until.isoformat(),
            "precedence": {"STUDENT": 0, "GROUP": 1, "COURSE": 2}[item.scope_type],
        }
        for item in records
    ]


async def _has_conflicting_documents(session: AsyncSession, course_id: str) -> bool:
    today = date.today()
    conflicting_title = await session.scalar(
        select(Document.title)
        .where(
            Document.course_id == course_id,
            Document.status == DocumentStatus.ACTIVE,
            or_(Document.effective_from.is_(None), Document.effective_from <= today),
            or_(Document.effective_until.is_(None), Document.effective_until >= today),
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
    has_conflicting_evidence: bool,
) -> RefereeDecision | None:
    lowered = text.casefold()
    if not has_group:
        return RefereeDecision(
            route=Route.CLARIFY,
            policy_coverage=PolicyCoverage.MISSING_FACT,
            policy_topic="GROUP_CONTEXT",
            uncertainty_type=UncertaintyType.MISSING_FACT,
            reason_code="MISSING_GROUP_CONTEXT",
            clarifying_question="Bạn thuộc nhóm nào trong học phần này?",
            confidence=1,
        )
    if any(token in lowered for token in SUSPICIOUS_TOKENS):
        return RefereeDecision(
            route=Route.ESCALATE,
            policy_coverage=PolicyCoverage.SUSPICIOUS,
            policy_topic="SECURITY",
            uncertainty_type=UncertaintyType.SUSPICIOUS_INPUT,
            reason_code="SUSPICIOUS_INPUT",
            decision_question=(
                "Giảng viên có xác nhận yêu cầu này là hợp lệ để tiếp tục xử lý không?"
            ),
            confidence=1,
        )
    if has_conflicting_evidence:
        return RefereeDecision(
            route=Route.ESCALATE,
            policy_coverage=PolicyCoverage.CONFLICTING,
            policy_topic="POLICY_VERSION",
            uncertainty_type=UncertaintyType.CONFLICTING_EVIDENCE,
            reason_code="CONFLICTING_ACTIVE_DOCUMENTS",
            decision_question=(
                "Giảng viên xác nhận phiên bản chính sách nào đang có hiệu lực cho học phần?"
            ),
            confidence=1,
        )
    return None


def _safe_ai_failure() -> RefereeDecision:
    return RefereeDecision(
        route=Route.ESCALATE,
        policy_coverage=PolicyCoverage.NO_POLICY,
        policy_topic="AI_AVAILABILITY",
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
    # Persist the submitted question and release the database connection before
    # a potentially slow embedding request. The same session can open a fresh
    # transaction when retrieval continues.
    await session.commit()

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
    # Retrieval and scope data are now durable; release the connection before
    # the model decision call. A provider failure is recorded in a new transaction.
    await session.commit()

    decision = _guardrail_decision(
        payload.text,
        has_group=group is not None,
        has_conflicting_evidence=has_conflicting_evidence,
    )
    started = perf_counter()
    used_provider = decision is None
    ai_failed = False
    ai_failure_snapshot: dict[str, str] = {}
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
                ai_failure_snapshot = {
                    "failure_type": "INVALID_CITATION_LABELS",
                    "received_labels": ",".join(decision.citation_labels),
                }
                decision = _safe_ai_failure()
        except Exception as error:
            ai_failed = True
            # Keep operational diagnostics useful without persisting provider
            # messages, prompts, or document content in the audit trail.
            ai_failure_snapshot = _provider_failure_snapshot(error)
            print(
                f"[AI Failure] request_id={request_id} "
                f"type={ai_failure_snapshot['failure_type']} "
                f"provider_code={ai_failure_snapshot.get('provider_code', 'unknown')}",
                flush=True,
            )
            decision = _safe_ai_failure()
    duration_ms = round((perf_counter() - started) * 1000)

    question.route = decision.route
    question.uncertainty_type = decision.uncertainty_type
    question.reason_code = decision.reason_code
    question.policy_topic = decision.policy_topic
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
            output_snapshot=ai_failure_snapshot,
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
        policy_topic=question.policy_topic,
        answer=question.answer,
        clarifying_question=question.clarifying_question,
        case_id=case.id if case else None,
        final_decision=final_decision.decision if final_decision else None,
        final_decision_reason=final_decision.reason if final_decision else None,
        exception_id=exception_id,
        citations=citations,
        created_at=question.created_at,
        text=question.text,
        course_id=question.course_id,
        actor_id=question.actor_id,
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


async def list_questions_response(
    session: AsyncSession,
    *,
    actor_id: str | None = None,
    course_id: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[QuestionResponse]:
    stmt = select(Question).order_by(Question.created_at.desc()).limit(limit).offset(offset)
    if actor_id:
        stmt = stmt.where(Question.actor_id == actor_id)
    if course_id:
        stmt = stmt.where(Question.course_id == course_id)
    questions = (await session.scalars(stmt)).all()
    if not questions:
        return []

    question_ids = [question.id for question in questions]
    cases = (
        await session.scalars(
            select(EscalationCase).where(EscalationCase.question_id.in_(question_ids))
        )
    ).all()
    case_by_question = {item.question_id: item for item in cases}

    decisions: list[HumanDecision] = []
    if cases:
        decisions = list(
            (
                await session.scalars(
                    select(HumanDecision)
                    .where(HumanDecision.case_id.in_([item.id for item in cases]))
                    .order_by(HumanDecision.created_at.desc())
                )
            ).all()
        )
    decision_by_case: dict[str, HumanDecision] = {}
    for item in decisions:
        decision_by_case.setdefault(item.case_id, item)

    exceptions_by_decision: dict[str, PolicyException] = {}
    if decisions:
        exception_items = (
            await session.scalars(
                select(PolicyException).where(
                    PolicyException.human_decision_id.in_([item.id for item in decisions])
                )
            )
        ).all()
        exceptions_by_decision = {item.human_decision_id: item for item in exception_items}

    evidence_by_question = await _evidence_for_questions(session, question_ids)
    results: list[QuestionResponse] = []
    for question in questions:
        escalation = case_by_question.get(question.id)
        final_decision = decision_by_case.get(escalation.id) if escalation else None
        exception = exceptions_by_decision.get(final_decision.id) if final_decision else None
        evidence = evidence_by_question.get(question.id, [])
        results.append(
            _build_question_response(
                question,
                escalation,
                evidence,
                [item["label"] for item in evidence],
                final_decision,
                exception.id if exception else None,
            )
        )
    return results


async def _evidence_for_questions(
    session: AsyncSession, question_ids: list[str]
) -> dict[str, list[dict]]:
    rows = (
        await session.execute(
            select(RetrievalEvidence, DocumentChunk, Document)
            .join(DocumentChunk, DocumentChunk.id == RetrievalEvidence.chunk_id)
            .join(Document, Document.id == DocumentChunk.document_id)
            .where(RetrievalEvidence.question_id.in_(question_ids))
            .order_by(RetrievalEvidence.question_id, RetrievalEvidence.rank)
        )
    ).all()
    result: dict[str, list[dict]] = {}
    for record, chunk, document in rows:
        result.setdefault(record.question_id, []).append(
            {
                "label": record.label,
                "chunk_id": chunk.id,
                "document_title": document.title,
                "page_number": chunk.page_number,
                "heading": chunk.heading,
                "content": chunk.content,
                "score": record.retrieval_score,
            }
        )
    return result


async def dashboard_counts(session: AsyncSession) -> DashboardCounts:
    pending_questions = await session.scalar(
        select(func.count())
        .select_from(EscalationCase)
        .where(
            EscalationCase.status.not_in(
                [CaseStatus.DECIDED, CaseStatus.CANCELLED]
            )
        )
    )
    under_review_cases = await session.scalar(
        select(func.count())
        .select_from(EscalationCase)
        .where(EscalationCase.status == CaseStatus.UNDER_REVIEW)
    )
    return DashboardCounts(
        pending_questions=int(pending_questions or 0),
        under_review_cases=int(under_review_cases or 0),
    )
