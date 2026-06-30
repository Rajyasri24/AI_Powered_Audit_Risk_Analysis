from collections.abc import Mapping
from typing import Any, cast

from fastapi import HTTPException

from app.core.supabase_client import supabase


SUPPORTED_OPERATORS = {
    ">",
    "<",
    ">=",
    "<=",
    "=",
    "!=",
    "is_null",
    "not_null",
}


class ClientRuleService:

    @staticmethod
    def get_client_rules(client_id: str):
        response = (
            supabase
            .table("client_rules")
            .select("*, rules(*)")
            .eq("client_id", client_id)
            .order("modified_at", desc=True)
            .execute()
        )

        return response.data or []

    @staticmethod
    def update_client_rule(client_rule_id: str, data: dict[str, Any]):
        likelihood = data.get("likelihood")
        impact = data.get("impact")

        if likelihood is not None:
            likelihood_value = int(likelihood)

            if likelihood_value < 1 or likelihood_value > 5:
                raise HTTPException(
                    status_code=400,
                    detail="Likelihood must be between 1 and 5."
                )

            data["likelihood"] = likelihood_value

        if impact is not None:
            impact_value = int(impact)

            if impact_value < 1 or impact_value > 5:
                raise HTTPException(
                    status_code=400,
                    detail="Impact must be between 1 and 5."
                )

            data["impact"] = impact_value

        response = (
            supabase
            .table("client_rules")
            .update(data)
            .eq("id", client_rule_id)
            .execute()
        )

        if not response.data:
            raise HTTPException(
                status_code=404,
                detail="Client rule not found."
            )

        return response.data[0]

    @staticmethod
    def create_custom_rule(data: dict[str, Any]):
        client_id = str(data.get("client_id") or "").strip()
        rule_name = str(data.get("rule_name") or "").strip()
        description = str(data.get("description") or "").strip()
        custom_threshold = data.get("custom_threshold")

        likelihood = int(data.get("likelihood") or 3)
        impact = int(data.get("impact") or 3)

        rule_definition = data.get("rule_definition")

        if not client_id:
            raise HTTPException(
                status_code=400,
                detail="Client is required."
            )

        if not rule_name:
            raise HTTPException(
                status_code=400,
                detail="Rule name is required."
            )

        if likelihood < 1 or likelihood > 5:
            raise HTTPException(
                status_code=400,
                detail="Likelihood must be between 1 and 5."
            )

        if impact < 1 or impact > 5:
            raise HTTPException(
                status_code=400,
                detail="Impact must be between 1 and 5."
            )

        if not isinstance(rule_definition, Mapping):
            raise HTTPException(
                status_code=400,
                detail="Rule definition is invalid."
            )

        logic = str(rule_definition.get("logic", "AND")).upper()

        if logic not in {"AND", "OR"}:
            raise HTTPException(
                status_code=400,
                detail="Rule logic must be AND or OR."
            )

        raw_conditions = rule_definition.get("conditions")

        if not isinstance(raw_conditions, list):
            raise HTTPException(
                status_code=400,
                detail="Conditions must be a list."
            )

        if len(raw_conditions) == 0:
            raise HTTPException(
                status_code=400,
                detail="At least one condition is required."
            )

        validated_conditions: list[dict[str, Any]] = []

        for raw_condition in raw_conditions:
            if not isinstance(raw_condition, Mapping):
                raise HTTPException(
                    status_code=400,
                    detail="Each condition must be a JSON object."
                )

            condition = cast(Mapping[str, Any], raw_condition)

            field = str(condition.get("field") or "").strip()
            operator = str(condition.get("operator") or "").strip()
            value = condition.get("value")

            if not field:
                raise HTTPException(
                    status_code=400,
                    detail="Dataset column is required."
                )

            if operator not in SUPPORTED_OPERATORS:
                raise HTTPException(
                    status_code=400,
                    detail=f"Unsupported operator '{operator}'."
                )

            if operator not in {"is_null", "not_null"}:
                if value is None or str(value).strip() == "":
                    raise HTTPException(
                        status_code=400,
                        detail=f"Comparison value missing for '{field}'."
                    )

            validated: dict[str, Any] = {
                "field": field,
                "operator": operator,
            }

            if operator not in {"is_null", "not_null"}:
                validated["value"] = str(value).strip()

            validated_conditions.append(validated)

        duplicate_response = (
            supabase
            .table("rules")
            .select("id")
            .eq("rule_name", rule_name)
            .eq("rule_type", "CUSTOM")
            .execute()
        )

        existing_rules = duplicate_response.data or []

        for raw_existing_rule in existing_rules:
            existing_rule = cast(dict[str, Any], raw_existing_rule)
            existing_rule_id = existing_rule.get("id")

            if not existing_rule_id:
                continue

            existing_link_response = (
                supabase
                .table("client_rules")
                .select("id")
                .eq("client_id", client_id)
                .eq("rule_id", existing_rule_id)
                .execute()
            )

            if existing_link_response.data:
                raise HTTPException(
                    status_code=400,
                    detail="A custom rule with this name already exists for this client."
                )

        rule_payload = {
            "rule_name": rule_name,
            "description": description,
            "default_threshold": custom_threshold,
            "rule_category": "CUSTOM",
            "rule_type": "CUSTOM",
            "is_system_rule": False,
            "likelihood": likelihood,
            "impact": impact,
            "rule_definition": {
                "logic": logic,
                "conditions": validated_conditions,
            },
        }

        rule_response = (
            supabase
            .table("rules")
            .insert(rule_payload)
            .execute()
        )

        if not rule_response.data:
            raise HTTPException(
                status_code=500,
                detail="Failed to create custom rule."
            )

        rule = cast(dict[str, Any], rule_response.data[0])

        rule_id = rule.get("id")

        if not rule_id:
            raise HTTPException(
                status_code=500,
                detail="Custom rule created but rule ID was not returned."
            )

        client_rule_payload = {
            "client_id": client_id,
            "rule_id": rule_id,
            "custom_threshold": custom_threshold,
            "likelihood": likelihood,
            "impact": impact,
            "enabled": True,
        }

        client_rule_response = (
            supabase
            .table("client_rules")
            .insert(client_rule_payload)
            .execute()
        )

        if not client_rule_response.data:
            raise HTTPException(
                status_code=500,
                detail="Rule created but could not be linked to client."
            )

        return {
            "message": "Custom rule created successfully.",
            "rule": rule,
            "client_rule": client_rule_response.data[0],
        }