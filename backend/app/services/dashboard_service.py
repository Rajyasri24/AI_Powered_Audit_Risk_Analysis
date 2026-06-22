from collections import Counter
from typing import Any, cast

from app.core.supabase_client import supabase


class DashboardService:

    @staticmethod
    def get_summary():
        clients = cast(
            list[dict[str, Any]],
            supabase.table("clients").select("*").execute().data or []
        )

        datasets = cast(
            list[dict[str, Any]],
            supabase.table("datasets").select("*").execute().data or []
        )

        analyses = cast(
            list[dict[str, Any]],
            supabase.table("analyses").select("*").execute().data or []
        )

        findings = cast(
            list[dict[str, Any]],
            supabase.table("findings").select("*").execute().data or []
        )

        risk_counts = {
            "Low": 0,
            "Medium": 0,
            "High": 0,
            "Critical": 0,
        }

        triggered_rule_counter = Counter()

        for finding in findings:
            risk_level = finding.get("risk_level")

            if risk_level in risk_counts:
                risk_counts[risk_level] += 1

            triggered_rules = finding.get("triggered_rules") or []

            if isinstance(triggered_rules, list):
                for rule in triggered_rules:
                    triggered_rule_counter[str(rule)] += 1

        top_rules = [
            {
                "rule_name": rule,
                "count": count
            }
            for rule, count in triggered_rule_counter.most_common(5)
        ]

        recent_analyses = analyses[:5]

        return {
            "total_clients": len(clients),
            "total_datasets": len(datasets),
            "total_analyses": len(analyses),
            "total_findings": len(findings),
            "risk_counts": risk_counts,
            "top_triggered_rules": top_rules,
            "recent_analyses": recent_analyses,
        }