from datetime import UTC, datetime

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_actor
from app.core.auth import CurrentActor, configured_users, issue_access_token, password_matches
from app.core.config import get_settings
from app.core.errors import AppError
from app.db.session import get_session
from app.models import Actor
from app.schemas.auth import AuthActorResponse, LoginRequest, LoginResponse

router = APIRouter()


def _actor_response(actor: CurrentActor | Actor) -> AuthActorResponse:
    return AuthActorResponse(id=actor.id, display_name=actor.display_name, role=str(actor.role))


@router.post("/login", response_model=LoginResponse)
async def login(payload: LoginRequest, session: AsyncSession = Depends(get_session)) -> LoginResponse:
    if get_settings().auth_mode != "password":
        raise AppError(
            "AUTH_LOGIN_DISABLED",
            "Đăng nhập chỉ bật khi AUTH_MODE=password.",
            status_code=409,
        )
    configured_password = configured_users().get(payload.actor_id)
    if configured_password is None or not password_matches(configured_password, payload.password):
        raise AppError("AUTH_LOGIN_FAILED", "Thông tin đăng nhập không chính xác.", status_code=401)
    actor = await session.get(Actor, payload.actor_id)
    if actor is None:
        raise AppError("AUTH_LOGIN_FAILED", "Thông tin đăng nhập không chính xác.", status_code=401)
    token, expires_at_epoch = issue_access_token(actor.id)
    return LoginResponse(
        access_token=token,
        expires_at=datetime.fromtimestamp(expires_at_epoch, tz=UTC),
        actor=_actor_response(actor),
    )


@router.get("/me", response_model=AuthActorResponse)
async def me(current: CurrentActor = Depends(get_current_actor)) -> AuthActorResponse:
    return _actor_response(current)
