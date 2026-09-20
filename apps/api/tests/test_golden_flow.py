from datetime import date, timedelta

import pytest


async def ask(client, actor_id: str, text: str):
    return await client.post(
        "/api/v1/questions",
        json={"actor_id": actor_id, "course_id": "CO3001", "text": text},
    )


@pytest.mark.asyncio
async def test_answer_clarify_and_escalate_routes(client):
    answer = await ask(client, "student-a1", "Một nhóm đồ án có bao nhiêu thành viên?")
    assert answer.status_code == 201, answer.text
    assert answer.json()["route"] == "ANSWER"
    assert answer.json()["citations"][0]["chunk_id"] == "chunk-group-policy-v1-0"

    clarify = await ask(client, "student-a1", "Em đang thiếu thông tin, nhóm nào vậy?")
    assert clarify.status_code == 201, clarify.text
    assert clarify.json()["route"] == "CLARIFY"
    assert clarify.json()["clarifying_question"]

    escalate = await ask(client, "student-a1", "Nhóm em xin phép có 6 thành viên được không?")
    assert escalate.status_code == 201, escalate.text
    assert escalate.json()["route"] == "ESCALATE"
    assert escalate.json()["case_id"]


@pytest.mark.asyncio
async def test_scoped_exception_isolated_then_revoked(client):
    escalation = await ask(client, "student-a1", "Nhóm em xin phép có 6 thành viên được không?")
    case_id = escalation.json()["case_id"]

    today = date.today()
    payload = {
        "reviewer_id": "lecturer-01",
        "decision": "APPROVED",
        "reason": "Đã xác nhận nhu cầu của nhóm trong kỳ này.",
        "create_exception": True,
        "exception": {
            "scope_type": "GROUP",
            "scope_id": "group-a",
            "course_id": "CO3001",
            "content": "Nhóm được phép có tối đa 6 thành viên.",
            "valid_from": (today - timedelta(days=1)).isoformat(),
            "valid_until": (today + timedelta(days=30)).isoformat(),
        },
    }
    decision = await client.post(
        f"/api/v1/cases/{case_id}/decision",
        json=payload,
        headers={"Idempotency-Key": "approve-group-a-once"},
    )
    assert decision.status_code == 200, decision.text
    exception_id = decision.json()["exception_id"]
    assert exception_id

    student_result = await client.get(
        f"/api/v1/questions/{escalation.json()['question_id']}"
    )
    assert student_result.status_code == 200
    assert student_result.json()["final_decision"] == "APPROVED"
    assert student_result.json()["exception_id"] == exception_id

    repeated = await client.post(
        f"/api/v1/cases/{case_id}/decision",
        json=payload,
        headers={"Idempotency-Key": "approve-group-a-once"},
    )
    assert repeated.status_code == 200
    assert repeated.json()["exception_id"] == exception_id

    group_a = await ask(client, "student-a1", "Nhóm em có được có 6 thành viên không?")
    assert group_a.status_code == 201
    assert group_a.json()["route"] == "ANSWER"
    assert "ngoại lệ" in group_a.json()["answer"].casefold()

    group_b = await ask(client, "student-b1", "Nhóm em có được có 6 thành viên không?")
    assert group_b.status_code == 201
    assert group_b.json()["route"] == "ESCALATE"

    revoked = await client.post(
        f"/api/v1/exceptions/{exception_id}/revoke",
        json={"actor_id": "lecturer-01", "reason": "Điều kiện ngoại lệ không còn tồn tại."},
    )
    assert revoked.status_code == 200, revoked.text
    assert revoked.json()["status"] == "REVOKED"

    group_a_after_revoke = await ask(
        client, "student-a1", "Nhóm em có được có 6 thành viên không?"
    )
    assert group_a_after_revoke.status_code == 201
    assert group_a_after_revoke.json()["route"] == "ESCALATE"

    audit = await client.get("/api/v1/audit")
    assert audit.status_code == 200
    event_types = {event["event_type"] for event in audit.json()}
    assert "EXCEPTION_CREATED" in event_types
    assert "EXCEPTION_REVOKED" in event_types


@pytest.mark.asyncio
async def test_cancelled_case_cannot_be_decided(client):
    escalation = await ask(client, "student-a1", "Nhóm em xin phép có 6 thành viên được không?")
    case_id = escalation.json()["case_id"]
    cancelled = await client.post(
        f"/api/v1/cases/{case_id}/cancel",
        json={"actor_id": "lecturer-01", "reason": "Yêu cầu đã được rút lại."},
    )
    assert cancelled.status_code == 200
    assert cancelled.json()["status"] == "CANCELLED"

    decision = await client.post(
        f"/api/v1/cases/{case_id}/decision",
        json={
            "reviewer_id": "lecturer-01",
            "decision": "REJECTED",
            "reason": "Không còn yêu cầu để xem xét.",
            "create_exception": False,
        },
    )
    assert decision.status_code == 409
    assert decision.json()["error"]["code"] == "CASE_CANCELLED"
