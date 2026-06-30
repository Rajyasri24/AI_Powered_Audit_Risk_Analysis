from typing import Any, cast

from fastapi import HTTPException

from app.core.supabase_client import supabase


class ClientService:

    @staticmethod
    def create_client(data: dict[str, Any]):
        client_response = (
            supabase
            .table("clients")
            .insert(data)
            .execute()
        )

        if not client_response.data:
            raise HTTPException(
                status_code=500,
                detail="Failed to create client."
            )

        client = cast(dict[str, Any], client_response.data[0])
        client_id = client.get("id")

        if not client_id:
            raise HTTPException(
                status_code=500,
                detail="Client created but client ID was not returned."
            )

        system_rules_response = (
            supabase
            .table("rules")
            .select("*")
            .eq("is_system_rule", True)
            .execute()
        )

        rules_data = cast(
            list[dict[str, Any]],
            system_rules_response.data or []
        )

        if not rules_data:
            raise HTTPException(
                status_code=500,
                detail="Client created, but no default system rules were found."
            )

        client_rule_rows: list[dict[str, Any]] = []

        for rule in rules_data:
            rule_id = rule.get("id")

            if not rule_id:
                continue

            client_rule_rows.append(
                {
                    "client_id": client_id,
                    "rule_id": rule_id,
                    "custom_threshold": rule.get("default_threshold"),
                    "likelihood": rule.get("likelihood") or 3,
                    "impact": rule.get("impact") or 3,
                    "enabled": True,
                }
            )

        if not client_rule_rows:
            raise HTTPException(
                status_code=500,
                detail="Client created, but default rule rows could not be prepared."
            )

        rule_insert_response = (
            supabase
            .table("client_rules")
            .insert(client_rule_rows)
            .execute()
        )

        rules_created_count = len(rule_insert_response.data or [])

        if rules_created_count != len(client_rule_rows):
            raise HTTPException(
                status_code=500,
                detail=(
                    "Client created, but default rule provisioning was incomplete. "
                    f"Expected {len(client_rule_rows)} rules, created {rules_created_count}."
                )
            )

        return {
            "client": client,
            "rules_created_count": rules_created_count,
            "message": "Client created and default rules provisioned successfully."
        }

    @staticmethod
    def get_all_clients():
        response = (
            supabase
            .table("clients")
            .select("*")
            .order("created_at", desc=True)
            .execute()
        )

        return response.data

    @staticmethod
    def get_client(client_id: str):
        response = (
            supabase
            .table("clients")
            .select("*")
            .eq("id", client_id)
            .execute()
        )

        return response.data

    @staticmethod
    def delete_client(client_id: str):
        response = (
            supabase
            .table("clients")
            .delete()
            .eq("id", client_id)
            .execute()
        )

        return response.data