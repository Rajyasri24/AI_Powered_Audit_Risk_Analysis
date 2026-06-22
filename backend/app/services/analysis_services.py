import json
from pathlib import Path
from typing import Any, cast

import pandas as pd

from app.core.supabase_client import supabase
from app.services.rule_engine_service import RuleEngineService
from app.services.ml_service import MLService


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
    def calculate_risk_level(score: float):
        if score <= 20:
            return "Low"
        if score <= 50:
            return "Medium"
        if score <= 75:
            return "High"
        return "Critical"

    @staticmethod
    def merge_rule_and_ml_findings(rule_findings, ml_findings):
        merged: dict[str, dict[str, Any]] = {}

        for finding in rule_findings:
            transaction_id = finding["transaction_id"]

            if transaction_id not in merged:
                merged[transaction_id] = {
                    "transaction_id": transaction_id,
                    "rule_score": 0,
                    "anomaly_score": 0,
                    "network_score": 0,
                    "triggered_rules": [],
                    "anomaly_reasons": [],
                    "detection_sources": [],
                    "reasons": [],
                }

            merged[transaction_id]["rule_score"] += finding.get("rule_score") or 0
            merged[transaction_id]["triggered_rules"].extend(
                finding.get("triggered_rules") or []
            )
            merged[transaction_id]["reasons"].append(
                finding.get("reasons") or "Rule triggered"
            )
            merged[transaction_id]["detection_sources"].append("RULE")

        for anomaly in ml_findings:
            transaction_id = anomaly["transaction_id"]

            if transaction_id not in merged:
                merged[transaction_id] = {
                    "transaction_id": transaction_id,
                    "rule_score": 0,
                    "anomaly_score": 0,
                    "network_score": 0,
                    "triggered_rules": [],
                    "anomaly_reasons": [],
                    "detection_sources": [],
                    "reasons": [],
                }

            merged[transaction_id]["anomaly_score"] += anomaly.get("anomaly_score") or 0
            merged[transaction_id]["anomaly_reasons"].extend(
                anomaly.get("anomaly_reasons") or []
            )
            merged[transaction_id]["detection_sources"].append("ML")
            merged[transaction_id]["reasons"].append(
                "ML anomaly detection flagged this transaction."
            )

        final_findings = []

        for item in merged.values():
            rule_score = item["rule_score"]
            anomaly_score = item["anomaly_score"]
            network_score = item["network_score"]

            risk_score = rule_score + anomaly_score + network_score

            explanation = {
                "summary": "Transaction flagged by audit risk analysis engine.",
                "rule_score": rule_score,
                "anomaly_score": anomaly_score,
                "network_score": network_score,
                "reasons": item["reasons"],
                "anomaly_reasons": item["anomaly_reasons"],
            }

            final_findings.append(
                {
                    "transaction_id": item["transaction_id"],
                    "rule_score": rule_score,
                    "anomaly_score": anomaly_score,
                    "network_score": network_score,
                    "risk_score": risk_score,
                    "risk_level": AnalysisService.calculate_risk_level(risk_score),
                    "triggered_rules": list(set(item["triggered_rules"])),
                    "anomaly_reasons": item["anomaly_reasons"],
                    "detection_sources": list(set(item["detection_sources"])),
                    "reasons": " | ".join(item["reasons"]),
                    "explanation": explanation,
                }
            )

        return final_findings

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

        dataframe = AnalysisService.read_dataset(file_path, file_type)

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

        rule_findings = RuleEngineService.apply_rules(
            dataframe,
            client_rules
        )

        ml_findings = MLService.detect_anomalies(dataframe)

        final_findings = AnalysisService.merge_rule_and_ml_findings(
            rule_findings,
            ml_findings
        )

        findings_payload = []

        for finding in final_findings:
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
            1 for finding in final_findings
            if finding["risk_level"] == "Low"
        )

        medium_count = sum(
            1 for finding in final_findings
            if finding["risk_level"] == "Medium"
        )

        high_count = sum(
            1 for finding in final_findings
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
            "rule_findings_count": len(rule_findings),
            "ml_findings_count": len(ml_findings),
            "findings_count": len(final_findings),
            "low_risk_count": low_count,
            "medium_risk_count": medium_count,
            "high_risk_count": high_count,
            "findings_preview": final_findings[:10],
        }