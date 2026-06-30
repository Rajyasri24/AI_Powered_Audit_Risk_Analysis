from app.core.supabase_client import supabase


class FindingService:

    @staticmethod
    def get_all_findings():
        response = (
            supabase
            .table("findings")
            .select("*")
            .order("created_at", desc=True)
            .execute()
        )

        return response.data or []

    @staticmethod
    def get_finding(finding_id: str):
        response = (
            supabase
            .table("findings")
            .select("*")
            .eq("id", finding_id)
            .execute()
        )

        return response.data[0] if response.data else None