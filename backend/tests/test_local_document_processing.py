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
async def test_new_local_version_supersedes_old_active_version(client):
    payload = {
        "course_id": "CO3001",
        "title": "Quy định phiên bản Local",
        "text_content": "Quy định phiên bản thử nghiệm.",
    }
    first = await client.post(
        "/api/v1/documents/processing/text", json={**payload, "version": "1.0"}
    )
    assert first.status_code == 201, first.text
    assert (await client.post(f"/api/v1/documents/processing/{first.json()['id']}/finalize")).status_code == 200

    second = await client.post(
        "/api/v1/documents/processing/text", json={**payload, "version": "2.0"}
    )
    assert second.status_code == 201, second.text
    assert (await client.post(f"/api/v1/documents/processing/{second.json()['id']}/finalize")).status_code == 200

    old_document = await client.get(f"/api/v1/documents/{first.json()['document']['id']}")
    new_document = await client.get(f"/api/v1/documents/{second.json()['document']['id']}")
    assert old_document.json()["status"] == "SUPERSEDED"
    assert new_document.json()["status"] == "ACTIVE"
