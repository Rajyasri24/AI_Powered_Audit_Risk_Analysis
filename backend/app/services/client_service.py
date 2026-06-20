from typing import Any, cast

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
            return {"error": "Failed to create client"}

        client = cast(dict[str, Any], client_response.data[0])

        system_rules_response = (
            supabase
            .table("rules")
            .select("*")
            .eq("rule_type", "SYSTEM")
            .execute()
        )

        rules_data = cast(list[dict[str, Any]], system_rules_response.data or [])

        client_rule_rows: list[dict[str, Any]] = []

        for rule in rules_data:
            client_rule_rows.append(
                {
                    "client_id": client.get("id"),
                    "rule_id": rule.get("id"),
                    "custom_threshold": rule.get("default_threshold"),
                    "likelihood": rule.get("likelihood"),
                    "impact": rule.get("impact"),
                    "enabled": True,
                }
            )

        if client_rule_rows:
            (
                supabase
                .table("client_rules")
                .insert(client_rule_rows)
                .execute()
            )

        return client

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