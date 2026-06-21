import json
from pathlib import Path
from typing import Any, cast

import pandas as pd

from app.core.supabase_client import supabase
from app.services.rule_engine_service import RuleEngineService


class AnalysisService:

    @staticmethod
    def read_dataset(file_path: str, file_type: str):
        path = Path(file_path)

        if file_type == "csv":
            return pd.read_csv(
                path,
                sep=None,
                engine="python",
                encoding="utf-8-sig"
            )

        if file_type == "xlsx":
            return pd.read_excel(path)

        if file_type == "json":
            with open(path, "r", encoding="utf-8-sig") as file:
                data = json.load(file)

            if isinstance(data, dict):
                if "data" in data:
                    data = data["data"]
                elif "transactions" in data:
                    data = data["transactions"]
                else:
                    data = [data]

            return pd.DataFrame(data)

        raise ValueError("Unsupported dataset type")

    @staticmethod
    def run_analysis(dataset_id: str):
        dataset_response = (
            supabase
            .table("datasets")
            .select("*")
            .eq("id", dataset_id)
            .execute()
        )

        if not dataset_response.data:
            return {"error": "Dataset not found"}

        dataset = cast(dict[str, Any], dataset_response.data[0])

        client_id = str(dataset.get("client_id"))
        file_path = str(dataset.get("file_path"))
        file_type = str(dataset.get("file_type"))

        if not client_id or client_id == "None":
            return {"error": "Dataset does not have client_id"}

        if not file_path or file_path == "None":
            return {"error": "Dataset does not have file_path"}

        if not file_type or file_type == "None":
            return {"error": "Dataset does not have file_type"}

        dataframe = AnalysisService.read_dataset(
            file_path,
            file_type
        )

        analysis_response = (
            supabase
            .table("analyses")
            .insert(
                {
                    "dataset_id": dataset_id,
                    "client_id": client_id,
                    "analysis_status": "RUNNING",
                    "total_transactions": len(dataframe),
                    "high_risk_count": 0,
                    "medium_risk_count": 0,
                    "low_risk_count": 0,
                }
            )
            .execute()
        )

        if not analysis_response.data:
            return {"error": "Failed to create analysis record"}

        analysis = cast(dict[str, Any], analysis_response.data[0])
        analysis_id = str(analysis.get("id"))

        client_rules_response = (
            supabase
            .table("client_rules")
            .select("*, rules(*)")
            .eq("client_id", client_id)
            .eq("enabled", True)
            .execute()
        )

        client_rules = cast(
            list[dict[str, Any]],
            client_rules_response.data or []
        )

        findings = RuleEngineService.apply_rules(
            dataframe,
            client_rules
        )

        findings_payload: list[dict[str, Any]] = []

        for finding in findings:
            finding["analysis_id"] = analysis_id
            findings_payload.append(finding)

        if findings_payload:
            (
                supabase
                .table("findings")
                .insert(findings_payload)
                .execute()
            )

        low_count = sum(
            1 for finding in findings
            if finding["risk_level"] == "Low"
        )

        medium_count = sum(
            1 for finding in findings
            if finding["risk_level"] == "Medium"
        )

        high_count = sum(
            1 for finding in findings
            if finding["risk_level"] in ["High", "Critical"]
        )

        (
            supabase
            .table("analyses")
            .update(
                {
                    "analysis_status": "COMPLETED",
                    "low_risk_count": low_count,
                    "medium_risk_count": medium_count,
                    "high_risk_count": high_count,
                }
            )
            .eq("id", analysis_id)
            .execute()
        )

        return {
            "analysis_id": analysis_id,
            "dataset_id": dataset_id,
            "total_transactions": len(dataframe),
            "findings_count": len(findings),
            "low_risk_count": low_count,
            "medium_risk_count": medium_count,
            "high_risk_count": high_count,
            "findings_preview": findings[:10],
        }