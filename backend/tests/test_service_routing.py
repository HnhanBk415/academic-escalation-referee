import pytest
from conftest import TestSession
from sqlalchemy import func, select

from app.ai.fake import FakeProvider
from app.api.deps import get_ai_provider
from app.main import app
from app.models import (
    AuditEvent,
    Document,
    DocumentChunk,
    GroupMembership,
    Question,
    ServiceRequest,
)
from app.schemas.service_routing import ServiceClassification

STUDENT = {"X-Demo-Actor-ID": "demo-student-01"}
LECTURER = {"X-Demo-Actor-ID": "lecturer-01"}


@pytest.mark.asyncio
async def test_dadn_pdf_is_indexed_and_service_request_answers_rubric_with_citation(client):
    async with TestSession() as session:
        rows = (await session.execute(
            select(Document.id, func.count(DocumentChunk.id))
            .join(DocumentChunk, DocumentChunk.document_id == Document.id)
            .where(Document.course_id == "DADN-HK242", Document.document_type == "PDF")
            .group_by(Document.id)
        )).all()
    assert {document_id for document_id, _ in rows} == {
        "dadn-course-plan", "dadn-rubric", "dadn-work-plan"
    }
    assert all(chunk_count > 0 for _, chunk_count in rows)

    response = await client.post(
        "/api/v1/service-requests", headers=STUDENT,
        json={"text": "Rubric DADN có tỷ lệ điểm giữa kỳ và báo cáo tổng kết bao nhiêu?"},
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["service_id"] == "faculty_cs"
    assert body["status"] == "ANSWERED"
    assert "10%" in body["result"]["answer"]
    assert "40%" in body["result"]["answer"]
    assert body["result"]["citations"][0]["source_path"].endswith("DADN/dadn-rubric.pdf")

    personal = await client.post(
        "/api/v1/service-requests", headers=STUDENT,
        json={"text": "Điểm của em trong rubric DADN là bao nhiêu?"},
    )
    assert personal.status_code == 201, personal.text
    assert personal.json()["status"] == "WAITING_FOR_STAFF"


@pytest.mark.asyncio
async def test_catalog_route_clarification_and_staff_handoff(client):
    catalog = (await client.get("/api/v1/service-requests/catalog", headers=STUDENT)).json()
    assert {item["service_id"] for item in catalog} == {
        "academic_affairs", "faculty_cs", "clinic", "student_affairs", "triage_desk"
    }

    missing = await client.post(
        "/api/v1/service-requests", headers=STUDENT,
        json={"text": "Em muốn biết hồ sơ xin bảng điểm tới đâu rồi?"},
    )
    assert missing.status_code == 201, missing.text
    assert missing.json()["service_id"] == "academic_affairs"
    assert missing.json()["status"] == "NEEDS_INFO"
    assert missing.json()["missing_fields"] == ["record_id"]

    clarified = await client.post(
        f"/api/v1/service-requests/{missing.json()['id']}/clarify", headers=STUDENT,
        json={"text": "Mã yêu cầu của em", "slots": {"record_id": "DEMO-AA-REQ-001"}},
    )
    assert clarified.status_code == 200, clarified.text
    assert clarified.json()["status"] == "COMPLETED"
    assert clarified.json()["result"]["record"]["status"] == "PROCESSING"
    events = await client.get(
        f"/api/v1/service-requests/{missing.json()['id']}/events", headers=STUDENT
    )
    assert events.status_code == 200
    assert [item["event_type"] for item in events.json()] == [
        "SERVICE_REQUEST_RECEIVED", "SERVICE_REQUEST_CLARIFIED"
    ]

    registration = await client.post(
        "/api/v1/service-requests", headers=STUDENT,
        json={"text": "Em muốn đăng ký môn DADN"},
    )
    assert registration.json()["service_id"] == "academic_affairs"
    assert registration.json()["status"] == "WAITING_FOR_STAFF"

    unknown = await client.post(
        "/api/v1/service-requests", headers=STUDENT,
        json={"text": "Em cần xin giấy xác nhận tạm trú"},
    )
    assert unknown.json()["service_id"] == "triage_desk"
    assert unknown.json()["reason_code"] == "LOW_ROUTING_CONFIDENCE"
    assert unknown.json()["status"] == "WAITING_FOR_STAFF"
    handoff = await client.post(
        f"/api/v1/service-requests/{unknown.json()['id']}/handoff",
        headers={"X-Demo-Actor-ID": "academic-affairs-01"},
        json={"destination_name": "Phòng Công tác Sinh viên", "note": "Chuyển nhân viên rà soát"},
    )
    assert handoff.status_code == 200, handoff.text
    assert handoff.json()["status"] == "FORWARDED"
    assert handoff.json()["service_id"] == "triage_desk"
    assert handoff.json()["result"]["destination_name"] == "Phòng Công tác Sinh viên"


@pytest.mark.asyncio
async def test_broad_academic_affairs_intents_are_received_by_staff(client):
    class FixedRouteProvider(FakeProvider):
        def __init__(self, intent, topic=None):
            self.intent = intent
            self.topic = topic

        async def classify_service(self, text, catalog):
            slots = {"topic": self.topic} if self.topic else {}
            return ServiceClassification(
                service_id="academic_affairs", intent=self.intent, slots=slots, confidence=0.99
            )

    try:
        for intent, topic, expected_reason in (
            ("academic_admin_request", "bảo lưu việc học", "MANUAL_REVIEW_REQUIRED"),
            ("academic_data_check", "lịch thi học kỳ hiện hành", "POLICY_SOURCE_UNAVAILABLE"),
        ):
            app.dependency_overrides[get_ai_provider] = lambda intent=intent, topic=topic: FixedRouteProvider(intent, topic)
            response = await client.post(
                "/api/v1/service-requests", headers=STUDENT,
                json={"text": "Tôi cần Phòng Đào tạo hỗ trợ việc học vụ này"},
            )
            assert response.status_code == 201, response.text
            body = response.json()
            assert body["service_id"] == "academic_affairs"
            assert body["intent"] == intent
            assert body["status"] == "WAITING_FOR_STAFF"
            assert body["reason_code"] == expected_reason
            assert body["policy_version"] == "AA-POLICY-v4"

        app.dependency_overrides[get_ai_provider] = lambda: FixedRouteProvider("academic_admin_request")
        missing = await client.post(
            "/api/v1/service-requests", headers=STUDENT,
            json={"text": "Tôi cần Phòng Đào tạo hỗ trợ việc học vụ này"},
        )
        assert missing.json()["status"] == "NEEDS_INFO"
        assert missing.json()["missing_fields"] == ["topic"]
        assert "thủ tục học vụ nào" in missing.json()["result"]["clarifying_question"]
    finally:
        app.dependency_overrides.pop(get_ai_provider, None)

    policy_faq = await client.post(
        "/api/v1/service-requests", headers=STUDENT,
        json={"text": "Thủ tục xin bảng điểm học vụ như thế nào?"},
    )
    assert policy_faq.status_code == 201, policy_faq.text
    assert policy_faq.json()["service_id"] == "academic_affairs"
    assert policy_faq.json()["intent"] == "policy_faq"
    assert policy_faq.json()["status"] == "ANSWERED"
    assert policy_faq.json()["result"]["citations"]
    assert policy_faq.json()["policy_version"] == "AA-POLICY-v4"


@pytest.mark.asyncio
async def test_student_affairs_conduct_score_routes_to_its_own_staff_queue(client):
    lookup = await client.post(
        "/api/v1/service-requests", headers=STUDENT,
        json={"text": "Cho em hỏi kết quả rèn luyện của em trong học kỳ 261"},
    )
    assert lookup.status_code == 201, lookup.text
    body = lookup.json()
    assert body["service_id"] == "student_affairs"
    assert body["organization_id"] == "student_affairs"
    assert body["intent"] == "conduct_score_lookup"
    assert body["status"] == "WAITING_FOR_STAFF"
    assert body["reason_code"] == "MANUAL_REVIEW_REQUIRED"
    assert body["slots"]["semester"] == "261"
    assert "không tra hoặc sửa điểm tự động" in body["result"]["next_step"]

    staff_queue = await client.get(
        "/api/v1/service-requests",
        headers={"X-Demo-Actor-ID": "student-affairs-01"},
    )
    assert staff_queue.status_code == 200
    assert any(item["id"] == body["id"] for item in staff_queue.json())

    reviewed = await client.post(
        f"/api/v1/service-requests/{body['id']}/review",
        headers={"X-Demo-Actor-ID": "student-affairs-01"},
        json={"message": "Đã nhận để kiểm tra theo học kỳ được cung cấp.", "outcome": "wait"},
    )
    assert reviewed.status_code == 200, reviewed.text
    assert reviewed.json()["service_id"] == "student_affairs"
    assert reviewed.json()["status"] == "WAITING_FOR_STAFF"

    missing_semester = await client.post(
        "/api/v1/service-requests", headers=STUDENT,
        json={"text": "Em muốn hỏi điểm rèn luyện hiện tại của em"},
    )
    assert missing_semester.json()["service_id"] == "student_affairs"
    assert missing_semester.json()["status"] == "NEEDS_INFO"
    assert missing_semester.json()["missing_fields"] == ["semester"]
    clarified = await client.post(
        f"/api/v1/service-requests/{missing_semester.json()['id']}/clarify",
        headers=STUDENT,
        json={"text": "Học kỳ 261"},
    )
    assert clarified.status_code == 200, clarified.text
    assert clarified.json()["service_id"] == "student_affairs"
    assert clarified.json()["status"] == "WAITING_FOR_STAFF"


@pytest.mark.asyncio
async def test_clinic_policy_status_and_health_privacy(client):
    hours = await client.post(
        "/api/v1/service-requests", headers=STUDENT,
        json={"text": "Trạm y tế mở cửa giờ nào?"},
    )
    assert hours.json()["service_id"] == "clinic"
    assert hours.json()["status"] == "ANSWERED"
    assert "08:00" in hours.json()["result"]["answer"]
    assert hours.json()["policy_source"].endswith("clinic.md")
    clinic_queue = await client.get(
        "/api/v1/service-requests", headers={"X-Demo-Actor-ID": "clinic-staff-01"}
    )
    assert clinic_queue.status_code == 200
    assert all(item["service_id"] == "clinic" for item in clinic_queue.json())

    foreign_record = await client.post(
        "/api/v1/service-requests", headers=STUDENT,
        json={"text": "Lịch khám tới đâu?", "slots": {"record_id": "DEMO-CLINIC-APT-002"}},
    )
    assert foreign_record.json()["status"] == "WAITING_FOR_STAFF"
    assert foreign_record.json()["reason_code"] == "RECORD_NOT_FOUND"

    sensitive = "Em đau ngực dữ dội, CCCD 012345678901, nên uống thuốc gì?"
    response = await client.post(
        "/api/v1/service-requests", headers=STUDENT, json={"text": sensitive}
    )
    assert response.json()["status"] == "SAFETY_MESSAGE"
    async with TestSession() as session:
        item = await session.get(ServiceRequest, response.json()["id"])
        events = (await session.scalars(
            select(AuditEvent).where(AuditEvent.entity_id == item.id)
        )).all()
        stored = item.text + " ".join(str(event.input_snapshot) for event in events)
        assert "012345678901" not in stored
        assert "đau ngực" not in stored


@pytest.mark.asyncio
async def test_group_member_approval_verify_idempotency_and_full_group(client):
    created = await client.post(
        "/api/v1/service-requests", headers={**STUDENT, "Idempotency-Key": "add-01"},
        json={
            "text": "Em muốn thêm bạn vào nhóm DADN",
            "slots": {"group_id": "dadn-group-a", "member_ref": "demo-student-02"},
        },
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["status"] == "AWAITING_CONFIRMATION"
    repeat = await client.post(
        "/api/v1/service-requests", headers={**STUDENT, "Idempotency-Key": "add-01"},
        json={"text": "Em muốn thêm bạn vào nhóm DADN"},
    )
    assert repeat.json()["id"] == body["id"]

    no_early_write = await client.post(
        f"/api/v1/service-requests/{body['id']}/decision", headers=LECTURER,
        json={"approved": True, "reason": "Đồng ý"},
    )
    assert no_early_write.status_code == 409
    confirmed = await client.post(
        f"/api/v1/service-requests/{body['id']}/confirm", headers=STUDENT
    )
    assert confirmed.json()["status"] == "AWAITING_APPROVAL"
    approved = await client.post(
        f"/api/v1/service-requests/{body['id']}/decision", headers=LECTURER,
        json={"approved": True, "reason": "Đồng ý theo quy định"},
    )
    assert approved.status_code == 200, approved.text
    assert approved.json()["status"] == "COMPLETED"
    assert approved.json()["result"]["verified"] is True
    assert approved.json()["result"]["routing"]["validated_service_id"] == "faculty_cs"
    async with TestSession() as session:
        count = await session.scalar(
            select(func.count()).select_from(GroupMembership).where(
                GroupMembership.group_id == "dadn-group-a",
                GroupMembership.actor_id == "demo-student-02",
            )
        )
        assert count == 1

    full = await client.post(
        "/api/v1/service-requests", headers={"X-Demo-Actor-ID": "demo-student-03"},
        json={
            "text": "Em muốn thêm bạn vào nhóm DADN",
            "slots": {"group_id": "dadn-group-b", "member_ref": "demo-student"},
        },
    )
    assert full.json()["reason_code"] == "GROUP_FULL"
    assert full.json()["status"] == "WAITING_FOR_STAFF"


@pytest.mark.asyncio
async def test_co3001_member_request_is_persisted_in_lecturer_service_inbox(client):
    question = "Nhóm em hiện tại đã có 5 bạn, em muốn xin thêm bạn thứ 6 vào nhóm đồ án."
    created = await client.post(
        "/api/v1/service-requests",
        headers={"X-Demo-Actor-ID": "student-b1"},
        json={
            "text": question,
            "slots": {
                "course_code": "CO3001",
                "group_id": "group-b",
                "member_ref": "demo-student-02",
            },
        },
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["service_id"] == "faculty_cs"
    assert body["status"] == "WAITING_FOR_STAFF"

    lecturer_queue = await client.get("/api/v1/service-requests?limit=100", headers=LECTURER)
    assert lecturer_queue.status_code == 200, lecturer_queue.text
    queued_item = next(item for item in lecturer_queue.json() if item["id"] == body["id"])
    assert queued_item["text"] == question
    assert queued_item["slots"]["group_id"] == "group-b"
    assert queued_item["slots"]["member_ref"] == "demo-student-02"


@pytest.mark.asyncio
async def test_unauthorized_group_write_and_record_access(client):
    created = await client.post(
        "/api/v1/service-requests", headers={"X-Demo-Actor-ID": "demo-student-02"},
        json={
            "text": "Em muốn thêm bạn vào nhóm DADN",
            "slots": {"group_id": "dadn-group-a", "member_ref": "demo-student-03"},
        },
    )
    assert created.json()["reason_code"] == "GROUP_NOT_AUTHORIZED"
    assert created.json()["status"] == "REJECTED"
    forbidden = await client.get(
        f"/api/v1/service-requests/{created.json()['id']}", headers=STUDENT
    )
    assert forbidden.status_code == 403


@pytest.mark.asyncio
async def test_redaction_before_provider_and_provider_failure_fallback(client):
    class SpyProvider(FakeProvider):
        def __init__(self):
            self.seen: list[str] = []

        async def classify_service(self, text, catalog):
            self.seen.append(text)
            return await super().classify_service(text, catalog)

    spy = SpyProvider()
    app.dependency_overrides[get_ai_provider] = lambda: spy
    try:
        response = await client.post(
            "/api/v1/service-requests", headers=STUDENT,
            json={"text": "Em cần bảng điểm, CCCD 012345678901"},
        )
        assert response.status_code == 201
        assert spy.seen and "012345678901" not in spy.seen[0]
        assert "[CCCD ĐÃ ẨN]" in spy.seen[0]
        async with TestSession() as session:
            item = await session.get(ServiceRequest, response.json()["id"])
            assert "012345678901" not in item.text

        class BrokenProvider(FakeProvider):
            async def classify_service(self, text, catalog):
                raise RuntimeError("provider unavailable")

        app.dependency_overrides[get_ai_provider] = lambda: BrokenProvider()
        fallback = await client.post(
            "/api/v1/service-requests", headers=STUDENT,
            json={"text": "Em cần bảng điểm"},
        )
        assert fallback.json()["service_id"] == "triage_desk"
        assert fallback.json()["status"] == "WAITING_FOR_STAFF"
    finally:
        app.dependency_overrides.pop(get_ai_provider, None)


@pytest.mark.asyncio
async def test_existing_question_intake_redacts_before_storage_and_audit(client):
    response = await client.post(
        "/api/v1/questions", headers=STUDENT,
        json={
            "course_id": "DADN-HK242",
            "group_id": "dadn-group-a",
            "text": "Nhóm DADN có mấy người? CCCD 012345678901",
        },
    )
    assert response.status_code == 201, response.text
    async with TestSession() as session:
        item = await session.get(Question, response.json()["question_id"])
        events = (await session.scalars(
            select(AuditEvent).where(AuditEvent.entity_id == item.id)
        )).all()
        assert "012345678901" not in item.text
        assert all("012345678901" not in str(event.input_snapshot) for event in events)
