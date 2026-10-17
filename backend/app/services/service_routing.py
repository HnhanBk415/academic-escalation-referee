"""Catalog-gated service intake and the one approved write action."""

import json
import re
import unicodedata
from datetime import UTC, datetime, timedelta
from pathlib import Path

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.base import AIProvider
from app.core.auth import CurrentActor
from app.core.enums import ActorRole, Route
from app.core.errors import AppError
from app.core.privacy import contains_health_details, redact_slots, redact_text
from app.models import Actor, Document, Group, GroupMembership, ServiceRequest
from app.rag.service import retrieve_evidence
from app.schemas.service_routing import ServiceRequestCreate, ServiceRequestResponse
from app.services.audit import add_audit_event
from app.services.ids import new_id

DATA_ROOT = Path(__file__).resolve().parents[3] / "data"
SLOT_KEYS = {"group_id", "member_ref", "record_id", "time_slot", "course_code", "topic"}
CLINIC_SAFETY_MESSAGE = (
    "Nếu bạn cần hỗ trợ y tế khẩn cấp, hãy liên hệ ngay cơ sở y tế "
    "hoặc dịch vụ cấp cứu phù hợp tại nơi bạn đang ở."
)


def catalog() -> list[dict]:
    payload = json.loads((DATA_ROOT / "service-catalog.json").read_text(encoding="utf-8"))
    return payload["services"]


def _service(service_id: str) -> dict | None:
    return next((item for item in catalog() if item["service_id"] == service_id), None)


def _request_id(value: str | None) -> str:
    return value if value and re.fullmatch(r"[A-Za-z0-9_-]{1,64}", value) else new_id("req")


def _response(item: ServiceRequest) -> ServiceRequestResponse:
    service = _service(item.service_id)
    return ServiceRequestResponse(
        id=item.id,
        request_id=item.request_id,
        actor_id=item.actor_id,
        service_id=item.service_id,
        organization_id=service["organization_id"] if service else "academic_affairs",
        intent=item.intent,
        status=item.status,
        reason_code=item.reason_code,
        confidence=item.confidence,
        slots=item.slots,
        missing_fields=item.missing_fields,
        result=item.result,
        policy_source=item.policy_source,
        policy_version=item.policy_version,
        sla_due_at=item.sla_due_at,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


def _safe_slots(values: dict[str, str]) -> dict[str, str]:
    if set(values) - SLOT_KEYS or any(not isinstance(v, str) or len(v) > 200 for v in values.values()):
        raise AppError("INVALID_SLOTS", "Trường bổ sung không hợp lệ.", status_code=422)
    return redact_slots(values)


def _read_record(service_id: str, record_id: str, actor_id: str) -> dict | None:
    path = DATA_ROOT / "service-records.json"
    if not path.is_file():
        return None
    records = json.loads(path.read_text(encoding="utf-8")).get(service_id, [])
    return next(
        (record for record in records if record["record_id"] == record_id and record["actor_id"] == actor_id),
        None,
    )


def _is_rubric_question(text: str) -> bool:
    lowered = text.casefold()
    return any(term in lowered for term in ("rubric", "tiêu chí", "tỷ lệ", "chấm", "thang điểm"))


def _is_personal_grade_request(text: str) -> bool:
    lowered = text.casefold()
    return any(
        term in lowered
        for term in ("điểm của em", "điểm của tôi", "điểm nhóm em", "phúc khảo", "sửa điểm", "đổi điểm", "khiếu nại")
    )


async def _answer_from_service_dataset(
    session: AsyncSession,
    item: ServiceRequest,
    service: dict,
    provider: AIProvider,
) -> tuple[str, dict] | None:
    """Retrieve and decide only with chunks indexed inside the selected service."""
    retrieval_scope = service.get("retrieval_scope")
    if service["service_id"] == "faculty_cs":
        program_scopes = service.get("retrieval_scopes", {})
        course_code = item.slots.get("course_code", "").upper()
        if course_code in ("DADN", "DADN-HK242"):
            retrieval_scope = program_scopes.get("DADN", retrieval_scope)
        elif course_code == "CO3001":
            retrieval_scope = program_scopes.get("CO3001")
    if not retrieval_scope:
        return None
    evidence = await retrieve_evidence(
        session, provider=provider, question=item.text, course_id=retrieval_scope
    )
    if not evidence:
        return None
    documents = {
        document.id: document
        for document in (
            await session.scalars(
                select(Document).where(Document.id.in_({e["document_id"] for e in evidence}))
            )
        ).all()
    }
    if any(entry["document_id"] not in documents for entry in evidence):
        return None
    for index, entry in enumerate(evidence, start=1):
        entry["label"] = f"C{index}"
    try:
        decision = await provider.decide(
            item.text,
            {"actor_id": item.actor_id, "service_id": service["service_id"]},
            evidence,
            [],
        )
    except Exception:
        return None
    selected = [entry for entry in evidence if entry["label"] in decision.citation_labels]
    citations = [
        {
            "label": entry["label"],
            "document_id": entry["document_id"],
            "document_title": entry["document_title"],
            "source_path": documents[entry["document_id"]].source_path,
            "page_number": entry["page_number"],
            "chunk_id": entry["chunk_id"],
        }
        for entry in selected
    ]
    return decision.route.value, {
        "decision": decision,
        "evidence": citations,
        "documents": documents,
    }


async def _group_rule(session: AsyncSession, item: ServiceRequest) -> str | None:
    group_id = item.slots.get("group_id")
    member_id = item.slots.get("member_ref")
    group = await session.scalar(
        select(Group).where(Group.id == group_id).with_for_update()
    ) if group_id else None
    member = await session.scalar(
        select(Actor).where(Actor.id == member_id).with_for_update()
    ) if member_id else None
    if group is None or group.course_id != "DADN-HK242":
        return "GROUP_NOT_FOUND"
    if member is None or member.role != ActorRole.STUDENT:
        return "MEMBER_NOT_FOUND"
    requester = await session.get(Actor, item.actor_id)
    if requester is None or requester.role != ActorRole.STUDENT:
        return "REQUESTER_ROLE_NOT_AUTHORIZED"
    owner = await session.scalar(
        select(GroupMembership).where(
            GroupMembership.actor_id == item.actor_id,
            GroupMembership.group_id == group.id,
        )
    )
    if owner is None:
        return "GROUP_NOT_AUTHORIZED"
    existing = await session.scalar(
        select(GroupMembership).where(
            GroupMembership.actor_id == member_id,
            GroupMembership.group_id == group.id,
        )
    )
    if existing is not None:
        return "MEMBER_ALREADY_IN_GROUP"
    member_other_group = await session.scalar(
        select(GroupMembership)
        .join(Group, GroupMembership.group_id == Group.id)
        .where(GroupMembership.actor_id == member_id, Group.course_id == group.course_id)
    )
    if member_other_group is not None:
        return "MEMBER_ALREADY_IN_COURSE_GROUP"
    count = await session.scalar(
        select(func.count()).select_from(GroupMembership).where(GroupMembership.group_id == group.id)
    )
    if int(count or 0) >= 5:
        return "GROUP_FULL"
    return None


def _audit(session: AsyncSession, item: ServiceRequest, event: str, actor_id: str) -> None:
    add_audit_event(
        session,
        event_type=event,
        actor_id=actor_id,
        entity_type="service_request",
        entity_id=item.id,
        request_id=item.request_id,
        input_snapshot={"text": item.text, "slots": item.slots} if event == "SERVICE_REQUEST_RECEIVED" else {},
        output_snapshot={
            "service_id": item.service_id,
            "intent": item.intent,
            "status": item.status,
            "result": item.result,
        },
        evidence_ids=[
            str(citation["chunk_id"])
            for citation in item.result.get("citations", [])
            if isinstance(citation, dict) and citation.get("chunk_id")
        ],
        reason_code=item.reason_code,
    )


async def _advance(session: AsyncSession, item: ServiceRequest, provider: AIProvider) -> None:
    service = _service(item.service_id)
    if service is None:
        item.service_id = "triage_desk"
        item.intent = "manual_review"
        item.reason_code = "SERVICE_NOT_YET_CATALOGED"
        service = _service("triage_desk")
    item.policy_source = service.get("policy_source")
    item.policy_version = service.get("policy_version")
    item.sla_due_at = datetime.now(UTC) + timedelta(hours=service["sla_hours"])
    if item.policy_source and not (DATA_ROOT.parent / item.policy_source).is_file():
        item.status = "WAITING_FOR_STAFF"
        item.reason_code = "POLICY_SOURCE_UNAVAILABLE"
        item.policy_source = None
        item.policy_version = None
        item.missing_fields = []
        item.result = {"next_step": "Đơn vị phụ trách kiểm tra nguồn quy định."}
        return
    required = service.get("required_fields", {}).get(item.intent, [])
    item.missing_fields = [field for field in required if not item.slots.get(field)]
    if item.missing_fields:
        item.status = "NEEDS_INFO"
        item.reason_code = "MISSING_REQUIRED_INFORMATION"
        item.result = {"next_step": f"Bổ sung: {', '.join(item.missing_fields)}"}
        return
    if item.service_id == "triage_desk":
        item.status = "WAITING_FOR_STAFF"
        item.result = {"next_step": "Bộ phận điều phối xác định đầu mối xử lý."}
        return
    if item.intent == "add_group_member":
        if "add_member_to_group" not in service["allowed_actions"]:
            item.status = "WAITING_FOR_STAFF"
            item.reason_code = "MANUAL_REVIEW_REQUIRED"
            item.result = {"next_step": "Hành động không có trong danh sách cho phép."}
            return
        target_group = await session.get(Group, item.slots.get("group_id"))
        if target_group is not None and target_group.course_id != "DADN-HK242":
            item.status = "WAITING_FOR_STAFF"
            item.reason_code = "MANUAL_REVIEW_REQUIRED"
            item.result = {
                "message": "Thao tác tự động hiện chỉ hỗ trợ nhóm DADN đã cấu hình.",
                "next_step": "Yêu cầu CO3001 được chuyển giảng viên phụ trách xem xét.",
            }
            return
        reason = await _group_rule(session, item)
        if reason:
            item.status = "WAITING_FOR_STAFF" if reason == "GROUP_FULL" else "REJECTED"
            item.reason_code = reason
            item.result = {"next_step": "Chuyển giảng viên xem xét."} if reason == "GROUP_FULL" else {}
        else:
            item.status = "AWAITING_CONFIRMATION"
            item.reason_code = None
            item.result = {
                "preview": {
                    "action": "add_member_to_group",
                    "group_id": item.slots["group_id"],
                    "member_ref": item.slots["member_ref"],
                },
                "next_step": "Sinh viên xác nhận, sau đó giảng viên phê duyệt.",
            }
        return
    if item.intent in ("request_status", "appointment_status"):
        if "read_record" not in service["allowed_actions"]:
            item.status = "WAITING_FOR_STAFF"
            item.reason_code = "MANUAL_REVIEW_REQUIRED"
            item.result = {"next_step": "Tra cứu cần nhân viên xử lý."}
            return
        record = _read_record(item.service_id, item.slots["record_id"], item.actor_id)
        if record is None:
            item.status = "WAITING_FOR_STAFF"
            item.reason_code = "RECORD_NOT_FOUND"
            item.result = {"next_step": "Nhân viên kiểm tra mã hồ sơ."}
        else:
            item.status = "COMPLETED"
            item.reason_code = None
            item.result = {
                "record": record, "action": "read_record", "verified": True,
                "data_label": "DỮ LIỆU GIẢ LẬP",
            }
        return
    rubric_question = (
        item.service_id == "faculty_cs"
        and item.intent == "grade_inquiry"
        and _is_rubric_question(item.text)
        and not _is_personal_grade_request(item.text)
    )
    policy_question = item.intent in (
        "policy_faq", "hours", "contact", "group_exception"
    ) or rubric_question
    if (
        item.service_id == "faculty_cs"
        and policy_question
        and not item.slots.get("course_code")
    ):
        item.status = "NEEDS_INFO"
        item.reason_code = "MISSING_REQUIRED_INFORMATION"
        item.missing_fields = ["course_code"]
        item.result = {
            "clarifying_question": "Bạn đang hỏi về đồ án chuyên ngành CO3001 hay đồ án đa ngành DADN?",
            "next_step": "Chọn đúng chương trình để tra cứu bộ tài liệu tương ứng.",
        }
        return
    if (
        item.service_id == "faculty_cs"
        and policy_question
        and item.slots.get("course_code", "").upper() not in ("DADN", "DADN-HK242", "CO3001")
    ):
        item.status = "WAITING_FOR_STAFF"
        item.reason_code = "POLICY_SOURCE_UNAVAILABLE"
        item.result = {
            "message": "Kho tài liệu hiện chỉ có policy cho DADN và CO3001.",
            "next_step": "Giảng viên xác định nguồn phù hợp hoặc phản hồi trực tiếp.",
        }
        return
    if (
        item.service_id == "faculty_cs"
        and item.intent == "grade_inquiry"
        and not rubric_question
    ):
        item.status = "WAITING_FOR_STAFF"
        item.reason_code = "MANUAL_REVIEW_REQUIRED"
        item.result = {
            "next_step": (
                "Giảng viên phụ trách xem xét và quyết định yêu cầu."
                if item.service_id == "faculty_cs"
                else "Đơn vị phụ trách xem xét yêu cầu."
            )
        }
        return
    if policy_question:
        if "answer_policy" not in service["allowed_actions"]:
            item.status = "WAITING_FOR_STAFF"
            item.reason_code = "MANUAL_REVIEW_REQUIRED"
            item.result = {"next_step": "Đơn vị phụ trách xem xét yêu cầu."}
            return
        retrieved = await _answer_from_service_dataset(session, item, service, provider)
        if retrieved is None:
            item.status = "WAITING_FOR_STAFF"
            item.reason_code = "POLICY_SOURCE_UNAVAILABLE"
            item.result = {"next_step": "Đơn vị phụ trách kiểm tra policy trong kho tài liệu."}
            return
        route, context = retrieved
        decision = context["decision"]
        citations = context["evidence"]
        documents = context["documents"]
        if decision.citation_labels and len(citations) != len(decision.citation_labels):
            item.status = "WAITING_FOR_STAFF"
            item.reason_code = "POLICY_SOURCE_UNAVAILABLE"
            item.result = {"next_step": "Đơn vị phụ trách xác minh trích dẫn policy."}
            return
        if citations:
            source_document = documents[citations[0]["document_id"]]
            item.policy_source = source_document.source_path
            item.policy_version = source_document.version
        if item.service_id == "academic_affairs" and any(
            term in item.text.casefold()
            for term in (
                "điều kiện tiên quyết", "điều kiện học", "được đăng ký không",
                "đăng ký được không", "còn chỗ", "còn suất", "chỗ trống",
                "số chỗ", "sức chứa", "lịch học", "trùng lịch",
                "đủ điều kiện", "hạn đăng ký",
            )
        ):
            item.status = "WAITING_FOR_STAFF"
            item.reason_code = "POLICY_SOURCE_UNAVAILABLE"
            item.result = {
                "message": "Kho tài liệu hiện chưa có dữ liệu đã duyệt để kết luận điều kiện học phần này.",
                "next_step": "Phòng Đào tạo kiểm tra thông tin học phần và phản hồi.",
                "citations": citations,
            }
            return
        if (
            route == Route.ANSWER.value
            and decision.answer
            and citations
            and item.intent != "group_exception"
        ):
            item.status = "ANSWERED"
            item.reason_code = None
            item.result = {
                "answer": decision.answer,
                "citations": citations,
                "source": item.policy_source,
                "version": item.policy_version,
            }
        elif route == Route.CLARIFY.value:
            item.status = "NEEDS_INFO"
            item.reason_code = "MISSING_REQUIRED_INFORMATION"
            item.missing_fields = ["context"]
            item.result = {
                "clarifying_question": decision.clarifying_question,
                "next_step": decision.clarifying_question or "Bổ sung bối cảnh để tra cứu đúng policy.",
                "citations": citations,
            }
        elif route == Route.REJECT.value:
            item.status = "REJECTED"
            item.reason_code = decision.reason_code or "POLICY_REJECTED"
            item.result = {"message": decision.answer or "Không thể xử lý yêu cầu này."}
        else:
            item.status = "WAITING_FOR_STAFF"
            item.reason_code = (
                "MANUAL_REVIEW_REQUIRED"
                if item.intent == "group_exception"
                else decision.reason_code or "MANUAL_REVIEW_REQUIRED"
            )
            owner = service["display_name"]
            if item.service_id == "faculty_cs":
                next_step = "Giảng viên phụ trách xem xét và quyết định."
            elif item.service_id == "clinic":
                next_step = "Nhân viên Trạm Y tế xem xét và phản hồi."
            else:
                next_step = "Chuyên viên Phòng Đào tạo xem xét và phản hồi."
            item.result = {
                "decision_question": decision.decision_question,
                "message": f"Đã chuyển yêu cầu đến {owner} để xem xét.",
                "next_step": next_step,
                "citations": citations,
            }
        return
    if item.intent in ("course_registration", "transcript_request", "appointment_request", "appointment_cancel", "grade_inquiry"):
        item.status = "WAITING_FOR_STAFF"
        item.reason_code = "MANUAL_REVIEW_REQUIRED"
        item.result = {
            "message": "Đã tiếp nhận yêu cầu; chưa thực hiện thay đổi hoặc xác nhận kết quả.",
            "next_step": "Đơn vị phụ trách kiểm tra và xử lý yêu cầu.",
        }
        return
    item.service_id = "triage_desk"
    item.intent = "manual_review"
    item.status = "WAITING_FOR_STAFF"
    item.reason_code = "SERVICE_NOT_YET_CATALOGED"
    item.result = {"next_step": "Bộ phận điều phối xác định đầu mối xử lý."}


async def create_service_request(
    session: AsyncSession,
    payload: ServiceRequestCreate,
    *,
    actor: CurrentActor,
    provider: AIProvider,
    request_id: str | None,
    idempotency_key: str | None,
) -> ServiceRequestResponse:
    if idempotency_key and not re.fullmatch(r"[A-Za-z0-9_-]{1,100}", idempotency_key):
        raise AppError("INVALID_IDEMPOTENCY_KEY", "Mã gửi lặp không hợp lệ.", status_code=422)
    if idempotency_key:
        existing = await session.scalar(
            select(ServiceRequest).where(
                ServiceRequest.actor_id == actor.id,
                ServiceRequest.idempotency_key == idempotency_key,
            )
        )
        if existing:
            return _response(existing)
    safe_text = redact_text(payload.text)
    safe_slots = _safe_slots(payload.slots)
    medical = contains_health_details(payload.text) or any(
        contains_health_details(value) for value in payload.slots.values()
    )
    if medical:
        safe_text = "[NỘI DUNG SỨC KHỎE ĐÃ ẨN]"
        safe_slots = {}
        service_id, intent, confidence = "clinic", "contact", 1.0
    else:
        try:
            proposal = await provider.classify_service(safe_text, catalog())
            service_id, intent, confidence = proposal.service_id, proposal.intent, proposal.confidence
            safe_slots = {**_safe_slots(proposal.slots), **safe_slots}
        except Exception:
            service_id, intent, confidence = "triage_desk", "manual_review", 0.0
    proposed_service_id, proposed_intent = service_id, intent
    service = _service(service_id)
    reason = None
    # An explicit registration action belongs to Academic Affairs. A question
    # about the registration process remains a policy query for service RAG.
    normalized_text = unicodedata.normalize("NFD", safe_text.casefold())
    normalized_text = "".join(
        char for char in normalized_text if unicodedata.category(char) != "Mn"
    ).replace("đ", "d")
    explicit_registration = service_id == "academic_affairs" and any(
        phrase in normalized_text
        for phrase in ("em muon dang ky", "dang ky giup em", "dang ky cho em", "em xin dang ky")
    )
    if explicit_registration:
        service_id, intent = "academic_affairs", "course_registration"
        service = _service(service_id)
    if service is None or intent not in service["supported_intents"]:
        service_id, intent, reason = "triage_desk", "manual_review", "SERVICE_NOT_YET_CATALOGED"
    elif confidence < 0.75:
        service_id, intent, reason = "triage_desk", "manual_review", "LOW_ROUTING_CONFIDENCE"
    elif intent in {
        "add_group_member",
        "course_registration",
        "transcript_request",
        "appointment_request",
        "appointment_cancel",
    } and actor.role != service.get("required_role"):
        raise AppError(
            "ROLE_NOT_AUTHORIZED",
            "Tài khoản có thể hỏi thông tin nhưng không có quyền gửi yêu cầu thay đổi này.",
            status_code=403,
        )
    item = ServiceRequest(
        id=new_id("sr"),
        actor_id=actor.id,
        request_id=_request_id(request_id),
        idempotency_key=idempotency_key,
        text=safe_text,
        service_id=service_id,
        intent=intent,
        status="SUBMITTED",
        reason_code=reason,
        confidence=confidence,
        slots=safe_slots,
        missing_fields=[],
        result={},
    )
    session.add(item)
    if medical:
        item.status = "SAFETY_MESSAGE"
        item.reason_code = "MEDICAL_SAFETY_MESSAGE"
        item.result = {"message": CLINIC_SAFETY_MESSAGE}
        service = _service("clinic")
        item.policy_source = service["policy_source"]
        item.policy_version = service["policy_version"]
    else:
        await _advance(session, item, provider)
    item.result = {
        **item.result,
        "routing": {
            "proposed_service_id": proposed_service_id,
            "proposed_intent": proposed_intent,
            "validated_service_id": item.service_id,
            "validated_intent": item.intent,
        },
    }
    _audit(session, item, "SERVICE_REQUEST_RECEIVED", actor.id)
    await session.commit()
    await session.refresh(item)
    return _response(item)


async def get_service_request(
    session: AsyncSession, item_id: str, actor: CurrentActor
) -> tuple[ServiceRequest, ServiceRequestResponse]:
    item = await session.get(ServiceRequest, item_id)
    if item is None:
        raise AppError("SERVICE_REQUEST_NOT_FOUND", "Không tìm thấy yêu cầu.", status_code=404)
    owns_request = item.actor_id == actor.id
    assigned_department = (
        (actor.role == ActorRole.LECTURER and item.service_id == "faculty_cs")
        or (
            actor.role == ActorRole.ACADEMIC_AFFAIRS
            and item.service_id in ("academic_affairs", "triage_desk")
        )
        or (actor.role == ActorRole.CLINIC and item.service_id == "clinic")
    )
    if not owns_request and not assigned_department:
        raise AppError("SERVICE_REQUEST_NOT_AUTHORIZED", "Không có quyền xem yêu cầu.", status_code=403)
    return item, _response(item)


async def clarify_service_request(
    session: AsyncSession,
    item: ServiceRequest,
    *,
    actor: CurrentActor,
    text: str,
    slots: dict[str, str],
    provider: AIProvider,
) -> ServiceRequestResponse:
    if actor.id != item.actor_id or item.status != "NEEDS_INFO":
        raise AppError("CLARIFICATION_NOT_ALLOWED", "Yêu cầu này không chờ bổ sung.", status_code=409)
    routing = item.result.get("routing")
    if contains_health_details(text) or any(contains_health_details(v) for v in slots.values()):
        item.text = "[NỘI DUNG SỨC KHỎE ĐÃ ẨN]"
        item.slots = {}
        item.service_id = "clinic"
        item.intent = "contact"
        item.status = "SAFETY_MESSAGE"
        item.reason_code = "MEDICAL_SAFETY_MESSAGE"
        item.missing_fields = []
        item.result = {"message": CLINIC_SAFETY_MESSAGE}
        item.policy_source = _service("clinic")["policy_source"]
        item.policy_version = _service("clinic")["policy_version"]
    else:
        safe_text = redact_text(text)
        safe_slots = _safe_slots(slots)
        if not safe_slots:
            try:
                proposal = await provider.classify_service(f"{item.text}\n{safe_text}", catalog())
                safe_slots = _safe_slots(proposal.slots)
            except Exception:
                safe_slots = {}
        item.text = f"{item.text}\nThông tin bổ sung: {safe_text}"
        item.slots = {**item.slots, **safe_slots}
        await _advance(session, item, provider)
    if routing:
        item.result = {
            **item.result,
            "routing": {
                **routing,
                "validated_service_id": item.service_id,
                "validated_intent": item.intent,
            },
        }
    _audit(session, item, "SERVICE_REQUEST_CLARIFIED", actor.id)
    await session.commit()
    await session.refresh(item)
    return _response(item)


async def confirm_service_request(
    session: AsyncSession, item: ServiceRequest, actor: CurrentActor
) -> ServiceRequestResponse:
    if actor.id != item.actor_id or item.status != "AWAITING_CONFIRMATION":
        raise AppError("CONFIRMATION_NOT_ALLOWED", "Không thể xác nhận yêu cầu này.", status_code=409)
    routing = item.result.get("routing")
    reason = await _group_rule(session, item)
    if reason:
        item.status = "REJECTED"
        item.reason_code = reason
        item.result = {}
    else:
        item.status = "AWAITING_APPROVAL"
        item.confirmed_at = datetime.now(UTC)
        item.result = {"next_step": "Chờ giảng viên phê duyệt thay đổi thành viên."}
    if routing:
        item.result = {**item.result, "routing": routing}
    _audit(session, item, "SERVICE_REQUEST_CONFIRMED", actor.id)
    await session.commit()
    await session.refresh(item)
    return _response(item)


async def decide_service_request(
    session: AsyncSession,
    item: ServiceRequest,
    *,
    actor: CurrentActor,
    approved: bool,
    reason: str,
) -> ServiceRequestResponse:
    if actor.role != ActorRole.LECTURER:
        raise AppError("ROLE_NOT_AUTHORIZED", "Chỉ giảng viên được phê duyệt.", status_code=403)
    item = await session.scalar(
        select(ServiceRequest)
        .where(ServiceRequest.id == item.id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if item is None or item.status != "AWAITING_APPROVAL" or item.intent != "add_group_member":
        raise AppError("DECISION_NOT_ALLOWED", "Yêu cầu này không chờ phê duyệt.", status_code=409)
    if "add_member_to_group" not in _service("faculty_cs")["allowed_actions"]:
        raise AppError("ACTION_NOT_ALLOWED", "Hành động chưa được cho phép.", status_code=403)
    routing = item.result.get("routing")
    if not approved:
        item.status = "REJECTED"
        item.reason_code = "LECTURER_REJECTED"
        item.result = {"decision_reason": redact_text(reason)}
    else:
        rule = await _group_rule(session, item)
        if rule:
            item.status = "REJECTED"
            item.reason_code = rule
            item.result = {}
        else:
            session.add(GroupMembership(actor_id=item.slots["member_ref"], group_id=item.slots["group_id"]))
            try:
                await session.flush()
            except IntegrityError:
                await session.rollback()
                raise AppError(
                    "CONNECTOR_WRITE_CONFLICT", "Dữ liệu nhóm đã thay đổi; vui lòng kiểm tra lại.",
                    status_code=409,
                ) from None
            verified = await session.scalar(
                select(GroupMembership).where(
                    GroupMembership.actor_id == item.slots["member_ref"],
                    GroupMembership.group_id == item.slots["group_id"],
                )
            )
            if verified is None:
                await session.rollback()
                raise AppError("CONNECTOR_VERIFY_FAILED", "Không xác minh được kết quả.", status_code=503)
            item.status = "COMPLETED"
            item.reason_code = None
            item.approved_by = actor.id
            item.result = {
                "action": "add_member_to_group",
                "group_id": item.slots["group_id"],
                "member_ref": item.slots["member_ref"],
                "verified": True,
                "connector": "mock",
            }
    if routing:
        item.result = {**item.result, "routing": routing}
    _audit(session, item, "SERVICE_REQUEST_DECIDED", actor.id)
    await session.commit()
    await session.refresh(item)
    return _response(item)


async def handoff_triage_request(
    session: AsyncSession,
    item: ServiceRequest,
    *,
    actor: CurrentActor,
    destination_name: str,
    note: str,
) -> ServiceRequestResponse:
    if actor.role != ActorRole.ACADEMIC_AFFAIRS:
        raise AppError("ROLE_NOT_AUTHORIZED", "Chỉ bộ phận điều phối được bàn giao.", status_code=403)
    if item.service_id != "triage_desk" or item.status != "WAITING_FOR_STAFF":
        raise AppError("HANDOFF_NOT_ALLOWED", "Yêu cầu này không chờ điều phối.", status_code=409)
    destination = redact_text(destination_name).strip()
    safe_note = redact_text(note).strip()
    if "[" in destination or "[" in safe_note:
        raise AppError("HANDOFF_SENSITIVE_DATA", "Không đưa dữ liệu nhạy cảm vào bàn giao.", status_code=422)
    item.status = "FORWARDED"
    item.reason_code = "MANUAL_REVIEW_REQUIRED"
    item.result = {
        **item.result,
        "destination_name": destination,
        "handoff_note": safe_note,
        "next_step": "Đầu mối được ghi nhận tiếp nhận và xử lý ngoài luồng tự động.",
    }
    _audit(session, item, "SERVICE_REQUEST_FORWARDED", actor.id)
    await session.commit()
    await session.refresh(item)
    return _response(item)


async def review_service_request(
    session: AsyncSession,
    item: ServiceRequest,
    *,
    actor: CurrentActor,
    message: str,
    outcome: str,
) -> ServiceRequestResponse:
    assigned_department = (
        (actor.role == ActorRole.LECTURER and item.service_id == "faculty_cs")
        or (
            actor.role == ActorRole.ACADEMIC_AFFAIRS
            and item.service_id in ("academic_affairs", "triage_desk")
        )
        or (actor.role == ActorRole.CLINIC and item.service_id == "clinic")
    )
    if not assigned_department:
        raise AppError("ROLE_NOT_AUTHORIZED", "Tài khoản không phụ trách hàng đợi này.", status_code=403)
    if item.status != "WAITING_FOR_STAFF":
        raise AppError("REVIEW_NOT_ALLOWED", "Yêu cầu này không chờ nhân viên xử lý.", status_code=409)
    safe_message = redact_text(message).strip()
    if len(safe_message) < 3:
        raise AppError("INVALID_STAFF_RESPONSE", "Phản hồi không hợp lệ sau khi lọc dữ liệu nhạy cảm.", status_code=422)
    routing = item.result.get("routing")
    if outcome == "resolve":
        item.status = "COMPLETED"
        item.reason_code = None
        item.result = {
            "staff_response": safe_message,
            "resolution_mode": "human",
            "resolved_by": actor.id,
            "next_step": "Đơn vị phụ trách đã ghi nhận kết quả xử lý.",
        }
    else:
        item.result = {
            **item.result,
            "staff_response": safe_message,
            "next_step": "Yêu cầu vẫn đang chờ đơn vị phụ trách xử lý.",
        }
    if routing:
        item.result["routing"] = routing
    _audit(session, item, "SERVICE_REQUEST_STAFF_REVIEWED", actor.id)
    await session.commit()
    await session.refresh(item)
    return _response(item)
