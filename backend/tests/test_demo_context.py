from datetime import date, datetime, timedelta

import pytest


@pytest.mark.asyncio
async def test_demo_catalog_lists_courses_groups_and_single_lecturer(client):
    response = await client.get("/api/v1/demo/catalog")

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["lecturer"] == {
        "id": "lecturer-01",
        "display_name": "TS. Trần Minh Tuấn",
    }
    courses = {item["id"]: item for item in body["courses"]}
    assert set(courses) == {"CO3001", "DADN-HK242"}
    assert {group["id"] for group in courses["CO3001"]["groups"]} == {
        "group-a",
        "group-b",
    }
    assert {group["id"] for group in courses["DADN-HK242"]["groups"]} == {
        "dadn-group-a",
        "dadn-group-b",
    }


@pytest.mark.asyncio
async def test_question_uses_explicit_demo_group_without_login(client):
    response = await client.post(
        "/api/v1/questions",
        json={
            "course_id": "CO3001",
            "group_id": "group-b",
            "text": "Một nhóm đồ án có bao nhiêu thành viên?",
        },
    )

    assert response.status_code == 201, response.text
    body = response.json()
    assert body["actor_id"] == "demo-student"
    assert body["course_id"] == "CO3001"
    assert body["group_id"] == "group-b"
    assert body["route"] == "ANSWER"


@pytest.mark.asyncio
async def test_question_rejects_group_from_another_course(client):
    response = await client.post(
        "/api/v1/questions",
        json={
            "course_id": "CO3001",
            "group_id": "dadn-group-a",
            "text": "Một nhóm đồ án có bao nhiêu thành viên?",
        },
    )

    assert response.status_code == 422, response.text
    assert response.json()["error"]["code"] == "GROUP_COURSE_MISMATCH"


@pytest.mark.asyncio
async def test_clarify_only_when_missing_group_is_relevant(client):
    missing_group = await client.post(
        "/api/v1/questions",
        json={
            "course_id": "CO3001",
            "text": "Team tụi em sáu người có ổn không?",
        },
    )
    assert missing_group.json()["route"] == "CLARIFY"
    assert missing_group.json()["reason_code"] == "MISSING_GROUP_CONTEXT"

    outside_rubric = await client.post(
        "/api/v1/questions",
        json={"course_id": "CO3001", "text": "Ký túc xá đóng cửa lúc mấy giờ?"},
    )
    assert outside_rubric.json()["route"] == "ESCALATE"
    assert outside_rubric.json()["escalation_target"] == "COURSE_LECTURER"


@pytest.mark.asyncio
async def test_clarification_preserves_selected_group(client):
    original = await client.post(
        "/api/v1/questions",
        json={
            "course_id": "CO3001",
            "group_id": "group-a",
            "text": "Trường hợp này có được không?",
        },
    )
    assert original.status_code == 201, original.text
    assert original.json()["route"] == "CLARIFY"

    clarification = await client.post(
        f"/api/v1/questions/{original.json()['question_id']}/clarifications",
        json={"text": "Em đang hỏi về số lượng thành viên của nhóm."},
    )

    assert clarification.status_code == 201, clarification.text
    assert clarification.json()["group_id"] == "group-a"
    assert clarification.json()["parent_question_id"] == original.json()["question_id"]
    assert clarification.json()["clarification_round"] == 1

    parent = await client.get(f"/api/v1/questions/{original.json()['question_id']}")
    assert parent.json()["status"] == "CLARIFICATION_RECEIVED"

    duplicate = await client.post(
        f"/api/v1/questions/{original.json()['question_id']}/clarifications",
        json={"text": "Gửi lặp câu bổ sung."},
    )
    assert duplicate.status_code == 409


@pytest.mark.asyncio
async def test_only_assigned_demo_lecturer_can_decide_course_case(client):
    question = await client.post(
        "/api/v1/questions",
        json={
            "course_id": "CO3001",
            "group_id": "group-a",
            "text": "Nhóm em xin phép có 6 thành viên được không?",
        },
    )
    assert question.status_code == 201, question.text

    response = await client.post(
        f"/api/v1/cases/{question.json()['case_id']}/decision",
        json={
            "reviewer_id": "academic-affairs-01",
            "decision": "REJECTED",
            "reason": "Không phải người được phân công xử lý hồ sơ.",
            "create_exception": False,
        },
    )

    assert response.status_code == 403, response.text
    assert response.json()["error"]["code"] == "REVIEWER_NOT_AUTHORIZED"


@pytest.mark.asyncio
async def test_group_exception_follows_selected_group_not_demo_actor(client):
    escalation = await client.post(
        "/api/v1/questions",
        json={
            "course_id": "CO3001",
            "group_id": "group-a",
            "text": "Nhóm em xin phép có 6 thành viên được không?",
        },
    )
    assert escalation.status_code == 201, escalation.text

    today = date.today()
    decision = await client.post(
        f"/api/v1/cases/{escalation.json()['case_id']}/decision",
        json={
            "reviewer_id": "lecturer-01",
            "decision": "APPROVED",
            "reason": "Phê duyệt ngoại lệ riêng cho Nhóm A.",
            "exception": {
                "scope_type": "GROUP",
                "scope_id": "group-a",
                "course_id": "CO3001",
                "content": "Nhóm được phép có tối đa 6 thành viên.",
                "valid_from": today.isoformat(),
                "valid_until": (today + timedelta(days=30)).isoformat(),
            },
        },
    )
    assert decision.status_code == 200, decision.text
    assert decision.json()["exception_id"]

    async def ask_group(group_id: str):
        return await client.post(
            "/api/v1/questions",
            json={
                "course_id": "CO3001",
                "group_id": group_id,
                "text": "Nhóm em có được có 6 thành viên không?",
            },
        )

    group_a = await ask_group("group-a")
    group_b = await ask_group("group-b")
    paraphrased = await client.post(
        "/api/v1/questions",
        json={
            "course_id": "CO3001",
            "group_id": "group-a",
            "text": "Team tụi em sáu người có ổn không?",
        },
    )

    assert group_a.json()["route"] == "ANSWER"
    assert "ngoại lệ" in group_a.json()["answer"].casefold()
    assert group_a.json()["applied_exception_id"] == decision.json()["exception_id"]
    assert paraphrased.json()["route"] == "ANSWER"
    assert paraphrased.json()["applied_exception_id"] == decision.json()["exception_id"]
    assert group_b.json()["route"] == "ESCALATE"

    # Even with an active exception, an ambiguous/vague question must require CLARIFY and not auto-apply the exception
    vague = await client.post(
        "/api/v1/questions",
        json={
            "course_id": "CO3001",
            "group_id": "group-a",
            "text": "Trường hợp này có được không?",
        },
    )
    assert vague.json()["route"] == "CLARIFY"
    assert vague.json()["applied_exception_id"] is None

    audit = await client.get(
        f"/api/v1/audit/question/{paraphrased.json()['question_id']}"
    )
    applied = next(event for event in audit.json() if event["event_type"] == "EXCEPTION_APPLIED")
    assert applied["output_snapshot"]["applied_exception_id"] == decision.json()["exception_id"]


@pytest.mark.asyncio
async def test_unresolved_clarification_escalates_after_two_rounds(client):
    first = await client.post(
        "/api/v1/questions",
        json={
            "course_id": "CO3001",
            "group_id": "group-a",
            "text": "Trường hợp này có được không?",
        },
    )
    assert first.json()["route"] == "CLARIFY"

    second = await client.post(
        f"/api/v1/questions/{first.json()['question_id']}/clarifications",
        json={"text": "Em đang hỏi về trường hợp này."},
    )
    assert second.json()["route"] == "CLARIFY"

    final = await client.post(
        f"/api/v1/questions/{second.json()['question_id']}/clarifications",
        json={"text": "Em vẫn hỏi trường hợp này."},
    )
    assert final.json()["route"] == "ESCALATE"
    assert final.json()["reason_code"] == "CLARIFICATION_LIMIT_REACHED"
    assert final.json()["escalation_target"] == "COURSE_LECTURER"


@pytest.mark.asyncio
async def test_case_persists_48_hour_sla_deadline(client):
    question = await client.post(
        "/api/v1/questions",
        json={
            "course_id": "CO3001",
            "group_id": "group-a",
            "text": "Nhóm em xin phép có 6 thành viên được không?",
        },
    )
    detail = await client.get(f"/api/v1/cases/{question.json()['case_id']}")
    body = detail.json()
    created_at = datetime.fromisoformat(body["created_at"])
    due_at = datetime.fromisoformat(body["sla_due_at"])

    assert body["sla_due_at"]
    assert created_at.utcoffset() == timedelta(0)
    assert due_at.utcoffset() == timedelta(0)
    assert timedelta(hours=47, minutes=59) < due_at - created_at < timedelta(hours=48, minutes=1)
    assert body["sla_overdue"] is False


@pytest.mark.asyncio
async def test_demo_reset_keeps_audit_events_and_appends_reset_event(client):
    question = await client.post(
        "/api/v1/questions",
        json={
            "course_id": "CO3001",
            "group_id": "group-a",
            "text": "Một nhóm đồ án có bao nhiêu thành viên?",
        },
    )
    question_id = question.json()["question_id"]

    reset = await client.post("/api/v1/demo/reset")
    assert reset.status_code == 200
    assert reset.json()["audit_preserved"] is True

    question_audit = await client.get(f"/api/v1/audit/question/{question_id}")
    assert "QUESTION_SUBMITTED" in {event["event_type"] for event in question_audit.json()}
    all_audit = await client.get("/api/v1/audit")
    assert "DEMO_RESET" in {event["event_type"] for event in all_audit.json()}
