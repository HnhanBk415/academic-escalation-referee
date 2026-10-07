from datetime import datetime

from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    actor_id: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1, max_length=256)


class AuthActorResponse(BaseModel):
    id: str
    display_name: str
    role: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_at: datetime
    actor: AuthActorResponse
