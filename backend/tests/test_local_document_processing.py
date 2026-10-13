import pytest


@pytest.mark.asyncio
async def test_direct_text_processing_can_be_confirmed_exported_and_indexed(client):
    created = await client.post(
        "/api/v1/documents/processing/text",
        json={
            "course_id": "CO3001",
            "title": "Quy định nộp bài Local",
            "version": "2026.1",
            "text_content": "Sinh viên nộp báo cáo trước ngày 20 tháng 12.",
        },
    )
    assert created.status_code == 201, created.text
    processing = created.json()
    assert processing["extraction_method"] == "DIRECT_TEXT"
    assert processing["pending_review_count"] == 0

    finalized = await client.post(
        f"/api/v1/documents/processing/{processing['id']}/finalize"
    )
    assert finalized.status_code == 200, finalized.text
    assert finalized.json()["status"] == "COMPLETED"
    assert finalized.json()["document"]["status"] == "ACTIVE"

    exported = await client.get(
        f"/api/v1/documents/processing/{processing['id']}/export/json"
    )
    assert exported.status_code == 200
    assert "Sinh viên nộp báo cáo" in exported.text


@pytest.mark.asyncio
async def test_latest_relevant_policy_update_wins_even_when_title_differs(client):
    payload = {"course_id": "CO3001"}
    first = await client.post(
        "/api/v1/documents/processing/text", json={
            **payload, "title": "Thông báo cũ", "version": "1.0",
            "text_content": "Sinh viên nộp báo cáo đồ án trước ngày 20 tháng 12.",
        }
    )
    assert first.status_code == 201, first.text
    assert (await client.post(
        f"/api/v1/documents/processing/{first.json()['id']}/finalize"
    )).status_code == 200

    second = await client.post(
        "/api/v1/documents/processing/text", json={
            **payload, "title": "Phụ lục tuần tám", "version": "2.0",
            "text_content": "Hạn nộp báo cáo đồ án được cập nhật thành ngày 27 tháng 12.",
        }
    )
    assert second.status_code == 201, second.text
    assert (await client.post(
        f"/api/v1/documents/processing/{second.json()['id']}/finalize"
    )).status_code == 200

    old_document = await client.get(f"/api/v1/documents/{first.json()['document']['id']}")
    new_document = await client.get(f"/api/v1/documents/{second.json()['document']['id']}")
    assert old_document.json()["status"] == "ACTIVE"
    assert new_document.json()["status"] == "ACTIVE"

    answer = await client.post(
        "/api/v1/questions",
        json={
            "actor_id": "student-a1",
            "course_id": "CO3001",
            "text": "Hạn nộp báo cáo đồ án là ngày nào?",
        },
    )
    assert answer.status_code == 201, answer.text
    assert answer.json()["citations"][0]["document_id"] == second.json()["document"]["id"]
    assert "cập nhật quy định" in answer.json()["answer"].casefold()


@pytest.mark.asyncio
async def test_supplement_does_not_hide_unrelated_older_rule(client):
    old = await client.post(
        "/api/v1/documents/processing/text",
        json={
            "course_id": "CO3001", "title": "Quy định nhóm", "version": "1.0",
            "text_content": "Mỗi nhóm đồ án có từ 3 đến 5 thành viên.",
        },
    )
    assert old.status_code == 201, old.text
    assert (await client.post(
        f"/api/v1/documents/processing/{old.json()['id']}/finalize"
    )).status_code == 200
    supplement = await client.post(
        "/api/v1/documents/processing/text",
        json={
            "course_id": "CO3001", "title": "Phụ lục tuần 8", "version": "1.0",
            "text_content": "Báo cáo tiến độ phải nộp vào thứ Sáu hàng tuần.",
        },
    )
    assert supplement.status_code == 201, supplement.text
    assert (await client.post(
        f"/api/v1/documents/processing/{supplement.json()['id']}/finalize"
    )).status_code == 200

    answer = await client.post(
        "/api/v1/questions",
        json={"actor_id": "student-a1", "course_id": "CO3001", "text": "Nhóm đồ án có bao nhiêu thành viên?"},
    )
    assert answer.status_code == 201, answer.text
    assert answer.json()["citations"][0]["document_id"] == old.json()["document"]["id"]


@pytest.mark.asyncio
async def test_waiver_request_escalates_even_when_policy_update_exists(client):
    created = await client.post(
        "/api/v1/documents/processing/text",
        json={
            "course_id": "CO3001",
            "title": "Quy định nhóm mới",
            "version": "2.0",
            "text_content": "Mỗi nhóm đồ án có từ 3 đến 5 thành viên.",
        },
    )
    assert created.status_code == 201
    assert (await client.post(f"/api/v1/documents/processing/{created.json()['id']}/finalize")).status_code == 200

    resp = await client.post(
        "/api/v1/questions",
        json={
            "actor_id": "student-a1",
            "course_id": "CO3001",
            "group_id": "group-a",
            "text": "Nhóm em xin phép có 6 thành viên được không?",
        },
    )
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["route"] == "ESCALATE"
    assert data["status"] == "ESCALATED"
    assert data["policy_topic"] == "GROUP_MEMBERSHIP"


@pytest.mark.asyncio
async def test_foreign_language_update_does_not_hijack_rubric_query(client):
    fl_doc = await client.post(
        "/api/v1/documents/processing/text",
        json={
            "course_id": "CO3001",
            "title": "Chuẩn ngoại ngữ tốt nghiệp",
            "version": "1.0",
            "text_content": "Chuẩn ngoại ngữ tốt nghiệp tiếng Anh TOEIC 600 hoặc TOEFL iBT 64, tiếng Pháp DELF B1.",
        },
    )
    assert fl_doc.status_code == 201
    assert (await client.post(f"/api/v1/documents/processing/{fl_doc.json()['id']}/finalize")).status_code == 200

    resp = await client.post(
        "/api/v1/questions",
        json={
            "actor_id": "student-a1",
            "course_id": "CO3001",
            "group_id": "group-a",
            "text": "Rubric chấm điểm báo cáo và sản phẩm như thế nào?",
        },
    )
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["route"] == "ANSWER"
    # Citations must not be from foreign language document
    if data["citations"]:
        assert data["citations"][0]["document_id"] != fl_doc.json()["document"]["id"]


@pytest.mark.asyncio
async def test_discard_processing_in_various_states_and_completed_rejection(client):
    # 1. Discard in READY_TO_CONFIRM
    created = await client.post(
        "/api/v1/documents/processing/text",
        json={
            "course_id": "CO3001",
            "title": "Bản nháp cần bỏ",
            "version": "0.1",
            "text_content": "Nội dung bản nháp tạm thời.",
        },
    )
    assert created.status_code == 201
    proc_id = created.json()["id"]
    doc_id = created.json()["document"]["id"]

    discarded = await client.post(f"/api/v1/documents/processing/{proc_id}/discard")
    assert discarded.status_code == 200
    assert discarded.json()["status"] == "DISCARDED"

    # Verify document and review items can no longer be updated/finalized
    doc_resp = await client.get(f"/api/v1/documents/{doc_id}")
    assert doc_resp.json()["status"] == "DISCARDED"

    finalize_attempt = await client.post(f"/api/v1/documents/processing/{proc_id}/finalize")
    assert finalize_attempt.status_code == 409

    # Verify discarded documents are omitted from default listing
    docs_list = await client.get("/api/v1/documents?course_id=CO3001")
    assert docs_list.status_code == 200
    listed_ids = [d["id"] for d in docs_list.json()]
    assert doc_id not in listed_ids

    # 2. Discard in COMPLETED rejected with 409
    completed_doc = await client.post(
        "/api/v1/documents/processing/text",
        json={
            "course_id": "CO3001",
            "title": "Quy định chính thức",
            "version": "1.0",
            "text_content": "Quy định chính thức có hiệu lực.",
        },
    )
    assert completed_doc.status_code == 201
    comp_id = completed_doc.json()["id"]
    assert (await client.post(f"/api/v1/documents/processing/{comp_id}/finalize")).status_code == 200

    discard_comp = await client.post(f"/api/v1/documents/processing/{comp_id}/discard")
    assert discard_comp.status_code == 409
    assert discard_comp.json()["error"]["code"] == "PROCESSING_ALREADY_PUBLISHED"


@pytest.mark.asyncio
async def test_conflict_detection_and_resolution_replace_and_keep_old(client):
    # 1. Upload first rubric (V1)
    v1 = await client.post(
        "/api/v1/documents/processing/text",
        json={
            "course_id": "CO3001",
            "title": "Rubric V1",
            "version": "1.0",
            "text_content": "Rubric chấm điểm học phần: Đồ án chiếm 40% điểm tổng kết, thi cuối kỳ chiếm 60%.",
        },
    )
    assert v1.status_code == 201
    assert (await client.post(f"/api/v1/documents/processing/{v1.json()['id']}/finalize")).status_code == 200

    # 2. Upload second rubric (V2) with conflicting topic GRADING_RUBRIC
    v2 = await client.post(
        "/api/v1/documents/processing/text",
        json={
            "course_id": "CO3001",
            "title": "Rubric V2",
            "version": "2.0",
            "text_content": "Rubric chấm điểm học phần mới: Đồ án chiếm 50% điểm tổng kết, thi cuối kỳ chiếm 50%.",
        },
    )
    assert v2.status_code == 201
    v2_id = v2.json()["id"]

    # 3. Detect conflicts
    conflicts_resp = await client.get(f"/api/v1/documents/processing/{v2_id}/conflicts")
    assert conflicts_resp.status_code == 200
    conflicts = conflicts_resp.json()
    assert len(conflicts) >= 1
    assert conflicts[0]["new_chunk_index"] == 0
    assert conflicts[0]["policy_topic"] == "GRADING_RUBRIC"
    assert len(conflicts[0]["existing"]) >= 1
    assert conflicts[0]["existing"][0]["source_document_title"] == "Rubric V1"

    # 4. Finalize without resolution -> 422 CONFLICT_RESOLUTION_REQUIRED
    fin_missing = await client.post(f"/api/v1/documents/processing/{v2_id}/finalize")
    assert fin_missing.status_code == 422
    assert fin_missing.json()["error"]["code"] == "CONFLICT_RESOLUTION_REQUIRED"

    # 5. Finalize with REPLACE
    fin_replace = await client.post(
        f"/api/v1/documents/processing/{v2_id}/finalize",
        json={"resolutions": [{"new_chunk_index": 0, "action": "REPLACE"}]},
    )
    assert fin_replace.status_code == 200
    summary = fin_replace.json()["finalize_summary"]
    assert summary["replaced_count"] == 1

    # 6. Ask question: answer must reflect V2 (50% / 50%)
    ans = await client.post(
        "/api/v1/questions",
        json={
            "actor_id": "student-a1",
            "course_id": "CO3001",
            "group_id": "group-a",
            "text": "Rubric chấm điểm thế nào?",
        },
    )
    assert ans.status_code == 201
    ans_data = ans.json()
    assert ans_data["route"] == "ANSWER"
    assert "50%" in ans_data["answer"]
    assert ans_data["citations"][0]["document_id"] == v2.json()["document"]["id"]

    # 7. Upload third rubric (V3) and resolve with KEEP_OLD
    v3 = await client.post(
        "/api/v1/documents/processing/text",
        json={
            "course_id": "CO3001",
            "title": "Rubric V3",
            "version": "3.0",
            "text_content": "Rubric chấm điểm đồ án bổ sung: Đồ án chiếm 70% điểm tổng kết.",
        },
    )
    assert v3.status_code == 201
    v3_id = v3.json()["id"]

    fin_keep_old = await client.post(
        f"/api/v1/documents/processing/{v3_id}/finalize",
        json={"resolutions": [{"new_chunk_index": 0, "action": "KEEP_OLD"}]},
    )
    assert fin_keep_old.status_code == 200
    assert fin_keep_old.json()["finalize_summary"]["skipped_count"] == 1


