from app.core.supabase_client import supabase


class FindingService:

    @staticmethod
    def get_all_findings():
        response = (
            supabase
            .table("findings")
            .select("*, analyses(*)")
            .order("created_at", desc=True)
            .execute()
        )

        return response.data

    @staticmethod
    def get_findings_by_analysis(analysis_id: str):
        response = (
            supabase
            .table("findings")
            .select("*")
            .eq("analysis_id", analysis_id)
            .order("risk_score", desc=True)
            .execute()
        )

        return response.data