from typing import Any, cast

from app.core.supabase_client import supabase


class ClientRuleService:

    @staticmethod
    def get_client_rules(client_id: str):
        response = (
            supabase
            .table("client_rules")
            .select("*, rules(*)")
            .eq("client_id", client_id)
            .execute()
        )

        return response.data

    @staticmethod
    def update_client_rule(client_rule_id: str, data: dict[str, Any]):
        update_payload = {
            key: value
            for key, value in data.items()
            if value is not None
        }

        if not update_payload:
            return {"message": "No fields provided for update"}

        response = (
            supabase
            .table("client_rules")
            .update(update_payload)
            .eq("id", client_rule_id)
            .execute()
        )

        return response.data

    @staticmethod
    def create_custom_rule(data: dict[str, Any]):
        client_id = data.pop("client_id")

        rule_payload: dict[str, Any] = {
            "rule_name": data["rule_name"],
            "description": data.get("description"),
            "default_threshold": data.get("custom_threshold", 0),
            "is_system_rule": False,
            "rule_category": "CUSTOM",
            "rule_type": "CUSTOM",
            "likelihood": data["likelihood"],
            "impact": data["impact"],
            "rule_definition": data["rule_definition"],
        }

        rule_response = (
            supabase
            .table("rules")
            .insert(rule_payload)
            .execute()
        )

        if not rule_response.data:
            return {"error": "Failed to create custom rule"}

        custom_rule = cast(dict[str, Any], rule_response.data[0])

        client_rule_payload: dict[str, Any] = {
            "client_id": client_id,
            "rule_id": custom_rule.get("id"),
            "custom_threshold": rule_payload["default_threshold"],
            "likelihood": data["likelihood"],
            "impact": data["impact"],
            "enabled": True,
        }

        client_rule_response = (
            supabase
            .table("client_rules")
            .insert(client_rule_payload)
            .execute()
        )

        return client_rule_response.data

    @staticmethod
    def delete_client_rule(client_rule_id: str):
        response = (
            supabase
            .table("client_rules")
            .delete()
            .eq("id", client_rule_id)
            .execute()
        )

        return response.data