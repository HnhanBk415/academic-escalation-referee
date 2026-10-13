import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_dashboard_counts_for_student_and_lecturer(client: AsyncClient):
    # 1. Initially, student-a1 and student-b1 have 0 pending questions
    res_a = await client.get("/api/v1/questions/counts", headers={"X-Demo-Actor-ID": "student-a1"})
    assert res_a.status_code == 200
    assert res_a.json() == {"pending_questions": 0, "under_review_cases": 0}

    res_b = await client.get("/api/v1/questions/counts", headers={"X-Demo-Actor-ID": "student-b1"})
    assert res_b.status_code == 200
    assert res_b.json() == {"pending_questions": 0, "under_review_cases": 0}

    # Lecturer has 0 under_review_cases initially
    res_lec = await client.get("/api/v1/questions/counts", headers={"X-Demo-Actor-ID": "lecturer-01"})
    assert res_lec.status_code == 200
    assert res_lec.json() == {"pending_questions": 0, "under_review_cases": 0}

    # 2. Student A submits an escalation question (creates EscalationCase)
    ask_escalate = await client.post(
        "/api/v1/questions",
        headers={"X-Demo-Actor-ID": "student-a1"},
        json={
            "actor_id": "student-a1",
            "course_id": "CO3001",
            "group_id": "group-a",
            "text": "Nhóm em xin phép có 6 thành viên được không?",
        },
    )
    assert ask_escalate.status_code == 201
    assert ask_escalate.json()["route"] == "ESCALATE"
    case_id = ask_escalate.json()["case_id"]
    assert case_id is not None

    # Student A now has pending_questions = 1, under_review_cases = 0
    res_a = await client.get("/api/v1/questions/counts", headers={"X-Demo-Actor-ID": "student-a1"})
    assert res_a.json() == {"pending_questions": 1, "under_review_cases": 0}

    # Student B still has 0
    res_b = await client.get("/api/v1/questions/counts", headers={"X-Demo-Actor-ID": "student-b1"})
    assert res_b.json() == {"pending_questions": 0, "under_review_cases": 0}

    # Lecturer now has under_review_cases = 1, pending_questions = 0
    res_lec = await client.get("/api/v1/questions/counts", headers={"X-Demo-Actor-ID": "lecturer-01"})
    assert res_lec.json() == {"pending_questions": 0, "under_review_cases": 1}

    # 3. Student A also submits a CLARIFY question
    ask_clarify = await client.post(
        "/api/v1/questions",
        headers={"X-Demo-Actor-ID": "student-a1"},
        json={
            "actor_id": "student-a1",
            "course_id": "CO3001",
            "text": "Em đang thiếu thông tin, nhóm nào vậy?",
        },
    )
    assert ask_clarify.status_code == 201
    assert ask_clarify.json()["route"] == "CLARIFY"

    # Student A now has pending_questions = 2 (1 escalation case + 1 clarify question)
    res_a = await client.get("/api/v1/questions/counts", headers={"X-Demo-Actor-ID": "student-a1"})
    assert res_a.json() == {"pending_questions": 2, "under_review_cases": 0}

    # Lecturer under_review_cases is still 1
    res_lec = await client.get("/api/v1/questions/counts", headers={"X-Demo-Actor-ID": "lecturer-01"})
    assert res_lec.json() == {"pending_questions": 0, "under_review_cases": 1}

    # 4. Lecturer decides the case
    decide_res = await client.post(
        f"/api/v1/cases/{case_id}/decision",
        headers={"X-Demo-Actor-ID": "lecturer-01"},
        json={
            "reviewer_id": "lecturer-01",
            "decision": "APPROVED",
            "reason": "Chấp thuận ngoại lệ nhóm 6 người.",
            "create_exception": False,
        },
    )
    assert decide_res.status_code == 200

    # Now case is DECIDED: lecturer has under_review_cases = 0
    res_lec = await client.get("/api/v1/questions/counts", headers={"X-Demo-Actor-ID": "lecturer-01"})
    assert res_lec.json() == {"pending_questions": 0, "under_review_cases": 0}

    # Student A only has the clarify question pending now (1)
    res_a = await client.get("/api/v1/questions/counts", headers={"X-Demo-Actor-ID": "student-a1"})
    assert res_a.json() == {"pending_questions": 1, "under_review_cases": 0}


@pytest.mark.asyncio
async def test_list_cases_returns_expanded_summary_fields(client: AsyncClient):
    # Submit an escalation question
    ask_res = await client.post(
        "/api/v1/questions",
        headers={"X-Demo-Actor-ID": "student-a1"},
        json={
            "actor_id": "student-a1",
            "course_id": "CO3001",
            "group_id": "group-a",
            "text": "Nhóm em xin phép có 6 thành viên được không?",
        },
    )
    assert ask_res.status_code == 201
    q_data = ask_res.json()
    case_id = q_data["case_id"]

    # Check GET /api/v1/cases
    cases_res = await client.get("/api/v1/cases?status=UNDER_REVIEW")
    assert cases_res.status_code == 200
    cases_list = cases_res.json()
    assert len(cases_list) >= 1

    case_item = next(c for c in cases_list if c["id"] == case_id)
    assert case_item["original_question"] == "Nhóm em xin phép có 6 thành viên được không?"
    assert case_item["actor_id"] == "student-a1"
    assert case_item["course_id"] == "CO3001"
    assert case_item["group_id"] == "group-a"
    assert case_item["group_name"] is not None
    assert case_item["policy_topic"] is not None


@pytest.mark.asyncio
async def test_verify_harness_isolation_from_cases_and_counts(client: AsyncClient):
    # 1. Check initial counts for lecturer
    res_lec_before = await client.get("/api/v1/questions/counts", headers={"X-Demo-Actor-ID": "lecturer-01"})
    assert res_lec_before.status_code == 200
    under_review_before = res_lec_before.json()["under_review_cases"]

    # 2. Submit an ESCALATE question as verify-harness
    ask_res = await client.post(
        "/api/v1/questions",
        headers={"X-Demo-Actor-ID": "verify-harness"},
        json={
            "actor_id": "verify-harness",
            "course_id": "CO3001",
            "group_id": "group-a",
            "text": "Nhóm em xin phép có 6 thành viên được không?",
        },
    )
    assert ask_res.status_code == 201
    q_data = ask_res.json()
    assert q_data["route"] == "ESCALATE"
    case_id = q_data["case_id"]
    assert case_id is not None

    # 3. Lecturer counts should NOT increase
    res_lec_after = await client.get("/api/v1/questions/counts", headers={"X-Demo-Actor-ID": "lecturer-01"})
    assert res_lec_after.status_code == 200
    assert res_lec_after.json()["under_review_cases"] == under_review_before

    # 4. Default GET /api/v1/cases should NOT contain this case
    cases_default = await client.get("/api/v1/cases?status=UNDER_REVIEW")
    assert cases_default.status_code == 200
    assert not any(c["id"] == case_id for c in cases_default.json())

    # 5. GET /api/v1/cases with include_verify=true SHOULD contain this case
    cases_with_verify = await client.get("/api/v1/cases?status=UNDER_REVIEW&include_verify=true")
    assert cases_with_verify.status_code == 200
    assert any(c["id"] == case_id for c in cases_with_verify.json())

    # 6. Default list_questions (without actor_id) should NOT contain this question
    questions_default = await client.get("/api/v1/questions")
    assert questions_default.status_code == 200
    assert not any(q["question_id"] == q_data["question_id"] for q in questions_default.json())

    # 7. Explicit actor_id=verify-harness list_questions SHOULD contain it
    questions_verify = await client.get("/api/v1/questions?actor_id=verify-harness")
    assert questions_verify.status_code == 200
    assert any(q["question_id"] == q_data["question_id"] for q in questions_verify.json())

