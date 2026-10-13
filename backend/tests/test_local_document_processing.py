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
        f"/api/v1/documents/processing/{processing['id']}/finalize",
        json={"resolutions": [{"new_chunk_index": 0, "action": "REPLACE"}]},
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
        f"/api/v1/documents/processing/{first.json()['id']}/finalize",
        json={"resolutions": [{"new_chunk_index": 0, "action": "REPLACE"}]},
    )).status_code == 200

    second = await client.post(
        "/api/v1/documents/processing/text", json={
            **payload, "title": "Phụ lục tuần tám", "version": "2.0",
            "text_content": "Hạn nộp báo cáo đồ án được cập nhật thành ngày 27 tháng 12.",
        }
    )
    assert second.status_code == 201, second.text
    assert (await client.post(
        f"/api/v1/documents/processing/{second.json()['id']}/finalize",
        json={"resolutions": [{"new_chunk_index": 0, "action": "REPLACE"}]},
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
        f"/api/v1/documents/processing/{old.json()['id']}/finalize",
        json={"resolutions": [{"new_chunk_index": 0, "action": "REPLACE"}]},
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
    assert (await client.post(
        f"/api/v1/documents/processing/{created.json()['id']}/finalize",
        json={"resolutions": [{"new_chunk_index": 0, "action": "REPLACE"}]},
    )).status_code == 200

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
    assert (await client.post(
        f"/api/v1/documents/processing/{v1.json()['id']}/finalize",
        json={"resolutions": [{"new_chunk_index": 0, "action": "REPLACE"}]},
    )).status_code == 200

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


@pytest.mark.asyncio
async def test_base_document_conflict_detection_and_resolution(client):
    # 1. DB has NO PolicyUpdate initially
    # Upload conflicting rubric 25/45/20/10
    rubric_upload = await client.post(
        "/api/v1/documents/processing/text",
        json={
            "course_id": "CO3001",
            "title": "Rubric cập nhật mới",
            "version": "2026.2",
            "text_content": "Rubric chấm điểm đồ án CO3001: báo cáo chiếm 25%, sản phẩm chiếm 45%, trình bày chiếm 20%, hợp tác nhóm chiếm 10%.",
        },
    )
    assert rubric_upload.status_code == 201
    rubric_proc_id = rubric_upload.json()["id"]

    # 2. Check conflicts -> must return 1 conflict with source_kind BASE_DOCUMENT
    conflicts_resp = await client.get(f"/api/v1/documents/processing/{rubric_proc_id}/conflicts")
    assert conflicts_resp.status_code == 200
    conflicts = conflicts_resp.json()
    assert len(conflicts) >= 1
    assert conflicts[0]["policy_topic"] == "GRADING_RUBRIC"
    base_conflict = next(
        (e for e in conflicts[0]["existing"] if e["source_kind"] == "BASE_DOCUMENT"), None
    )
    assert base_conflict is not None
    assert base_conflict["policy_update_id"] is None
    assert base_conflict["chunk_id"] is not None
    assert "Rubric" in base_conflict["source_document_title"]

    # 3. Upload unrelated content -> no conflict
    unrelated = await client.post(
        "/api/v1/documents/processing/text",
        json={
            "course_id": "CO3001",
            "title": "Lịch bảo vệ",
            "version": "1.0",
            "text_content": "Lịch bảo vệ đồ án vào tuần 15 tại hội trường A.",
        },
    )
    assert unrelated.status_code == 201
    unrelated_id = unrelated.json()["id"]
    unrelated_conflicts = (await client.get(f"/api/v1/documents/processing/{unrelated_id}/conflicts")).json()
    assert len(unrelated_conflicts) == 0

    # 4. Finalize with REPLACE -> asks question returns 25% / 45%
    fin_replace = await client.post(
        f"/api/v1/documents/processing/{rubric_proc_id}/finalize",
        json={"resolutions": [{"new_chunk_index": 0, "action": "REPLACE"}]},
    )
    assert fin_replace.status_code == 200
    assert fin_replace.json()["finalize_summary"]["replaced_count"] == 1

    ans = await client.post(
        "/api/v1/questions",
        json={
            "actor_id": "student-a1",
            "course_id": "CO3001",
            "group_id": "group-a",
            "text": "Rubric chấm điểm báo cáo và sản phẩm như thế nào?",
        },
    )
    assert ans.status_code == 201
    ans_data = ans.json()
    assert "25%" in ans_data["answer"] or "45%" in ans_data["answer"]

    # 5. Now upload another rubric and resolve with KEEP_OLD -> still answers with previous policy
    rubric_keep_old = await client.post(
        "/api/v1/documents/processing/text",
        json={
            "course_id": "CO3001",
            "title": "Rubric thử nghiệm",
            "version": "2026.3",
            "text_content": "Rubric chấm điểm đồ án CO3001: báo cáo chiếm 10%, sản phẩm chiếm 70%, trình bày chiếm 10%, hợp tác nhóm chiếm 10%.",
        },
    )
    assert rubric_keep_old.status_code == 201
    proc_keep_old_id = rubric_keep_old.json()["id"]
    fin_keep = await client.post(
        f"/api/v1/documents/processing/{proc_keep_old_id}/finalize",
        json={"resolutions": [{"new_chunk_index": 0, "action": "KEEP_OLD"}]},
    )
    assert fin_keep.status_code == 200
    assert fin_keep.json()["finalize_summary"]["skipped_count"] == 1

    ans_after = await client.post(
        "/api/v1/questions",
        json={
            "actor_id": "student-a1",
            "course_id": "CO3001",
            "group_id": "group-a",
            "text": "Rubric chấm điểm báo cáo và sản phẩm như thế nào?",
        },
    )
    assert ans_after.status_code == 201
    # 70% should NOT be in the answer because it was KEEP_OLD
    assert "70%" not in ans_after.json()["answer"]


@pytest.mark.asyncio
async def test_two_uploads_same_title_do_not_cause_conflict_and_rubric_does_not_hijack_group_membership(
    client,
):
    # 1. Upload tài liệu 1 cùng title "Quy định học phần"
    up1 = await client.post(
        "/api/v1/documents/processing/text",
        json={
            "course_id": "CO3001",
            "title": "Quy định học phần",
            "version": "1.1",
            "text_content": "Cập nhật nộp báo cáo đồ án: nộp qua hệ thống trực tuyến LMS.",
        },
    )
    assert up1.status_code == 201
    fin1 = await client.post(
        f"/api/v1/documents/processing/{up1.json()['id']}/finalize",
        json={"resolutions": []},
    )
    assert fin1.status_code == 200

    # 2. Upload tài liệu 2 cùng title "Quy định học phần" chứa PolicyUpdate rubric 25/45
    up2 = await client.post(
        "/api/v1/documents/processing/text",
        json={
            "course_id": "CO3001",
            "title": "Quy định học phần",
            "version": "1.2",
            "text_content": "Rubric cham diem do an CO3001: bao cao chiem 25%, san pham chiem 45%, trinh bay chiem 20%, hop tac nhom chiem 10%.",
        },
    )
    assert up2.status_code == 201
    fin2 = await client.post(
        f"/api/v1/documents/processing/{up2.json()['id']}/finalize",
        json={"resolutions": [{"new_chunk_index": 0, "action": "REPLACE"}]},
    )
    assert fin2.status_code == 200

    # 3. Hỏi "Quy định số lượng sinh viên trong nhóm là gì?"
    # -> Vẫn ANSWER (KHÔNG bị ESCALATE với CONFLICTING_ACTIVE_DOCUMENTS)
    # -> Trả "3 đến 5" (KHÔNG trả nội dung rubric 25/45)
    q_group = await client.post(
        "/api/v1/questions",
        json={
            "actor_id": "student-a1",
            "course_id": "CO3001",
            "group_id": "group-a",
            "text": "Quy định số lượng sinh viên trong nhóm là gì?",
        },
    )
    assert q_group.status_code == 201
    res_group = q_group.json()
    assert res_group["route"] == "ANSWER"
    assert res_group["reason_code"] != "CONFLICTING_ACTIVE_DOCUMENTS"
    assert res_group["reason_code"] != "ACTIVE_POLICY_UPDATE"
    assert "3 đến 5" in res_group["answer"]
    assert "25%" not in res_group["answer"]

    # 4. Hỏi về số thành viên nhóm dạng khác
    q_members = await client.post(
        "/api/v1/questions",
        json={
            "actor_id": "student-a1",
            "course_id": "CO3001",
            "group_id": "group-a",
            "text": "Một nhóm đồ án được có bao nhiêu thành viên?",
        },
    )
    assert q_members.status_code == 201
    res_members = q_members.json()
    assert res_members["route"] == "ANSWER"
    assert "3 đến 5" in res_members["answer"]
    assert "25%" not in res_members["answer"]

    # 5. Hỏi "Rubric chấm điểm báo cáo và sản phẩm như thế nào?"
    # -> Trả theo bản cập nhật 25%/45%
    q_rubric = await client.post(
        "/api/v1/questions",
        json={
            "actor_id": "student-a1",
            "course_id": "CO3001",
            "group_id": "group-a",
            "text": "Rubric chấm điểm báo cáo và sản phẩm như thế nào?",
        },
    )
    assert q_rubric.status_code == 201
    res_rubric = q_rubric.json()
    assert res_rubric["route"] == "ANSWER"
    assert res_rubric["reason_code"] == "ACTIVE_POLICY_UPDATE"
    assert "25%" in res_rubric["answer"] and "45%" in res_rubric["answer"]




