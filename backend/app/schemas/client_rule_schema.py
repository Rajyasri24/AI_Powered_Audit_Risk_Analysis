from typing import Any, Optional

from pydantic import BaseModel, Field


class ClientRuleUpdate(BaseModel):
    custom_threshold: Optional[float] = None
    likelihood: Optional[int] = Field(default=None, ge=1, le=5)
    impact: Optional[int] = Field(default=None, ge=1, le=5)
    enabled: Optional[bool] = None


class CustomClientRuleCreate(BaseModel):
    client_id: str
    rule_name: str
    description: Optional[str] = None
    custom_threshold: Optional[float] = 0
    likelihood: int = Field(ge=1, le=5)
    impact: int = Field(ge=1, le=5)
    rule_definition: dict[str, Any]