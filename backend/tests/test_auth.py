import json

import pytest

from app.core.auth import password_hash
from app.core.config import get_settings


@pytest.mark.asyncio
async def test_password_mode_derives_actor_from_bearer_token(client, monkeypatch):
    monkeypatch.setenv("AUTH_MODE", "password")
    monkeypatch.setenv("AUTH_SECRET_KEY", "test-only-secret-key-with-at-least-32-characters")
    monkeypatch.setenv(
        "AUTH_USERS_JSON",
        json.dumps(
            {
                "student-a1": password_hash("student-password", salt=b"student-test-salt"),
                "lecturer-01": password_hash("lecturer-password", salt=b"lecturer-test-salt"),
                "academic-affairs-01": password_hash("affairs-password", salt=b"affairs-test-salt"),
            }
        ),
    )
    get_settings.cache_clear()
    try:
        unauthenticated = await client.get("/api/v1/questions")
        assert unauthenticated.status_code == 401

        failed_login = await client.post(
            "/api/v1/auth/login",
            json={"actor_id": "student-a1", "password": "wrong"},
        )
        assert failed_login.status_code == 401
        assert failed_login.json()["error"]["code"] == "AUTH_LOGIN_FAILED"

        login = await client.post(
            "/api/v1/auth/login",
            json={"actor_id": "student-a1", "password": "student-password"},
        )
        assert login.status_code == 200
        token = login.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        me = await client.get("/api/v1/auth/me", headers=headers)
        assert me.status_code == 200
        assert me.json()["id"] == "student-a1"

        spoofed = await client.post(
            "/api/v1/questions",
            headers=headers,
            json={
                "actor_id": "student-b1",
                "course_id": "CO3001",
                "group_id": "group-a",
                "text": "Tôi có thể giả mạo sinh viên khác không?",
            },
        )
        assert spoofed.status_code == 403
        assert spoofed.json()["error"]["code"] == "ACTOR_ID_MISMATCH"

        question = await client.post(
            "/api/v1/questions",
            headers=headers,
            json={
                "course_id": "CO3001",
                "group_id": "group-a",
                "text": "Tôi cần hỏi quy định về báo cáo.",
            },
        )
        assert question.status_code == 201
        assert question.json()["actor_id"] == "student-a1"

        audit = await client.get("/api/v1/audit", headers=headers)
        assert audit.status_code == 403
        assert audit.json()["error"]["code"] == "ROLE_NOT_AUTHORIZED"

        operations_as_student = await client.get("/api/v1/operations/overview", headers=headers)
        assert operations_as_student.status_code == 403

        affairs_login = await client.post(
            "/api/v1/auth/login",
            json={"actor_id": "academic-affairs-01", "password": "affairs-password"},
        )
        affairs_headers = {"Authorization": f"Bearer {affairs_login.json()['access_token']}"}
        operations_as_affairs = await client.get(
            "/api/v1/operations/overview", headers=affairs_headers
        )
        assert operations_as_affairs.status_code == 200
    finally:
        get_settings.cache_clear()
