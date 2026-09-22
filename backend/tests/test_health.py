import pytest


@pytest.mark.asyncio
async def test_health(client):
    response = await client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "ok"}

    ai_response = await client.get("/health/ai")
    assert ai_response.status_code == 200
    assert ai_response.json()["mode"] == "fake"
    assert ai_response.json()["available"] is True

