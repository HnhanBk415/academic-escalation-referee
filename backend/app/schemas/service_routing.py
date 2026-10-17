from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class ServiceClassification(BaseModel):
    service_id: str
    intent: str
    slots: dict[str, str] = Field(default_factory=dict)
    confidence: float = Field(ge=0, le=1)


class ServiceRequestCreate(BaseModel):
    text: str = Field(min_length=3, max_length=4000)
    slots: dict[str, str] = Field(default_factory=dict)


class ServiceClarification(BaseModel):
    text: str = Field(min_length=1, max_length=2000)
    slots: dict[str, str] = Field(default_factory=dict)


class ServiceDecision(BaseModel):
    approved: bool
    reason: str = Field(min_length=3, max_length=500)


class ServiceHandoff(BaseModel):
    destination_name: str = Field(min_length=3, max_length=120)
    note: str = Field(min_length=3, max_length=500)


class ServiceStaffReview(BaseModel):
    message: str = Field(min_length=3, max_length=2000)
    outcome: Literal["wait", "resolve"] = "wait"


class ServiceRequestResponse(BaseModel):
    id: str
    request_id: str
    actor_id: str
    text: str
    service_id: str
    organization_id: str
    intent: str
    status: str
    reason_code: str | None
    confidence: float
    slots: dict[str, str]
    missing_fields: list[str]
    result: dict
    policy_source: str | None
    policy_version: str | None
    sla_due_at: datetime | None
    created_at: datetime
    updated_at: datetime
