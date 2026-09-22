import pytest

from app.ai.fake import FakeProvider
from app.ingestion.chunking import chunk_text
from app.schemas.referee import AIHealth


def test_chunking_preserves_headings_and_overlap():
    long_section = " ".join(f"word-{index}" for index in range(35))
    chunks = chunk_text(f"# Policy\n\n{long_section}", max_words=20, overlap_words=5)
    assert len(chunks) == 2
    assert all(chunk.heading == "Policy" for chunk in chunks)
    assert chunks[0].content.split()[-5:] == chunks[1].content.split()[:5]


@pytest.mark.asyncio
async def test_document_ingestion_is_idempotent(client):
    created = await client.post(
        "/api/v1/documents",
        json={
            "id": "rubric-copy-v2",
            "course_id": "CO3001",
            "title": "Rubric bản kiểm thử",
            "document_type": "MARKDOWN",
            "source_path": "data/sample-documents/project-rubric-v1.md",
            "version": "2.0",
            "effective_from": "2026-09-01",
            "effective_until": "2027-01-31",
        },
    )
    assert created.status_code == 201, created.text
    assert created.json()["status"] == "PENDING"

    first = await client.post("/api/v1/documents/rubric-copy-v2/ingest")
    assert first.status_code == 200, first.text
    assert first.json()["status"] == "ACTIVE"
    assert first.json()["embedding_dimensions"] == 768
    assert first.json()["chunk_count"] > 0
    assert first.json()["idempotent"] is False

    second = await client.post("/api/v1/documents/rubric-copy-v2/ingest")
    assert second.status_code == 200, second.text
    assert second.json()["idempotent"] is True
    assert second.json()["chunk_count"] == first.json()["chunk_count"]


@pytest.mark.asyncio
async def test_rag_retrieves_rubric_for_rubric_question(client):
    response = await client.post(
        "/api/v1/questions",
        json={
            "actor_id": "student-a1",
            "course_id": "CO3001",
            "text": "Rubric chấm điểm báo cáo và sản phẩm có các tiêu chí nào?",
        },
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["route"] == "ANSWER"
    assert body["citations"]
    assert body["citations"][0]["document_title"] == "Rubric đánh giá đồ án CO3001"


class FailingDecisionProvider(FakeProvider):
    async def decide(self, *args, **kwargs):  # type: ignore[no-untyped-def]
        raise TimeoutError("simulated AI timeout")

    async def health(self) -> AIHealth:
        return AIHealth(mode="test", available=False, model="failing")


@pytest.mark.asyncio
async def test_ai_failure_escalates_safely(client):
    from app.main import app

    original = app.state.ai_provider
    app.state.ai_provider = FailingDecisionProvider()
    try:
        response = await client.post(
            "/api/v1/questions",
            json={
                "actor_id": "student-a1",
                "course_id": "CO3001",
                "text": "Một nhóm đồ án thường có bao nhiêu người?",
            },
        )
    finally:
        app.state.ai_provider = original
    assert response.status_code == 201, response.text
    assert response.json()["route"] == "ESCALATE"
    assert response.json()["uncertainty_type"] == "AI_UNAVAILABLE"
    audit = await client.get(
        f"/api/v1/audit/question/{response.json()['question_id']}"
    )
    failed_events = [event for event in audit.json() if event["event_type"] == "AI_FAILED"]
    assert failed_events
    assert failed_events[0]["output_snapshot"] == {"failure_type": "TimeoutError"}


@pytest.mark.asyncio
async def test_unrelated_question_does_not_receive_definitive_answer(client):
    response = await client.post(
        "/api/v1/questions",
        json={
            "actor_id": "student-a1",
            "course_id": "CO3001",
            "text": "Ký túc xá đóng cửa lúc mấy giờ?",
        },
    )
    assert response.status_code == 201, response.text
    assert response.json()["route"] == "ESCALATE"
    assert response.json()["uncertainty_type"] == "OUT_OF_POLICY"
    assert response.json()["answer"] is None


@pytest.mark.asyncio
async def test_conflicting_active_document_versions_escalate(client):
    registered = await client.post(
        "/api/v1/documents",
        json={
            "id": "group-policy-conflict",
            "course_id": "CO3001",
            "title": "Quy định nhóm đồ án CO3001",
            "document_type": "MARKDOWN",
            "source_path": "data/sample-documents/project-rubric-v1.md",
            "version": "conflicting-demo",
            "effective_from": "2026-09-01",
            "effective_until": "2027-01-31",
        },
    )
    assert registered.status_code == 201, registered.text
    ingested = await client.post("/api/v1/documents/group-policy-conflict/ingest")
    assert ingested.status_code == 200, ingested.text

    response = await client.post(
        "/api/v1/questions",
        json={
            "actor_id": "student-a1",
            "course_id": "CO3001",
            "text": "Một nhóm đồ án có bao nhiêu thành viên?",
        },
    )
    assert response.status_code == 201, response.text
    assert response.json()["route"] == "ESCALATE"
    assert response.json()["uncertainty_type"] == "CONFLICTING_EVIDENCE"

    reset = await client.post("/api/v1/demo/reset")
    assert reset.status_code == 200
    after_reset = await client.post(
        "/api/v1/questions",
        json={
            "actor_id": "student-a1",
            "course_id": "CO3001",
            "text": "Một nhóm đồ án có bao nhiêu thành viên?",
        },
    )
    assert after_reset.status_code == 201
    assert after_reset.json()["route"] == "ANSWER"
