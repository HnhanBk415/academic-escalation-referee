import pytest


@pytest.mark.asyncio
async def test_operations_overview_returns_operational_metrics(client):
    response = await client.get(
        "/api/v1/operations/overview",
        headers={"X-Demo-Actor-ID": "academic-affairs-01"},
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["total_questions"] == 0
    assert body["open_cases"] == 0
    assert body["active_documents"] >= 1
    assert body["pending_format_reviews"] == 0
    assert isinstance(body["recent_activity"], list)
