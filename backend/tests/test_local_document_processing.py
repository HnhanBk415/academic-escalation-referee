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
