from fastapi import APIRouter

from app.schemas.client_rule_schema import (
    ClientRuleUpdate,
    CustomClientRuleCreate,
)
from app.services.client_rule_service import ClientRuleService

router = APIRouter(
    prefix="/client-rules",
    tags=["Client Rules"]
)


@router.get("/{client_id}")
def get_client_rules(client_id: str):
    return ClientRuleService.get_client_rules(client_id)


@router.put("/{client_rule_id}")
def update_client_rule(
    client_rule_id: str,
    rule_update: ClientRuleUpdate
):
    return ClientRuleService.update_client_rule(
        client_rule_id,
        rule_update.model_dump()
    )


@router.post("/custom")
def create_custom_rule(custom_rule: CustomClientRuleCreate):
    return ClientRuleService.create_custom_rule(
        custom_rule.model_dump()
    )


@router.delete("/{client_rule_id}")
def delete_client_rule(client_rule_id: str):
    return ClientRuleService.delete_client_rule(client_rule_id)