from datetime import UTC, date, datetime, timedelta
import re
import unicodedata
from time import perf_counter

from sqlalchemy import and_, func, or_, select
from sqlalchemy import case as sql_case
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.base import AIProvider
from app.core.config import get_settings
from app.core.enums import (
    CaseStatus,
    DocumentStatus,
    EscalationTarget,
    ExceptionStatus,
    PolicyCoverage,
    PolicyUpdateStatus,
    QuestionStatus,
    Route,
    ScopeType,
    UncertaintyType,
)
from app.core.errors import AppError
from app.core.policy_topics import (
    canonical_policy_topic,
    infer_policy_topic,
    policy_topics_in_text,
    resolve_policy_topic,
)
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
    PolicyUpdate,
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
MAX_CLARIFICATION_ROUNDS = 2
CASE_SLA_HOURS = 48


async def _resolve_group(
    session: AsyncSession,
    actor_id: str,
    course_id: str,
    selected_group_id: str | None = None,
) -> Group | None:
    if selected_group_id:
        group = await session.get(Group, selected_group_id)
        if group is None:
            raise AppError("GROUP_NOT_FOUND", "Không tìm thấy nhóm đã chọn.", status_code=404)
        if group.course_id != course_id:
            raise AppError(
                "GROUP_COURSE_MISMATCH",
                "Nhóm đã chọn không thuộc môn học này.",
                status_code=422,
                details={"course_id": course_id, "group_id": selected_group_id},
            )
        return group

    # Backward-compatible path for the existing verification harness. The demo
    # UI should send group_id explicitly because it has no authenticated user.
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
            "document_id": document.id,
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
            "course_id": item.course_id,
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


async def _load_policy_updates(
    session: AsyncSession,
    *,
    actor_id: str,
    group_id: str | None,
    course_id: str,
) -> list[dict]:
    """Load the active policy-update layer using the same scope precedence as exceptions."""
    today = date.today()
    scopes = [
        and_(PolicyUpdate.scope_type == ScopeType.STUDENT, PolicyUpdate.scope_id == actor_id),
        and_(PolicyUpdate.scope_type == ScopeType.COURSE, PolicyUpdate.scope_id == course_id),
    ]
    if group_id:
        scopes.append(and_(PolicyUpdate.scope_type == ScopeType.GROUP, PolicyUpdate.scope_id == group_id))
    records = (await session.scalars(
        select(PolicyUpdate)
        .where(
            PolicyUpdate.course_id == course_id,
            PolicyUpdate.status == PolicyUpdateStatus.ACTIVE,
            PolicyUpdate.valid_from <= today,
            or_(PolicyUpdate.valid_until.is_(None), PolicyUpdate.valid_until >= today),
            or_(*scopes),
        )
        .order_by(
            sql_case(
                (PolicyUpdate.scope_type == ScopeType.STUDENT, 0),
                (PolicyUpdate.scope_type == ScopeType.GROUP, 1),
                else_=2,
            ),
            PolicyUpdate.published_at.desc(),
        )
    )).all()
    return [
        {
            "id": item.id,
            "source_document_id": item.source_document_id,
            "source_chunk_id": item.source_chunk_id,
            "scope_type": item.scope_type,
            "scope_id": item.scope_id,
            "policy_topic": item.policy_topic,
            "operation": item.operation,
            "content": item.content,
            "published_at": item.published_at or item.created_at,
            "precedence": {"STUDENT": 0, "GROUP": 1, "COURSE": 2}[item.scope_type],
        }
        for item in records
    ]


_POLICY_MATCH_STOPWORDS = {
    "bao", "ban", "cac", "cho", "co", "cua", "duoc", "hay", "khi", "la", "mot", "nhung",
    "nguoi", "phai", "sinh", "theo", "toi", "trong", "va", "voi", "vien", "vui", "xin",
    "em", "ve", "se", "ra", "nay", "den", "tu", "thi", "ma", "nao", "gi", "sao", "nhu",
    "the", "o", "nhieu", "de", "khong", "a",
}


def _policy_match_tokens(value: str) -> set[str]:
    normalized = unicodedata.normalize("NFD", value.casefold())
    normalized = "".join(char for char in normalized if unicodedata.category(char) != "Mn")
    normalized = normalized.replace("đ", "d")
    return {
        token for token in re.findall(r"[a-z0-9]+", normalized)
        if len(token) > 1 and token not in _POLICY_MATCH_STOPWORDS
    }


def _policy_update_relevance(question: str, content: str) -> float:
    question_tokens = _policy_match_tokens(question)
    if not question_tokens:
        return 0.0
    content_tokens = _policy_match_tokens(content)
    return len(question_tokens & content_tokens) / len(question_tokens)


def _applicable_policy_update(question: str, updates: list[dict]) -> dict | None:
    topic = canonical_policy_topic(infer_policy_topic(question))
    question_topics = policy_topics_in_text(question)
    if topic != "GENERAL":
        question_topics.add(topic)
    relevant: list[dict] = []
    for update in updates:
        if update.get("operation") == "REVOKE":
            continue
        update_topic = canonical_policy_topic(str(update.get("policy_topic", "GENERAL")))
        update_content = str(update.get("content", ""))
        update_topics = policy_topics_in_text(update_content)
        if update_topic != "GENERAL":
            update_topics.add(update_topic)

        # Strict topic check:
        # A domain-specific question MUST find an update covering that topic.
        # A general policy update must not hijack specific questions.
        if topic != "GENERAL":
            if topic not in update_topics and update_topic != topic:
                continue
        else:
            # If the question is GENERAL, an update dedicated to a specific topic
            # (e.g. GROUP_MEMBERSHIP, SUBMISSION_DEADLINE) must not hijack it.
            if update_topic != "GENERAL" and not (question_topics & update_topics):
                continue

        relevance = _policy_update_relevance(question, update_content)
        if relevance < max(0.40, get_settings().rag_min_score):
            continue
        relevant.append({**update, "relevance": relevance})
    if not relevant:
        return None
    closest_scope = min(int(item["precedence"]) for item in relevant)
    candidates = [item for item in relevant if int(item["precedence"]) == closest_scope]
    # A newer saved update wins only among updates that actually match the
    # student's question. This is independent of file title or file name.
    return max(candidates, key=lambda item: (item["published_at"], item["relevance"]))


def _is_waiver_request(question: str) -> bool:
    lowered = question.casefold()
    waiver_patterns = (
        "xin phép",
        "xin phep",
        "xin ngoại lệ",
        "xin ngoai le",
        "xin gia hạn",
        "xin gia han",
        "xin miễn",
        "xin mien",
        "muốn phúc khảo",
        "muon phuc khao",
        "muốn đổi điểm",
        "muon doi diem",
        "phúc khảo",
        "phuc khao",
        "đổi điểm",
        "doi diem",
        "xem xét lại điểm",
        "xem xet lai diem",
        "cho nhóm em",
        "cho nhom em",
        "cho team em",
    )
    if any(token in lowered for token in waiver_patterns):
        return True
    if (
        re.search(r"\b(?:6|sáu|sau|7|bảy|bay|8|tám|tam|9|chín|chin|10|mười|muoi)\b", lowered)
        and infer_policy_topic(question) == "GROUP_MEMBERSHIP"
        and any(token in lowered for token in ("xin", "được không", "duoc khong", "phép", "phep"))
    ):
        return True
    return False


async def _prepend_policy_update_evidence(
    session: AsyncSession, update: dict, evidence: list[dict]
) -> list[dict]:
    chunk_id = update.get("source_chunk_id")
    if not chunk_id:
        return evidence
    row = await session.execute(
        select(DocumentChunk, Document)
        .join(Document, Document.id == DocumentChunk.document_id)
        .where(DocumentChunk.id == chunk_id)
    )
    item = row.first()
    if item is None:
        return evidence
    chunk, document = item
    preferred = {
        "label": "PU1",
        "chunk_id": chunk.id,
        "document_id": document.id,
        "document_title": document.title,
        "page_number": chunk.page_number,
        "heading": chunk.heading,
        "content": chunk.content,
        "score": 1.0,
    }
    return [preferred, *[entry for entry in evidence if entry["chunk_id"] != chunk.id]]


def _policy_update_decision(update: dict, evidence: list[dict]) -> RefereeDecision:
    excerpt = " ".join(str(update["content"]).split())[:1000]
    return RefereeDecision(
        route=Route.ANSWER,
        policy_coverage=PolicyCoverage.DIRECT,
        policy_topic=canonical_policy_topic(str(update["policy_topic"])),
        uncertainty_type=UncertaintyType.NONE,
        reason_code="ACTIVE_POLICY_UPDATE",
        answer=f"Theo cập nhật quy định đang có hiệu lực: {excerpt}",
        citation_labels=[evidence[0]["label"]] if evidence else [],
        confidence=1,
    )


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
    if any(token in lowered for token in SUSPICIOUS_TOKENS):
        return RefereeDecision(
            route=Route.REJECT,
            policy_coverage=PolicyCoverage.SUSPICIOUS,
            policy_topic="SECURITY",
            uncertainty_type=UncertaintyType.SUSPICIOUS_INPUT,
            reason_code="SUSPICIOUS_INPUT",
            answer=(
                "Yêu cầu bị từ chối vì có dấu hiệu can thiệp hệ thống hoặc vi phạm quy định. "
                "Hệ thống không thực hiện thay đổi dữ liệu, điểm số hay phê duyệt ngoại lệ."
            ),
            confidence=1,
        )
    topic = infer_policy_topic(text)
    if any(token in lowered for token in ("thiếu thông tin", "chưa rõ môn", "nhóm nào")):
        return RefereeDecision(
            route=Route.CLARIFY,
            policy_coverage=PolicyCoverage.MISSING_FACT,
            policy_topic="GENERAL",
            uncertainty_type=UncertaintyType.MISSING_FACT,
            reason_code="MISSING_CONCRETE_FACT",
            clarifying_question="Bạn đang hỏi về nhóm và học kỳ cụ thể nào?",
            confidence=1,
        )
    if (
        any(
            token in lowered
            for token in (
                "trường hợp này",
                "việc đó",
                "cái này",
                "như thế này",
                "như vậy có được không",
            )
        )
        and topic == "GENERAL"
    ):
        return RefereeDecision(
            route=Route.CLARIFY,
            policy_coverage=PolicyCoverage.MISSING_FACT,
            policy_topic="GENERAL",
            uncertainty_type=UncertaintyType.MISSING_FACT,
            reason_code="MISSING_CONCRETE_FACT",
            clarifying_question=(
                "Bạn có thể nêu rõ tình huống hoặc quy định cụ thể đang muốn hỏi không?"
            ),
            confidence=1,
        )
    if not has_group and topic in {"GROUP_MEMBERSHIP", "AI_USAGE"}:
        return RefereeDecision(
            route=Route.CLARIFY,
            policy_coverage=PolicyCoverage.MISSING_FACT,
            policy_topic="GROUP_CONTEXT",
            uncertainty_type=UncertaintyType.MISSING_FACT,
            reason_code="MISSING_GROUP_CONTEXT",
            clarifying_question=(
                "Bạn hãy chọn nhóm của mình trong học phần này để mình kiểm tra đúng phạm vi."
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
            escalation_target=EscalationTarget.COURSE_LECTURER,
            decision_question=(
                "Giảng viên xác nhận phiên bản chính sách nào đang có hiệu lực cho học phần?"
            ),
            confidence=1,
        )
    return None


def _safe_ai_failure(reason_code: str = "AI_UNAVAILABLE") -> RefereeDecision:
    return RefereeDecision(
        route=Route.ESCALATE,
        policy_coverage=PolicyCoverage.AI_UNAVAILABLE,
        policy_topic="AI_AVAILABILITY",
        uncertainty_type=UncertaintyType.AI_UNAVAILABLE,
        reason_code=reason_code,
        escalation_target=EscalationTarget.COURSE_LECTURER,
        decision_question="Giảng viên có thể xem xét và đưa ra quyết định cho yêu cầu này không?",
        confidence=0,
    )


def _approved_exception_decision(
    question: str, exceptions: list[dict], evidence: list[dict]
) -> RefereeDecision | None:
    """Enforce approved lecturer exceptions ahead of every document version."""
    topic = canonical_policy_topic(infer_policy_topic(question))
    applicable = [
        item for item in exceptions
        if canonical_policy_topic(str(item.get("policy_topic", "GENERAL"))) == topic
    ]
    if not applicable:
        return None
    exception = applicable[0]  # _load_exceptions already orders by scope.
    return RefereeDecision(
        route=Route.ANSWER,
        policy_coverage=PolicyCoverage.APPLICABLE_EXCEPTION,
        policy_topic=topic,
        uncertainty_type=UncertaintyType.NONE,
        reason_code="APPLICABLE_SCOPED_EXCEPTION",
        answer=f"Theo ngoại lệ đang có hiệu lực cho phạm vi của bạn: {exception['content']}",
        citation_labels=[evidence[0]["label"]] if evidence else [],
        confidence=1,
        applied_exception_id=str(exception["id"]),
    )


async def submit_question(
    session: AsyncSession,
    payload: QuestionCreate,
    *,
    provider: AIProvider,
    request_id: str | None,
    parent_question_id: str | None = None,
    clarification_round: int = 0,
) -> QuestionResponse:
    actor = await session.get(Actor, payload.actor_id)
    if actor is None:
        raise AppError("ACTOR_NOT_FOUND", "Không tìm thấy người dùng.", status_code=404)
    course = await session.get(Course, payload.course_id)
    if course is None:
        raise AppError("COURSE_NOT_FOUND", "Không tìm thấy học phần.", status_code=404)

    group = await _resolve_group(session, actor.id, course.id, payload.group_id)
    question = Question(
        id=new_id("q"),
        parent_question_id=parent_question_id,
        clarification_round=clarification_round,
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
    if parent_question_id:
        add_audit_event(
            session,
            event_type="CLARIFICATION_SUBMITTED",
            actor_id=actor.id,
            entity_type="question",
            entity_id=question.id,
            request_id=request_id,
            input_snapshot={
                "parent_question_id": parent_question_id,
                "round": clarification_round,
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
    policy_updates = await _load_policy_updates(
        session,
        actor_id=actor.id,
        group_id=group.id if group else None,
        course_id=course.id,
    )
    selected_policy_update = _applicable_policy_update(payload.text, policy_updates)
    update_document_ids = {
        str(update["source_document_id"])
        for update in policy_updates
        if update.get("source_document_id")
    }
    # Update-source chunks must not leak into ordinary RAG retrieval. They are
    # considered only through the relevance/recency resolver above; otherwise
    # an unrelated supplement could shadow base policy by coincidence.
    evidence = [
        item for item in evidence if str(item["document_id"]) not in update_document_ids
    ]
    if selected_policy_update:
        evidence = await _prepend_policy_update_evidence(
            session, selected_policy_update, evidence
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
        output_snapshot={
            "count": len(evidence),
            "exception_ids": [e["id"] for e in exceptions],
            "policy_update_id": selected_policy_update["id"] if selected_policy_update else None,
        },
    )
    # Retrieval and scope data are now durable; release the connection before
    # the model decision call. A provider failure is recorded in a new transaction.
    await session.commit()

    decision = _guardrail_decision(
        payload.text,
        has_group=group is not None,
        has_conflicting_evidence=False,
    )
    if decision is None:
        # A lecturer-approved scoped exception is a hard precedence rule; the
        # provider receives it too, but cannot accidentally answer from a
        # newer/older document instead.
        decision = _approved_exception_decision(payload.text, exceptions, evidence)
    if decision is None and selected_policy_update:
        if not _is_waiver_request(payload.text):
            decision = _policy_update_decision(selected_policy_update, evidence)
    if decision is None and has_conflicting_evidence:
        decision = _guardrail_decision(
            payload.text,
            has_group=group is not None,
            has_conflicting_evidence=True,
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

    if decision.route == Route.CLARIFY and clarification_round >= MAX_CLARIFICATION_ROUNDS:
        decision = RefereeDecision(
            route=Route.ESCALATE,
            policy_coverage=PolicyCoverage.UNRESOLVED,
            policy_topic=resolve_policy_topic(payload.text, decision.policy_topic),
            uncertainty_type=UncertaintyType.MISSING_FACT,
            reason_code="CLARIFICATION_LIMIT_REACHED",
            escalation_target=EscalationTarget.COURSE_LECTURER,
            decision_question=(
                "Thông tin vẫn chưa đủ rõ sau hai lượt bổ sung; "
                "giảng viên vui lòng xem xét hồ sơ này."
            ),
            confidence=0,
        )

    if _is_waiver_request(payload.text) and decision.route == Route.ANSWER:
        decision = RefereeDecision(
            route=Route.ESCALATE,
            policy_coverage=PolicyCoverage.REQUESTS_WAIVER,
            policy_topic=resolve_policy_topic(payload.text, decision.policy_topic),
            uncertainty_type=UncertaintyType.AUTHORITY_REQUIRED,
            reason_code="STUDENT_REQUESTS_WAIVER",
            escalation_target=EscalationTarget.COURSE_LECTURER,
            decision_question="Giảng viên có phê duyệt yêu cầu vượt ngoài quy định hiện hành không?",
            confidence=1,
        )

    decision.policy_topic = resolve_policy_topic(payload.text, decision.policy_topic)
    eligible_exceptions = {item["id"]: item for item in exceptions}
    if decision.policy_coverage == PolicyCoverage.APPLICABLE_EXCEPTION:
        exception = eligible_exceptions.get(decision.applied_exception_id or "")
        expected_scope_ids = {
            "STUDENT": actor.id,
            "GROUP": group.id if group else None,
            "COURSE": course.id,
        }
        exception_is_valid = bool(
            exception
            and canonical_policy_topic(str(exception.get("policy_topic"))) == decision.policy_topic
            and exception.get("course_id") == course.id
            and exception.get("scope_id")
            == expected_scope_ids.get(str(exception.get("scope_type")))
            and (
                canonical_policy_topic(str(exception.get("policy_topic"))) == "GENERAL"
                or infer_policy_topic(payload.text) == decision.policy_topic
            )
        )
        if not exception_is_valid:
            ai_failed = True
            ai_failure_snapshot = {"failure_type": "INVALID_APPLIED_EXCEPTION_REFERENCE"}
            decision = _safe_ai_failure("INVALID_APPLIED_EXCEPTION_REFERENCE")
            decision.policy_topic = resolve_policy_topic(payload.text, decision.policy_topic)
        else:
            question.applied_exception_id = str(decision.applied_exception_id)
    duration_ms = round((perf_counter() - started) * 1000)

    stored_question = await session.get(Question, question.id)
    if stored_question is None:
        raise AppError(
            "QUESTION_NOT_FOUND",
            "Câu hỏi không còn tồn tại hoặc phiên làm việc đã được đặt lại.",
            status_code=409,
        )
    question = stored_question

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
    elif decision.route == Route.OUT_OF_SCOPE:
        question.status = QuestionStatus.OUT_OF_SCOPE
        terminal_event = "OUT_OF_SCOPE_RETURNED"
    elif decision.route == Route.REJECT:
        question.status = QuestionStatus.REJECTED
        terminal_event = "REQUEST_REJECTED"
    else:
        question.status = QuestionStatus.ESCALATED
        terminal_event = "CASE_ESCALATED"

        # Every request requiring a human decision belongs to the demo lecturer.
        target = EscalationTarget.COURSE_LECTURER
        assigned_reviewer_id = "lecturer-01"
        ai_summary = f"Yêu cầu ngoại lệ môn học (chuyển Giảng viên): {payload.text}"
        decision_question = decision.decision_question or "Giảng viên có phê duyệt không?"
        question.escalation_target = target.value
        case = EscalationCase(
            id=new_id("case"),
            question_id=question.id,
            status=CaseStatus.UNDER_REVIEW,
            reason_code=decision.reason_code,
            uncertainty_type=decision.uncertainty_type,
            escalation_target=target.value,
            ai_summary=ai_summary,
            decision_question=decision_question,
            assigned_reviewer_id=assigned_reviewer_id,
            sla_due_at=datetime.now(UTC) + timedelta(hours=CASE_SLA_HOURS),
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
            reason_code=decision.reason_code,
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
    if question.applied_exception_id:
        add_audit_event(
            session,
            event_type="EXCEPTION_APPLIED",
            actor_id=actor.id,
            entity_type="question",
            entity_id=question.id,
            request_id=request_id,
            output_snapshot={
                "applied_exception_id": question.applied_exception_id,
                "policy_topic": question.policy_topic,
                "course_id": question.course_id,
                "group_id": question.group_id,
            },
            reason_code="APPLICABLE_SCOPED_EXCEPTION",
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
    return _build_question_response(
        question,
        case,
        evidence,
        decision.citation_labels,
        applied_exception_id=question.applied_exception_id,
    )


def _build_question_response(
    question: Question,
    case: EscalationCase | None,
    evidence: list[dict],
    labels: list[str],
    final_decision: HumanDecision | None = None,
    exception_id: str | None = None,
    applied_exception_id: str | None = None,
) -> QuestionResponse:
    citations = [
        CitationResponse(
            label=item["label"],
            chunk_id=item["chunk_id"],
            document_id=item["document_id"],
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
        escalation_target=(case.escalation_target if case else question.escalation_target),
        answer=question.answer,
        clarifying_question=question.clarifying_question,
        case_id=case.id if case else None,
        final_decision=final_decision.decision if final_decision else None,
        final_decision_reason=final_decision.reason if final_decision else None,
        exception_id=exception_id,
        applied_exception_id=applied_exception_id or question.applied_exception_id,
        parent_question_id=question.parent_question_id,
        clarification_round=question.clarification_round,
        citations=citations,
        created_at=question.created_at,
        text=question.text,
        course_id=question.course_id,
        group_id=question.group_id,
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
        question.applied_exception_id,
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
            "document_id": document.id,
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
    group_id: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[QuestionResponse]:
    stmt = select(Question).order_by(Question.created_at.desc()).limit(limit).offset(offset)
    if actor_id:
        stmt = stmt.where(Question.actor_id == actor_id)
    if course_id:
        stmt = stmt.where(Question.course_id == course_id)
    if group_id:
        stmt = stmt.where(Question.group_id == group_id)
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
                question.applied_exception_id,
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
                "document_id": document.id,
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
