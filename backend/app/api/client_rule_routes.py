from fastapi import APIRouter

from app.services.client_rule_service import ClientRuleService


router = APIRouter(
    prefix="/client-rules",
    tags=["Client Rules"]
)


@router.get("/{client_id}")
def get_client_rules(client_id: str):
    return ClientRuleService.get_client_rules(client_id)


@router.put("/{client_rule_id}")
def update_client_rule(client_rule_id: str, data: dict):
    return ClientRuleService.update_client_rule(client_rule_id, data)


@router.post("/custom")
def create_custom_rule(data: dict):
    return ClientRuleService.create_custom_rule(data)