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


@pytest.mark.asyncio
async def test_health_head_and_root(client):
    head_health = await client.head("/health")
    assert head_health.status_code == 200

    head_root = await client.head("/")
    assert head_root.status_code == 200

    get_root = await client.get("/")
    assert get_root.status_code == 200


@pytest.mark.asyncio
async def test_duplicate_slashes_normalized(client):
    # httpx AsyncClient with ASGITransport strips leading double slashes if passed as relative,
    # so we test the app directly via ASGI scope with duplicate slashes
    scope = {
        "type": "http",
        "asgi": {"version": "3.0"},
        "http_version": "1.1",
        "method": "GET",
        "scheme": "http",
        "path": "//health/ai",
        "raw_path": b"//health/ai",
        "query_string": b"",
        "headers": [],
        "client": ("127.0.0.1", 1234),
        "server": ("testserver", 80),
    }
    status = None

    async def receive():
        return {"type": "http.request", "body": b"", "more_body": False}

    async def send(message):
        nonlocal status
        if message["type"] == "http.response.start":
            status = message["status"]

    from app.main import app

    await app(scope, receive, send)
    assert status == 200
