from fastapi import APIRouter

from app.schemas.rule_schema import RuleCreate
from app.services.rule_service import RuleService

router = APIRouter(
    prefix="/rules",
    tags=["Rules"]
)


@router.get("/")
def get_rules():
    return RuleService.get_all_rules()


@router.get("/system")
def get_system_rules():
    return RuleService.get_system_rules()


@router.post("/")
def create_rule(rule: RuleCreate):
    return RuleService.create_rule(
        rule.model_dump()
    )