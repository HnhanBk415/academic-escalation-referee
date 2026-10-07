"""Authentication boundary for the demo deployment.

There is intentionally no public registration flow. Operators provision
account/password pairs through a deployment secret; the API issues short-lived
HMAC signed bearer tokens. This keeps credentials out of the repository and
leaves a clean seam for a future SSO provider.
"""

import base64
import hashlib
import hmac
import json
import os
import time
from dataclasses import dataclass
from typing import Any

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.enums import ActorRole
from app.core.errors import AppError
from app.db.session import get_session
from app.models import Actor


@dataclass(frozen=True)
class CurrentActor:
    id: str
    display_name: str
    role: str


PBKDF2_ITERATIONS = 600_000


def _b64encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


def _b64decode(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


def configured_users() -> dict[str, str]:
    raw = get_settings().auth_users_json.strip()
    if not raw:
        return {}
    try:
        parsed: Any = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise AppError(
            "AUTH_CONFIGURATION_INVALID",
            "AUTH_USERS_JSON phải là JSON object hợp lệ.",
            status_code=500,
        ) from exc
    if not isinstance(parsed, dict) or not all(
        isinstance(actor_id, str) and isinstance(password, str)
        for actor_id, password in parsed.items()
    ):
        raise AppError(
            "AUTH_CONFIGURATION_INVALID",
            "AUTH_USERS_JSON phải ánh xạ actor_id tới mật khẩu.",
            status_code=500,
        )
    return parsed


def password_hash(password: str, *, salt: bytes | None = None) -> str:
    """Return a portable PBKDF2-SHA256 record for AUTH_USERS_JSON."""
    actual_salt = salt or os.urandom(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), actual_salt, PBKDF2_ITERATIONS
    )
    return f"pbkdf2_sha256${PBKDF2_ITERATIONS}${_b64encode(actual_salt)}${_b64encode(digest)}"


def password_matches(stored: str, supplied: str) -> bool:
    """Verify a PBKDF2 record; accept legacy plaintext only for local migration."""
    if not stored.startswith("pbkdf2_sha256$"):
        return hmac.compare_digest(stored, supplied)
    try:
        algorithm, iterations, encoded_salt, encoded_digest = stored.split("$")
        if algorithm != "pbkdf2_sha256":
            return False
        derived = hashlib.pbkdf2_hmac(
            "sha256",
            supplied.encode("utf-8"),
            _b64decode(encoded_salt),
            int(iterations),
        )
        return hmac.compare_digest(derived, _b64decode(encoded_digest))
    except (TypeError, ValueError):
        return False


def _require_secret() -> str:
    secret = get_settings().auth_secret_key
    if len(secret) < 32:
        raise AppError(
            "AUTH_CONFIGURATION_INVALID",
            "AUTH_SECRET_KEY phải có ít nhất 32 ký tự khi AUTH_MODE=password.",
            status_code=500,
        )
    return secret


def issue_access_token(actor_id: str) -> tuple[str, int]:
    settings = get_settings()
    expires_at = int(time.time()) + settings.auth_token_ttl_minutes * 60
    payload = {"sub": actor_id, "exp": expires_at, "v": 1}
    encoded_payload = _b64encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signature = hmac.new(
        _require_secret().encode("utf-8"), encoded_payload.encode("ascii"), hashlib.sha256
    ).digest()
    return f"aer1.{encoded_payload}.{_b64encode(signature)}", expires_at


def verify_access_token(token: str) -> str:
    try:
        prefix, encoded_payload, encoded_signature = token.split(".")
        if prefix != "aer1":
            raise ValueError("unknown token prefix")
        expected = hmac.new(
            _require_secret().encode("utf-8"),
            encoded_payload.encode("ascii"),
            hashlib.sha256,
        ).digest()
        if not hmac.compare_digest(expected, _b64decode(encoded_signature)):
            raise ValueError("signature mismatch")
        payload = json.loads(_b64decode(encoded_payload))
        actor_id = payload["sub"]
        if not isinstance(actor_id, str) or payload.get("exp", 0) <= time.time():
            raise ValueError("expired or malformed payload")
        return actor_id
    except (KeyError, TypeError, ValueError, UnicodeDecodeError, json.JSONDecodeError):
        raise AppError(
            "AUTH_TOKEN_INVALID",
            "Phiên đăng nhập không hợp lệ hoặc đã hết hạn.",
            status_code=401,
        ) from None


async def get_current_actor(
    request: Request, session: AsyncSession = Depends(get_session)
) -> CurrentActor:
    settings = get_settings()
    if settings.auth_mode == "demo":
        actor_id = request.headers.get("X-Demo-Actor-ID", "demo-student")
    else:
        scheme, _, token = request.headers.get("Authorization", "").partition(" ")
        if scheme.lower() != "bearer" or not token:
            raise AppError(
                "AUTHENTICATION_REQUIRED",
                "Cần đăng nhập để sử dụng API này.",
                status_code=401,
            )
        actor_id = verify_access_token(token)

    actor = await session.get(Actor, actor_id)
    if actor is None:
        raise AppError("AUTH_ACTOR_NOT_FOUND", "Tài khoản không còn tồn tại.", status_code=401)
    return CurrentActor(id=actor.id, display_name=actor.display_name, role=actor.role)


def production_auth_enabled() -> bool:
    return get_settings().auth_mode == "password"


def effective_actor_id(current: CurrentActor, supplied_actor_id: str | None) -> str:
    """Ignore spoofable actor ids outside explicitly labelled demo mode."""
    if production_auth_enabled():
        # Older request schemas default omitted actor_id to demo-student. Treat
        # that sentinel as omitted, then always replace it with the token's
        # subject. Any other conflicting id is an attempted impersonation.
        if (
            supplied_actor_id
            and supplied_actor_id != "demo-student"
            and supplied_actor_id != current.id
        ):
            raise AppError(
                "ACTOR_ID_MISMATCH",
                "Danh tính trong yêu cầu không khớp với phiên đăng nhập.",
                status_code=403,
            )
        return current.id
    return supplied_actor_id or current.id


def require_role(current: CurrentActor, *roles: ActorRole) -> None:
    """Role checks are enforced in password mode; demo remains intentionally open."""
    if production_auth_enabled() and current.role not in roles:
        raise AppError(
            "ROLE_NOT_AUTHORIZED",
            "Tài khoản không có quyền thực hiện thao tác này.",
            status_code=403,
        )
