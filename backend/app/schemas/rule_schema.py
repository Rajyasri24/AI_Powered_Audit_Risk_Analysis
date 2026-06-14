from pydantic import BaseModel
from typing import Optional


class RuleCreate(BaseModel):
    rule_name: str
    description: str
    default_threshold: Optional[float] = 0
    default_weight: int
    severity: str
    rule_category: str
    rule_type: str = "CUSTOM"


class RuleUpdate(BaseModel):
    default_threshold: Optional[float] = None
    default_weight: Optional[int] = None
    severity: Optional[str] = None