import io

import pytest
from docx import Document


def _docx_with_heading(heading: str) -> bytes:
    document = Document()
    document.add_heading(heading, level=1)
    document.add_paragraph("Nội dung báo cáo mẫu.")
    stream = io.BytesIO()
    document.save(stream)
    return stream.getvalue()


@pytest.mark.asyncio
async def test_format_check_requires_approved_criteria(client):
    response = await client.post(
        "/api/v1/format-checks/checks",
        data={"course_id": "CO3001", "actor_id": "demo-student"},
        files={"file": ("report.docx", _docx_with_heading("Mở đầu"), "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
    )
    assert response.status_code == 200
    assert response.json()["overall_status"] == "UNABLE_TO_CHECK"
    assert response.json()["results"] == []


@pytest.mark.asyncio
async def test_template_criteria_is_approved_and_checked_without_ai(client):
    created = await client.post(
        "/api/v1/format-checks/criteria/drafts",
        json={
            "course_id": "CO3001",
            "lecturer_id": "lecturer-01",
            "title": "Mẫu báo cáo",
            "criteria": [
                {
                    "name": "Khung đề mục",
                    "description": "Bài phải có đề mục Mở đầu.",
                    "rule_type": "TEMPLATE",
                    "expected_value": {"headings": ["Mở đầu"], "allow_extra": True, "strict_names": True},
                }
            ],
        },
    )
    assert created.status_code == 201, created.text
    criteria_id = created.json()["id"]
    assert created.json()["criteria"][0]["automatable"] is True

    approved = await client.post(f"/api/v1/format-checks/criteria/{criteria_id}/approve?lecturer_id=lecturer-01")
    assert approved.status_code == 200, approved.text
    assert approved.json()["status"] == "ACTIVE"

    response = await client.post(
        "/api/v1/format-checks/checks",
        data={"course_id": "CO3001", "actor_id": "demo-student"},
        files={"file": ("report.docx", _docx_with_heading("Mở đầu"), "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
    )
    assert response.status_code == 200, response.text
    assert response.json()["overall_status"] == "PASS"
    assert response.json()["criteria_version"] == 1
    assert response.json()["results"][0]["status"] == "PASS"


@pytest.mark.asyncio
async def test_ambiguous_template_creates_limited_review_case(client):
    created = await client.post(
        "/api/v1/format-checks/criteria/drafts",
        json={
            "course_id": "CO3001",
            "lecturer_id": "lecturer-01",
            "title": "Mẫu báo cáo",
            "criteria": [{
                "name": "Khung đề mục", "description": "Có mục Tổng quan.", "rule_type": "TEMPLATE",
                "expected_value": {"headings": ["Tổng quan"], "allow_extra": True, "strict_names": True},
            }],
        },
    )
    criteria_id = created.json()["id"]
    await client.post(f"/api/v1/format-checks/criteria/{criteria_id}/approve?lecturer_id=lecturer-01")
    checked = await client.post(
        "/api/v1/format-checks/checks",
        data={"course_id": "CO3001", "actor_id": "demo-student"},
        files={"file": ("report.docx", _docx_with_heading("Tổng quan đề tài"), "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
    )
    assert checked.status_code == 200, checked.text
    assert checked.json()["overall_status"] == "UNABLE_TO_CHECK"
    review_id = checked.json()["review_case_id"]
    assert review_id

    reviews = await client.get("/api/v1/format-checks/reviews?course_id=CO3001&lecturer_id=lecturer-01")
    assert reviews.status_code == 200
    assert reviews.json()[0]["id"] == review_id
    assert "headings" in reviews.json()[0]["extracted_snapshot"]

    decided = await client.post(
        f"/api/v1/format-checks/reviews/{review_id}/decision",
        json={"reviewer_id": "lecturer-01", "decision": "ACCEPTED", "reason": "Tên đề mục tương đương."},
    )
    assert decided.status_code == 200
    assert decided.json()["status"] == "ACCEPTED"


@pytest.mark.asyncio
async def test_academic_30_checklist_draft_and_evaluation(client):
    # 1. Trích để tạo checklist từ quy định: cái nào có thì nạp, không có bỏ trống
    draft_res = await client.post(
        "/api/v1/format-checks/criteria/drafts/from-documents",
        json={
            "course_id": "CO3001",
            "lecturer_id": "lecturer-01",
            "title": "Checklist Quy chế Báo cáo 30 Tiêu chí",
            "document_ids": ["format-guidelines-v1"],
            "include_template_structure": True,
        },
    )
    assert draft_res.status_code == 201, draft_res.text
    draft_data = draft_res.json()
    criteria = draft_data["criteria"]
    assert len(criteria) >= 4

    # Verify populated items from regulation
    criteria_names = [c["name"] for c in criteria]
    assert any("Khổ giấy" in name for name in criteria_names)
    assert any("Phông chữ" in name for name in criteria_names)

    # Approve criteria
    crit_set_id = draft_data["id"]
    await client.post(f"/api/v1/format-checks/criteria/{crit_set_id}/approve?lecturer_id=lecturer-01")

    # 2 & 3. Trích facts từ báo cáo và giao cả 2 cho AI / Rule engine đánh giá
    checked = await client.post(
        "/api/v1/format-checks/checks",
        data={"course_id": "CO3001", "actor_id": "demo-student"},
        files={"file": ("report_sv.docx", _docx_with_heading("1. Mô tả đồ án"), "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
    )
    assert checked.status_code == 200, checked.text
    res_data = checked.json()

    # Bảng tổng hợp kiểm tra 30 tiêu chí (Checklist summary)
    summary = res_data.get("checklist_summary")
    assert summary is not None
    assert len(summary) == 30

    # Tiêu chí có quy định được đánh giá (PASS / FAIL / AMBIGUOUS)
    page_setup_item = next(item for item in summary if item["index"] == 1)
    assert page_setup_item["status"] in {"PASS", "FAIL"}

    # Tiêu chí quy định không đề cập thì để trống (NOT_SPECIFIED)
    equations_item = next(item for item in summary if item["index"] == 14)
    assert equations_item["status"] == "NOT_SPECIFIED"
    assert equations_item["icon"] == "⚪"
