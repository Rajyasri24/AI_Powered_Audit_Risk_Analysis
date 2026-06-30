from app.core.supabase_client import supabase



class RuleService:

    @staticmethod
    def get_all_rules():

        response = (
            supabase
            .table("rules")
            .select("*")
            .execute()
        )

        return response.data

    @staticmethod
    def get_system_rules():

        response = (
            supabase
            .table("rules")
            .select("*")
            .eq("rule_type", "SYSTEM")
            .execute()
        )

        return response.data

    @staticmethod
    def create_rule(data):

        response = (
            supabase
            .table("rules")
            .insert(data)
            .execute()
        )

        return response.data