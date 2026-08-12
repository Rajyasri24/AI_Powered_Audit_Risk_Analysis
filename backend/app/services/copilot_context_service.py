from __future__ import annotations

import json
from collections import Counter
from typing import Any, cast

from fastapi import HTTPException

from app.core.supabase_client import supabase
from app.services.network_service import NetworkService


class CopilotContextService:
    """Authoritative current audit context from Supabase + network analysis tools."""

    @staticmethod
    def get_selector_context() -> dict[str, Any]:
        clients = cast(
            list[dict[str, Any]],
            supabase.table("clients")
            .select("id, client_name, client_code, industry, client_status")
            .order("created_at", desc=True)
            .execute().data or [],
        )

        datasets = cast(
            list[dict[str, Any]],
            supabase.table("datasets")
            .select(
                "id, client_id, dataset_name, file_type, total_records, "
                "total_columns, upload_status, upload_date"
            )
            .order("upload_date", desc=True)
            .execute().data or [],
        )

        current_analyses = CopilotContextService.latest_completed_analyses()

        current_by_dataset = {
            str(item.get("dataset_id")): item
            for item in current_analyses
            if item.get("dataset_id")
        }

        return {
            "clients": clients,
            "datasets": [
                {
                    **dataset,
                    "has_current_assessment": bool(
                        current_by_dataset.get(str(dataset.get("id")))
                    ),
                    "current_analysis_id": (
                        current_by_dataset
                        .get(str(dataset.get("id")), {})
                        .get("id")
                    ),
                    "current_assessment_at": (
                        current_by_dataset
                        .get(str(dataset.get("id")), {})
                        .get("created_at")
                    ),
                }
                for dataset in datasets
            ],
        }

    @staticmethod
    def latest_completed_analyses(
        client_id: str | None = None,
        dataset_id: str | None = None,
    ) -> list[dict[str, Any]]:
        query = (
            supabase.table("analyses")
            .select("*")
            .eq("analysis_status", "COMPLETED")
            .order("created_at", desc=True)
        )

        if client_id:
            query = query.eq("client_id", client_id)

        if dataset_id:
            query = query.eq("dataset_id", dataset_id)

        rows = cast(
            list[dict[str, Any]],
            query.execute().data or [],
        )

        latest: dict[str, dict[str, Any]] = {}

        for item in rows:
            key = str(item.get("dataset_id") or "")

            if key and key not in latest:
                latest[key] = item

        return list(latest.values())


    @staticmethod
    def resolve_client_from_question(
        question: str,
    ) -> dict[str, Any] | None:
        """
        Resolve a client code/name mentioned in the user's question.
        Example: 'findings for CLT003' -> matching client record.
        """
        text = (
            question
            .strip()
            .lower()
        )

        clients = cast(
            list[dict[str, Any]],
            supabase
            .table("clients")
            .select(
                "id, client_name, client_code, industry, client_status"
            )
            .execute()
            .data
            or [],
        )

        # Prefer exact client-code matches first.
        for client in clients:
            code = str(
                client.get(
                    "client_code"
                )
                or ""
            ).strip()

            if (
                code
                and code.lower()
                in text
            ):
                return client

        # Then try meaningful client-name matches.
        for client in clients:
            name = str(
                client.get(
                    "client_name"
                )
                or ""
            ).strip()

            if (
                name
                and len(name) >= 3
                and name.lower()
                in text
            ):
                return client

        return None

    @staticmethod
    def build_findings_summary_context(
        client_id: str | None = None,
        dataset_id: str | None = None,
    ) -> dict[str, Any]:
        """
        Aggregate ALL current findings in Python and return only a compact
        business summary to the LLM.

        This prevents client/dataset findings questions from being answered
        from the bounded priority sample used by general chat context.
        """
        clients = CopilotContextService._clients(
            client_id
        )

        datasets = CopilotContextService._datasets(
            client_id,
            dataset_id,
        )

        analyses = (
            CopilotContextService
            .latest_completed_analyses(
                client_id=client_id,
                dataset_id=dataset_id,
            )
        )

        if client_id and not clients:
            raise HTTPException(
                status_code=404,
                detail=(
                    "The selected client could not be found."
                ),
            )

        if dataset_id and not datasets:
            raise HTTPException(
                status_code=404,
                detail=(
                    "The selected dataset could not be found."
                ),
            )

        if (
            (client_id or dataset_id)
            and not analyses
        ):
            return {
                "scope": {
                    "client_id": client_id,
                    "dataset_id": dataset_id,
                },
                "clients": clients,
                "datasets": datasets,
                "current_assessments": 0,
                "transactions_reviewed": 0,
                "total_findings": 0,
                "risk_counts": {
                    "Low": 0,
                    "Medium": 0,
                    "High": 0,
                    "Critical": 0,
                },
                "top_audit_observations": [],
                "priority_transactions": [],
                "message": (
                    "No completed current assessment is available in this scope."
                ),
            }

        analysis_ids = [
            str(item.get("id"))
            for item in analyses
            if item.get("id")
        ]

        findings = (
            CopilotContextService
            ._findings(
                analysis_ids,
                transaction_id=None,
            )
            if analysis_ids
            else []
        )

        risk_counts = Counter()
        rule_counter: Counter[str] = Counter()
        reason_counter: Counter[str] = Counter()

        enriched: list[
            dict[str, Any]
        ] = []

        for item in findings:
            risk_level = str(
                item.get(
                    "risk_level"
                )
                or "Low"
            ).title()

            if risk_level not in {
                "Low",
                "Medium",
                "High",
                "Critical",
            }:
                risk_level = "Low"

            risk_counts[
                risk_level
            ] += 1

            rules = (
                CopilotContextService
                ._string_list(
                    item.get(
                        "triggered_rules"
                    )
                )
            )

            reasons = (
                CopilotContextService
                ._string_list(
                    item.get(
                        "reasons"
                    )
                )
            )

            rule_counter.update(
                rules
            )

            reason_counter.update(
                reasons
            )

            enriched.append(
                {
                    "transaction_id": (
                        item.get(
                            "transaction_id"
                        )
                    ),
                    "risk_level": (
                        risk_level
                    ),
                    "risk_score": (
                        CopilotContextService
                        ._number(
                            item.get(
                                "risk_score"
                            )
                        )
                    ),
                    "primary_observation": (
                        rules[0]
                        if rules
                        else (
                            reasons[0]
                            if reasons
                            else (
                                "Transaction requires auditor review"
                            )
                        )
                    ),
                }
            )

        enriched.sort(
            key=lambda item: (
                CopilotContextService
                ._risk_rank(
                    str(
                        item.get(
                            "risk_level"
                        )
                        or ""
                    )
                ),
                CopilotContextService
                ._number(
                    item.get(
                        "risk_score"
                    )
                ),
            ),
            reverse=True,
        )

        client_name = (
            clients[0].get(
                "client_name"
            )
            if len(clients) == 1
            else None
        )

        client_code = (
            clients[0].get(
                "client_code"
            )
            if len(clients) == 1
            else None
        )

        return {
            "scope": {
                "client_id": client_id,
                "dataset_id": dataset_id,
                "client_name": client_name,
                "client_code": client_code,
            },
            "datasets_in_scope": [
                {
                    "dataset_id": item.get(
                        "id"
                    ),
                    "dataset_name": item.get(
                        "dataset_name"
                    ),
                    "total_records": item.get(
                        "total_records"
                    ),
                }
                for item in datasets
            ],
            "current_assessments": len(
                analyses
            ),
            "transactions_reviewed": sum(
                int(
                    item.get(
                        "total_transactions"
                    )
                    or 0
                )
                for item in analyses
            ),
            "total_findings": len(
                findings
            ),
            "risk_counts": {
                "Low": risk_counts.get(
                    "Low",
                    0,
                ),
                "Medium": risk_counts.get(
                    "Medium",
                    0,
                ),
                "High": risk_counts.get(
                    "High",
                    0,
                ),
                "Critical": risk_counts.get(
                    "Critical",
                    0,
                ),
            },
            "top_audit_observations": [
                {
                    "observation": name,
                    "count": count,
                }
                for name, count in (
                    rule_counter
                    .most_common(
                        8
                    )
                )
            ],
            "top_supporting_reasons": [
                {
                    "reason": name,
                    "count": count,
                }
                for name, count in (
                    reason_counter
                    .most_common(
                        6
                    )
                )
            ],
            "priority_transactions": (
                enriched[:10]
            ),
            "current_analysis_ids": [
                item.get("id")
                for item in analyses
            ],
            "current_assessment_times": [
                item.get(
                    "created_at"
                )
                for item in analyses
            ],
        }

    @staticmethod
    def build_live_context(
        client_id: str | None = None,
        dataset_id: str | None = None,
        transaction_id: str | None = None,
        include_findings: bool = True,
        max_findings: int = 12,
    ) -> dict[str, Any]:
        clients = CopilotContextService._clients(client_id)
        datasets = CopilotContextService._datasets(client_id, dataset_id)
        analyses = CopilotContextService.latest_completed_analyses(
            client_id,
            dataset_id,
        )

        if dataset_id and not analyses:
            raise HTTPException(
                status_code=404,
                detail=(
                    "The selected dataset does not have a completed assessment yet."
                ),
            )

        analysis_ids = [
            str(item.get("id"))
            for item in analyses
            if item.get("id")
        ]

        findings: list[dict[str, Any]] = []

        if include_findings and analysis_ids:
            findings = CopilotContextService._findings(
                analysis_ids,
                transaction_id,
            )

        risk_counts = Counter(
            str(item.get("risk_level") or "Unknown")
            for item in findings
        )

        findings_sorted = sorted(
            findings,
            key=lambda item: (
                CopilotContextService._risk_rank(
                    str(item.get("risk_level") or "")
                ),
                CopilotContextService._number(
                    item.get("risk_score")
                ),
            ),
            reverse=True,
        )

        return {
            "current_scope": {
                "client_id": client_id,
                "dataset_id": dataset_id,
                "transaction_id": transaction_id,
            },
            "clients": clients,
            "datasets": datasets,
            "current_analyses": [
                {
                    "analysis_id": item.get("id"),
                    "dataset_id": item.get("dataset_id"),
                    "client_id": item.get("client_id"),
                    "total_transactions": item.get("total_transactions"),
                    "high_risk_count": item.get("high_risk_count"),
                    "medium_risk_count": item.get("medium_risk_count"),
                    "low_risk_count": item.get("low_risk_count"),
                    "completed_at": item.get("created_at"),
                }
                for item in analyses
            ],
            "summary": {
                "current_assessments": len(analyses),
                "transactions_reviewed": sum(
                    int(item.get("total_transactions") or 0)
                    for item in analyses
                ),
                "findings_loaded": len(findings),
                "risk_counts": {
                    "Low": risk_counts.get("Low", 0),
                    "Medium": risk_counts.get("Medium", 0),
                    "High": risk_counts.get("High", 0),
                    "Critical": risk_counts.get("Critical", 0),
                },
            },
            "findings": [
                CopilotContextService._finding_summary(item)
                for item in findings_sorted[:max_findings]
            ]
        }

    @staticmethod
    def build_network_context(
        client_id: str | None = None,
        dataset_id: str | None = None,
    ) -> dict[str, Any]:
        """
        Dedicated network-analysis tool.

        It executes the same NetworkService used by the Network Analytics page,
        so Copilot answers are grounded in the actual graph-analysis result,
        not a sampled subset of findings.
        """
        datasets = CopilotContextService._datasets(
            client_id=client_id,
            dataset_id=dataset_id,
        )

        if dataset_id and not datasets:
            raise HTTPException(
                status_code=404,
                detail="The selected dataset could not be found.",
            )

        if not datasets:
            return {
                "scope": {
                    "client_id": client_id,
                    "dataset_id": dataset_id,
                },
                "datasets_analysed": 0,
                "network_results": [],
                "portfolio_summary": {
                    "supported_datasets": 0,
                    "unsupported_datasets": 0,
                    "suspicious_clusters": 0,
                    "suspicious_identifiers": 0,
                    "network_findings": 0,
                },
            }

        results: list[dict[str, Any]] = []

        portfolio = {
            "supported_datasets": 0,
            "unsupported_datasets": 0,
            "suspicious_clusters": 0,
            "suspicious_identifiers": 0,
            "network_findings": 0,
        }

        for dataset in datasets:
            current = CopilotContextService.latest_completed_analyses(
                dataset_id=str(dataset.get("id")),
            )

            # For current-audit questions, do not use a dataset that has never
            # completed its main assessment.
            if not current:
                continue

            result = NetworkService.analyse_dataset(
                str(dataset.get("id"))
            )

            supported = bool(result.get("supported"))

            if supported:
                portfolio["supported_datasets"] += 1
            else:
                portfolio["unsupported_datasets"] += 1

            summary = result.get("summary") or {}
            suspicious_clusters = result.get("suspicious_clusters") or []
            suspicious_identifiers = result.get("suspicious_identifiers") or []
            top_connected_vendors = result.get("top_connected_vendors") or []
            network_findings = result.get("network_findings") or []

            portfolio["suspicious_clusters"] += int(
                summary.get("suspicious_clusters") or len(suspicious_clusters)
            )
            portfolio["suspicious_identifiers"] += int(
                summary.get("suspicious_identifiers") or len(suspicious_identifiers)
            )
            portfolio["network_findings"] += int(
                summary.get("network_findings") or len(network_findings)
            )

            results.append(
                {
                    "dataset_id": dataset.get("id"),
                    "dataset_name": dataset.get("dataset_name"),
                    "client_id": dataset.get("client_id"),
                    "current_analysis_id": current[0].get("id"),
                    "current_assessment_at": current[0].get("created_at"),
                    "supported": supported,
                    "summary": {
                        "total_nodes": summary.get("total_nodes", 0),
                        "total_edges": summary.get("total_edges", 0),
                        "vendor_nodes": summary.get("vendor_nodes", 0),
                        "identifier_nodes": summary.get("identifier_nodes", 0),
                        "connected_components": summary.get(
                            "connected_components",
                            0,
                        ),
                        "suspicious_clusters": summary.get(
                            "suspicious_clusters",
                            len(suspicious_clusters),
                        ),
                        "suspicious_identifiers": summary.get(
                            "suspicious_identifiers",
                            len(suspicious_identifiers),
                        ),
                        "network_findings": summary.get(
                            "network_findings",
                            len(network_findings),
                        ),
                        "graph_density": summary.get("graph_density", 0),
                    },
                    "top_clusters": [
                        {
                            "cluster_id": item.get("cluster_id"),
                            "vendor_count": item.get("vendor_count"),
                            "vendor_names": (item.get("vendor_names") or [])[:8],
                            "shared_identifiers": [
                                {
                                    "identifier_type": identifier.get(
                                        "identifier_type"
                                    ),
                                    "vendor_count": identifier.get(
                                        "vendor_count"
                                    ),
                                }
                                for identifier in (
                                    item.get("shared_identifiers") or []
                                )[:5]
                            ],
                            "cluster_score": item.get("cluster_score"),
                        }
                        for item in suspicious_clusters[:5]
                    ],
                    "top_shared_identifiers": [
                        {
                            "identifier_type": item.get("identifier_type"),
                            "vendor_count": item.get("vendor_count"),
                        }
                        for item in suspicious_identifiers[:8]
                    ],
                    "top_connected_vendors": [
                        {
                            "vendor_name": item.get("vendor_name"),
                            "vendor_id": item.get("vendor_id"),
                            "shared_relationships": item.get(
                                "shared_relationships"
                            ),
                            "network_score": item.get("network_score"),
                        }
                        for item in top_connected_vendors[:8]
                        if CopilotContextService._number(
                            item.get("network_score")
                        ) > 0
                    ],
                    "sample_network_findings": [
                        {
                            "transaction_id": item.get("transaction_id"),
                            "vendor_name": item.get("vendor_name")
                            or item.get("vendor_id"),
                            "network_score": item.get("network_score"),
                            "network_reasons": (
                                item.get("network_reasons") or []
                            )[:4],
                        }
                        for item in network_findings[:10]
                    ],
                }
            )

        selected_dataset_result = (
            results[0]
            if dataset_id
            and len(results) == 1
            else None
        )

        return {
            "scope": {
                "client_id": client_id,
                "dataset_id": dataset_id,
                "scope_type": (
                    "selected_dataset"
                    if dataset_id
                    else (
                        "selected_client"
                        if client_id
                        else "portfolio"
                    )
                ),
            },
            "datasets_analysed": len(results),
            "selected_dataset_result": selected_dataset_result,
            "portfolio_summary": portfolio,
            "network_results": results,
            "interpretation_note": (
                "Network indicators identify relationships requiring audit review. "
                "They do not by themselves establish fraud or wrongdoing."
            ),
        }

    @staticmethod
    def _clients(
        client_id: str | None,
    ) -> list[dict[str, Any]]:
        query = (
            supabase.table("clients")
            .select(
                "id, client_name, client_code, industry, client_status"
            )
        )

        if client_id:
            query = query.eq("id", client_id)

        return cast(
            list[dict[str, Any]],
            query.execute().data or [],
        )

    @staticmethod
    def _datasets(
        client_id: str | None,
        dataset_id: str | None,
    ) -> list[dict[str, Any]]:
        query = (
            supabase.table("datasets")
            .select(
                "id, client_id, dataset_name, file_type, file_path, "
                "total_records, total_columns, upload_status, upload_date"
            )
        )

        if client_id:
            query = query.eq("client_id", client_id)

        if dataset_id:
            query = query.eq("id", dataset_id)

        return cast(
            list[dict[str, Any]],
            query.execute().data or [],
        )

    @staticmethod
    def _findings(
        analysis_ids: list[str],
        transaction_id: str | None,
    ) -> list[dict[str, Any]]:
        findings: list[dict[str, Any]] = []

        for analysis_id in analysis_ids:
            query = (
                supabase.table("findings")
                .select(
                    "id, analysis_id, transaction_id, risk_score, risk_level, "
                    "anomaly_score, rule_score, network_score, reasons, "
                    "triggered_rules, anomaly_reasons, explanation, "
                    "detection_sources, created_at"
                )
                .eq("analysis_id", analysis_id)
            )

            if transaction_id:
                query = query.eq(
                    "transaction_id",
                    transaction_id,
                )

            findings.extend(
                cast(
                    list[dict[str, Any]],
                    query.execute().data or [],
                )
            )

        return findings

    @staticmethod
    def _finding_summary(
        item: dict[str, Any],
    ) -> dict[str, Any]:
        explanation = CopilotContextService._json_object(
            item.get("explanation")
        )

        return {
            "finding_id": item.get("id"),
            "analysis_id": item.get("analysis_id"),
            "transaction_id": item.get("transaction_id"),
            "risk_level": item.get("risk_level"),
            "risk_score": CopilotContextService._number(
                item.get("risk_score")
            ),
            "reasons": CopilotContextService._string_list(
                item.get("reasons")
            ),
            "triggered_audit_checks": CopilotContextService._string_list(
                item.get("triggered_rules")
            ),
            "unusual_behaviour_reasons": CopilotContextService._string_list(
                item.get("anomaly_reasons")
            ),
            "relationship_reasons": CopilotContextService._string_list(
                explanation.get("network_reasons")
            ),
        }

    @staticmethod
    def _string_list(
        value: Any,
    ) -> list[str]:
        if value is None:
            return []

        if isinstance(value, list):
            return [
                str(item).strip()
                for item in value
                if str(item).strip()
            ]

        if isinstance(value, str):
            text = value.strip()

            if not text:
                return []

            try:
                parsed = json.loads(text)

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
                for item in text.split("|")
                if item.strip()
            ]

        return [str(value).strip()]

    @staticmethod
    def _json_object(
        value: Any,
    ) -> dict[str, Any]:
        if isinstance(value, dict):
            return value

        if isinstance(value, str):
            try:
                parsed = json.loads(value)

                if isinstance(parsed, dict):
                    return parsed
            except json.JSONDecodeError:
                pass

        return {}

    @staticmethod
    def _number(
        value: Any,
    ) -> float:
        try:
            return round(float(value or 0), 4)
        except (TypeError, ValueError):
            return 0.0

    @staticmethod
    def _risk_rank(
        level: str,
    ) -> int:
        return {
            "Critical": 4,
            "High": 3,
            "Medium": 2,
            "Low": 1,
        }.get(level, 0)
