from __future__ import annotations

import json
from collections import Counter
from datetime import datetime
from typing import Any, cast

from app.core.supabase_client import supabase


RISK_LEVELS = ("Low", "Medium", "High", "Critical")


class DashboardService:
    """
    Auditor-facing dashboard.

    Important business rule:
    repeated executions of the same dataset are execution history, not separate
    audit populations. Dashboard metrics therefore use ONLY the latest completed
    assessment for each dataset.
    """

    @staticmethod
    def get_summary():
        clients = cast(
            list[dict[str, Any]],
            supabase.table("clients")
            .select("*")
            .execute()
            .data
            or [],
        )

        datasets = cast(
            list[dict[str, Any]],
            supabase.table("datasets")
            .select("*")
            .order("upload_date", desc=True)
            .execute()
            .data
            or [],
        )

        all_analyses = cast(
            list[dict[str, Any]],
            supabase.table("analyses")
            .select("*")
            .order("created_at", desc=True)
            .execute()
            .data
            or [],
        )

        all_findings = cast(
            list[dict[str, Any]],
            supabase.table("findings")
            .select("*")
            .order("created_at", desc=True)
            .execute()
            .data
            or [],
        )

        clients_by_id = {
            str(item.get("id")): item
            for item in clients
            if item.get("id")
        }

        datasets_by_id = {
            str(item.get("id")): item
            for item in datasets
            if item.get("id")
        }

        # Latest COMPLETED assessment per dataset.
        latest_by_dataset: dict[str, dict[str, Any]] = {}

        for analysis in all_analyses:
            if str(analysis.get("analysis_status") or "").upper() != "COMPLETED":
                continue

            dataset_id = str(analysis.get("dataset_id") or "")
            if not dataset_id:
                continue

            if dataset_id not in latest_by_dataset:
                latest_by_dataset[dataset_id] = analysis

        latest_analyses = list(latest_by_dataset.values())

        latest_analyses.sort(
            key=lambda item: str(item.get("created_at") or ""),
            reverse=True,
        )

        latest_ids = {
            str(item.get("id"))
            for item in latest_analyses
            if item.get("id")
        }

        analyses_by_id = {
            str(item.get("id")): item
            for item in latest_analyses
            if item.get("id")
        }

        current_findings = [
            item
            for item in all_findings
            if str(item.get("analysis_id") or "") in latest_ids
        ]

        dataset_count_by_client: Counter[str] = Counter(
            str(item.get("client_id"))
            for item in datasets
            if item.get("client_id")
        )

        metrics: dict[str, dict[str, Any]] = {}

        for client in clients:
            client_id = str(client.get("id") or "")
            if not client_id:
                continue

            metrics[client_id] = {
                "client_id": client_id,
                "client_name": client.get("client_name") or "Unnamed Client",
                "client_code": client.get("client_code") or "",
                "transactions_reviewed": 0,
                "current_assessments": 0,
                "datasets": dataset_count_by_client[client_id],
                "findings": 0,
                "review_required": 0,
                "critical_findings": 0,
                "risk_counts": {
                    level: 0
                    for level in RISK_LEVELS
                },
                "latest_assessment_at": None,
                "review_rate": 0.0,
            }

        findings_by_analysis: dict[str, Counter[str]] = {}

        for analysis in latest_analyses:
            analysis_id = str(analysis.get("id") or "")
            dataset = datasets_by_id.get(
                str(analysis.get("dataset_id") or ""),
                {},
            )

            client_id = str(
                analysis.get("client_id")
                or dataset.get("client_id")
                or ""
            )

            metric = metrics.get(client_id)

            if metric:
                metric["current_assessments"] += 1
                metric["transactions_reviewed"] += (
                    DashboardService.safe_int(
                        analysis.get("total_transactions")
                    )
                )

                created_at = analysis.get("created_at")

                if (
                    not metric["latest_assessment_at"]
                    or str(created_at or "")
                    > str(metric["latest_assessment_at"])
                ):
                    metric["latest_assessment_at"] = created_at

            findings_by_analysis[analysis_id] = Counter()

        portfolio_risk_counts = {
            level: 0
            for level in RISK_LEVELS
        }

        enriched_findings: list[dict[str, Any]] = []

        for finding in current_findings:
            analysis_id = str(finding.get("analysis_id") or "")
            analysis = analyses_by_id.get(analysis_id, {})

            dataset = datasets_by_id.get(
                str(analysis.get("dataset_id") or ""),
                {},
            )

            client_id = str(
                analysis.get("client_id")
                or dataset.get("client_id")
                or ""
            )

            client = clients_by_id.get(client_id, {})

            risk_level = str(
                finding.get("risk_level") or "Low"
            ).title()

            if risk_level not in RISK_LEVELS:
                risk_level = "Low"

            portfolio_risk_counts[risk_level] += 1

            counter = findings_by_analysis.setdefault(
                analysis_id,
                Counter(),
            )

            counter["findings"] += 1
            counter[risk_level] += 1

            metric = metrics.get(client_id)

            if metric:
                metric["findings"] += 1
                metric["risk_counts"][risk_level] += 1

                # Anything above Low is work requiring auditor attention.
                if risk_level in {
                    "Medium",
                    "High",
                    "Critical",
                }:
                    metric["review_required"] += 1

                if risk_level == "Critical":
                    metric["critical_findings"] += 1

            enriched_findings.append(
                {
                    "finding_id": finding.get("id"),
                    "analysis_id": analysis_id,
                    "dataset_id": analysis.get("dataset_id"),
                    "client_id": client_id,
                    "client_name": (
                        client.get("client_name")
                        or "Unknown Client"
                    ),
                    "client_code": client.get("client_code") or "",
                    "dataset_name": (
                        dataset.get("dataset_name")
                        or "Unknown Dataset"
                    ),
                    "transaction_id": finding.get("transaction_id"),
                    "risk_level": risk_level,
                    "risk_score": DashboardService.safe_float(
                        finding.get("risk_score")
                    ),
                    "triggered_rules": DashboardService.as_list(
                        finding.get("triggered_rules")
                    ),
                    "created_at": (
                        finding.get("created_at")
                        or analysis.get("created_at")
                    ),
                }
            )

        assessment_rows: list[dict[str, Any]] = []

        for analysis in latest_analyses:
            analysis_id = str(analysis.get("id") or "")
            dataset = datasets_by_id.get(
                str(analysis.get("dataset_id") or ""),
                {},
            )

            client_id = str(
                analysis.get("client_id")
                or dataset.get("client_id")
                or ""
            )

            client = clients_by_id.get(client_id, {})
            counts = findings_by_analysis.get(
                analysis_id,
                Counter(),
            )

            assessment_rows.append(
                {
                    "id": analysis_id,
                    "dataset_id": analysis.get("dataset_id"),
                    "client_id": client_id,
                    "client_name": (
                        client.get("client_name")
                        or "Unknown Client"
                    ),
                    "client_code": client.get("client_code") or "",
                    "dataset_name": (
                        dataset.get("dataset_name")
                        or "Unknown Dataset"
                    ),
                    "assessment_status": (
                        analysis.get("analysis_status")
                    ),
                    "total_transactions": (
                        DashboardService.safe_int(
                            analysis.get("total_transactions")
                        )
                    ),
                    "findings_count": counts.get("findings", 0),
                    "low_risk_count": counts.get("Low", 0),
                    "medium_risk_count": counts.get("Medium", 0),
                    "high_only_count": counts.get("High", 0),
                    "critical_risk_count": counts.get("Critical", 0),
                    "created_at": analysis.get("created_at"),
                }
            )

        for metric in metrics.values():
            reviewed = DashboardService.safe_int(
                metric.get("transactions_reviewed")
            )
            review_required = DashboardService.safe_int(
                metric.get("review_required")
            )

            metric["review_rate"] = (
                round(
                    (review_required / reviewed) * 100,
                    2,
                )
                if reviewed > 0
                else 0.0
            )

        enriched_findings.sort(
            key=lambda item: (
                DashboardService.risk_rank(
                    str(item.get("risk_level") or "")
                ),
                DashboardService.safe_float(
                    item.get("risk_score")
                ),
                str(item.get("created_at") or ""),
            ),
            reverse=True,
        )

        client_overview = sorted(
            metrics.values(),
            key=lambda item: (
                item["critical_findings"],
                item["review_required"],
                item["findings"],
            ),
            reverse=True,
        )

        total_transactions = sum(
            DashboardService.safe_int(
                item.get("transactions_reviewed")
            )
            for item in client_overview
        )

        review_required = sum(
            DashboardService.safe_int(
                item.get("review_required")
            )
            for item in client_overview
        )

        return {
            "portfolio": {
                "total_clients": len(clients),
                "total_datasets": len(datasets),
                "current_assessments": len(latest_analyses),
                # Backward compatibility for older frontend code.
                "total_analyses": len(latest_analyses),
                "total_transactions_reviewed": total_transactions,
                "total_findings": len(enriched_findings),
                "review_required": review_required,
                "critical_findings": (
                    portfolio_risk_counts["Critical"]
                ),
                "review_rate": (
                    round(
                        (
                            review_required
                            / total_transactions
                        )
                        * 100,
                        2,
                    )
                    if total_transactions > 0
                    else 0.0
                ),
                "risk_counts": portfolio_risk_counts,
            },
            "client_overview": client_overview,
            "recent_assessments": assessment_rows[:30],
            # Backward compatibility. Values are CURRENT assessments only.
            "recent_analyses": assessment_rows[:30],
            "findings": enriched_findings,
            "priority_findings": [
                item
                for item in enriched_findings
                if item["risk_level"]
                in {"High", "Critical"}
            ][:20],
            "clients": clients,
            "datasets": datasets,
        }

    @staticmethod
    def as_list(value: Any) -> list[str]:
        if value is None:
            return []

        if isinstance(value, list):
            return [
                str(item).strip()
                for item in value
                if str(item).strip()
            ]

        if isinstance(value, str):
            stripped = value.strip()

            if not stripped:
                return []

            try:
                parsed = json.loads(stripped)

                if isinstance(parsed, list):
                    return [
                        str(item).strip()
                        for item in parsed
                        if str(item).strip()
                    ]
            except json.JSONDecodeError:
                pass

            return [
                item.strip()
                for item in stripped.split("|")
                if item.strip()
            ]

        return [str(value).strip()]

    @staticmethod
    def safe_int(value: Any) -> int:
        try:
            return int(float(value or 0))
        except (TypeError, ValueError):
            return 0

    @staticmethod
    def safe_float(value: Any) -> float:
        try:
            return float(value or 0)
        except (TypeError, ValueError):
            return 0.0

    @staticmethod
    def risk_rank(level: str) -> int:
        return {
            "Critical": 4,
            "High": 3,
            "Medium": 2,
            "Low": 1,
        }.get(level, 0)
