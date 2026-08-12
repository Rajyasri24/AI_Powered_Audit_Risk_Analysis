import json
from io import StringIO
from pathlib import Path
from typing import Any, cast

import pandas as pd
from fastapi import HTTPException

from app.core.supabase_client import supabase
from app.services.ml_service import MLService
from app.services.network_service import NetworkService
from app.services.rule_engine_service import RuleEngineService


def read_csv_safely(
    file_path: Path,
) -> pd.DataFrame:
    try:
        dataframe = pd.read_csv(
            file_path,
            encoding="utf-8-sig",
        )
    except Exception:
        dataframe = pd.read_csv(
            file_path,
            sep=None,
            engine="python",
            encoding="utf-8-sig",
        )

    if len(dataframe.columns) > 1:
        return dataframe

    first_column = str(
        dataframe.columns[0]
    )

    if "," not in first_column:
        return dataframe

    raw_text = file_path.read_text(
        encoding="utf-8-sig",
    )

    repaired_lines: list[str] = []

    for raw_line in raw_text.splitlines():
        line = raw_line.strip()

        if (
            len(line) >= 2
            and line.startswith('"')
            and line.endswith('"')
        ):
            line = line[1:-1].replace(
                '""',
                '"',
            )

        repaired_lines.append(line)

    repaired_dataframe = pd.read_csv(
        StringIO(
            "\n".join(repaired_lines)
        ),
        sep=",",
    )

    if len(repaired_dataframe.columns) <= 1:
        raise HTTPException(
            status_code=400,
            detail=(
                "CSV structure could not be parsed. "
                "Please export using comma-separated columns."
            ),
        )

    return repaired_dataframe


class AnalysisService:

    @staticmethod
    def read_dataset(
        file_path: str,
        file_type: str,
    ) -> pd.DataFrame:
        path = Path(file_path)

        if not path.exists():
            raise HTTPException(
                status_code=404,
                detail=(
                    "Uploaded dataset file "
                    "was not found."
                ),
            )

        normalized_file_type = (
            file_type.strip().lower()
        )

        if normalized_file_type == "csv":
            return read_csv_safely(path)

        if normalized_file_type == "xlsx":
            return pd.read_excel(path)

        if normalized_file_type == "json":
            with open(
                path,
                "r",
                encoding="utf-8-sig",
            ) as file:
                data = json.load(file)

            if isinstance(data, dict):
                if isinstance(
                    data.get("data"),
                    list,
                ):
                    data = data["data"]

                elif isinstance(
                    data.get("transactions"),
                    list,
                ):
                    data = data[
                        "transactions"
                    ]

                else:
                    data = [data]

            if not isinstance(data, list):
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "JSON dataset must "
                        "contain a list of records."
                    ),
                )

            return pd.DataFrame(data)

        raise HTTPException(
            status_code=400,
            detail=(
                "Unsupported dataset type."
            ),
        )

    @staticmethod
    def calculate_risk_level(
        score: float,
    ) -> str:
        if score <= 20:
            return "Low"

        if score <= 50:
            return "Medium"

        if score <= 75:
            return "High"

        return "Critical"

    @staticmethod
    def normalize_transaction_id(
        value: Any,
    ) -> str:
        normalized = str(value).strip()

        if normalized.endswith(".0"):
            prefix = normalized[:-2]

            if prefix.isdigit():
                normalized = prefix

        return normalized

    @staticmethod
    def create_empty_finding(
        transaction_id: str,
    ) -> dict[str, Any]:
        return {
            "transaction_id": transaction_id,
            "rule_score": 0.0,
            "anomaly_score": 0.0,
            "network_score": 0.0,
            "triggered_rules": [],
            "anomaly_reasons": [],
            "network_reasons": [],
            "detection_sources": [],
            "reasons": [],
        }

    @staticmethod
    def merge_rule_ml_network_findings(
        rule_findings: list[
            dict[str, Any]
        ],
        ml_findings: list[
            dict[str, Any]
        ],
        network_findings: list[
            dict[str, Any]
        ],
    ) -> list[dict[str, Any]]:
        merged: dict[
            str,
            dict[str, Any],
        ] = {}

        for finding in rule_findings:
            transaction_id = (
                AnalysisService
                .normalize_transaction_id(
                    finding.get(
                        "transaction_id",
                        "",
                    )
                )
            )

            if not transaction_id:
                continue

            if transaction_id not in merged:
                merged[transaction_id] = (
                    AnalysisService
                    .create_empty_finding(
                        transaction_id
                    )
                )

            merged_item = merged[
                transaction_id
            ]

            merged_item[
                "rule_score"
            ] += float(
                finding.get(
                    "rule_score"
                ) or 0
            )

            triggered_rules = (
                finding.get(
                    "triggered_rules"
                )
                or []
            )

            if isinstance(
                triggered_rules,
                list,
            ):
                merged_item[
                    "triggered_rules"
                ].extend(
                    triggered_rules
                )

            rule_reason = str(
                finding.get("reasons")
                or "Audit rule triggered."
            ).strip()

            if rule_reason:
                merged_item[
                    "reasons"
                ].append(rule_reason)

            merged_item[
                "detection_sources"
            ].append("RULE")

        for anomaly in ml_findings:
            transaction_id = (
                AnalysisService
                .normalize_transaction_id(
                    anomaly.get(
                        "transaction_id",
                        "",
                    )
                )
            )

            if not transaction_id:
                continue

            if transaction_id not in merged:
                merged[transaction_id] = (
                    AnalysisService
                    .create_empty_finding(
                        transaction_id
                    )
                )

            merged_item = merged[
                transaction_id
            ]

            merged_item[
                "anomaly_score"
            ] += float(
                anomaly.get(
                    "anomaly_score"
                ) or 0
            )

            anomaly_reasons = (
                anomaly.get(
                    "anomaly_reasons"
                )
                or []
            )

            if isinstance(
                anomaly_reasons,
                list,
            ):
                normalized_reasons = [
                    str(reason).strip()
                    for reason
                    in anomaly_reasons
                    if str(reason).strip()
                ]

                merged_item[
                    "anomaly_reasons"
                ].extend(
                    normalized_reasons
                )

                merged_item[
                    "reasons"
                ].extend(
                    normalized_reasons
                )

            merged_item[
                "detection_sources"
            ].append("ML")

        for network_finding in (
            network_findings
        ):
            transaction_id = (
                AnalysisService
                .normalize_transaction_id(
                    network_finding.get(
                        "transaction_id",
                        "",
                    )
                )
            )

            if not transaction_id:
                continue

            if transaction_id not in merged:
                merged[transaction_id] = (
                    AnalysisService
                    .create_empty_finding(
                        transaction_id
                    )
                )

            merged_item = merged[
                transaction_id
            ]

            network_score = float(
                network_finding.get(
                    "network_score"
                ) or 0
            )

            merged_item[
                "network_score"
            ] = max(
                float(
                    merged_item[
                        "network_score"
                    ]
                ),
                network_score,
            )

            network_reasons = (
                network_finding.get(
                    "network_reasons"
                )
                or []
            )

            if isinstance(
                network_reasons,
                list,
            ):
                normalized_reasons = [
                    str(reason).strip()
                    for reason
                    in network_reasons
                    if str(reason).strip()
                ]

                merged_item[
                    "network_reasons"
                ].extend(
                    normalized_reasons
                )

                merged_item[
                    "reasons"
                ].extend(
                    normalized_reasons
                )

            merged_item[
                "detection_sources"
            ].append("NETWORK")

        final_findings: list[
            dict[str, Any]
        ] = []

        for item in merged.values():
            rule_score = float(
                item["rule_score"]
            )

            anomaly_score = float(
                item["anomaly_score"]
            )

            network_score = float(
                item["network_score"]
            )

            # Round component values first so the displayed components and
            # displayed final score always reconcile exactly.
            rule_score = round(rule_score, 4)
            anomaly_score = round(anomaly_score, 4)
            network_score = round(network_score, 4)
            risk_score = round(
                rule_score + anomaly_score + network_score,
                4,
            )

            triggered_rules = list(
                dict.fromkeys(
                    str(rule)
                    for rule
                    in item[
                        "triggered_rules"
                    ]
                    if str(rule).strip()
                )
            )

            anomaly_reasons = list(
                dict.fromkeys(
                    str(reason)
                    for reason
                    in item[
                        "anomaly_reasons"
                    ]
                    if str(reason).strip()
                )
            )

            network_reasons = list(
                dict.fromkeys(
                    str(reason)
                    for reason
                    in item[
                        "network_reasons"
                    ]
                    if str(reason).strip()
                )
            )

            reasons = list(
                dict.fromkeys(
                    str(reason)
                    for reason
                    in item["reasons"]
                    if str(reason).strip()
                )
            )

            detection_sources = list(
                dict.fromkeys(
                    str(source)
                    for source
                    in item[
                        "detection_sources"
                    ]
                    if str(source).strip()
                )
            )

            explanation = {
                "summary": (
                    "Transaction flagged by "
                    "the audit risk analysis engine."
                ),
                "rule_score": rule_score,
                "anomaly_score": (
                    anomaly_score
                ),
                "network_score": (
                    network_score
                ),
                "risk_score": risk_score,
                "triggered_rules": (
                    triggered_rules
                ),
                "anomaly_reasons": (
                    anomaly_reasons
                ),
                "network_reasons": (
                    network_reasons
                ),
                "detection_sources": (
                    detection_sources
                ),
                "reasons": reasons,
            }

            final_findings.append(
                {
                    "transaction_id": (
                        item[
                            "transaction_id"
                        ]
                    ),
                    "rule_score": round(
                        rule_score,
                        4,
                    ),
                    "anomaly_score": round(
                        anomaly_score,
                        4,
                    ),
                    "network_score": round(
                        network_score,
                        4,
                    ),
                    "risk_score": round(
                        risk_score,
                        4,
                    ),
                    "risk_level": (
                        AnalysisService
                        .calculate_risk_level(
                            risk_score
                        )
                    ),
                    "triggered_rules": (
                        triggered_rules
                    ),
                    "anomaly_reasons": (
                        anomaly_reasons
                    ),
                    "detection_sources": (
                        detection_sources
                    ),
                    "reasons": (
                        " | ".join(reasons)
                    ),
                    "explanation": (
                        explanation
                    ),
                }
            )

        final_findings.sort(
            key=lambda finding: float(
                finding.get(
                    "risk_score"
                ) or 0
            ),
            reverse=True,
        )

        return final_findings

    @staticmethod
    def get_all_analyses():
        """
        Return the CURRENT completed assessment for each dataset.

        Older executions remain stored in Supabase for traceability but are not
        presented to the auditor as separate business results.
        """
        response = (
            supabase
            .table("analyses")
            .select(
                "*, datasets(*, clients(*))"
            )
            .order(
                "created_at",
                desc=True,
            )
            .execute()
        )

        rows = cast(
            list[dict[str, Any]],
            response.data or [],
        )

        latest_by_dataset: dict[
            str,
            dict[str, Any],
        ] = {}

        for item in rows:
            if str(
                item.get(
                    "analysis_status"
                )
                or ""
            ).upper() != "COMPLETED":
                continue

            dataset_id = str(
                item.get(
                    "dataset_id"
                )
                or ""
            )

            if not dataset_id:
                continue

            if dataset_id not in latest_by_dataset:
                current = dict(item)
                current[
                    "display_status"
                ] = "CURRENT"
                current[
                    "assessment_label"
                ] = "Current Assessment"
                latest_by_dataset[
                    dataset_id
                ] = current

        return list(
            latest_by_dataset.values()
        )

    @staticmethod
    def run_analysis(
        dataset_id: str,
    ):
        dataset_response = (
            supabase
            .table("datasets")
            .select("*")
            .eq("id", dataset_id)
            .execute()
        )

        if not dataset_response.data:
            raise HTTPException(
                status_code=404,
                detail="Dataset not found.",
            )

        dataset = cast(
            dict[str, Any],
            dataset_response.data[0],
        )

        client_id_value = dataset.get(
            "client_id"
        )

        file_path_value = dataset.get(
            "file_path"
        )

        file_type_value = dataset.get(
            "file_type"
        )

        if not isinstance(
            client_id_value,
            str,
        ):
            raise HTTPException(
                status_code=400,
                detail=(
                    "Dataset client ID "
                    "is missing."
                ),
            )

        if not isinstance(
            file_path_value,
            str,
        ):
            raise HTTPException(
                status_code=400,
                detail=(
                    "Dataset file path "
                    "is missing."
                ),
            )

        if not isinstance(
            file_type_value,
            str,
        ):
            raise HTTPException(
                status_code=400,
                detail=(
                    "Dataset file type "
                    "is missing."
                ),
            )

        client_id = client_id_value
        file_path = file_path_value
        file_type = file_type_value

        dataframe = (
            AnalysisService.read_dataset(
                file_path,
                file_type,
            )
        )

        if dataframe.empty:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Dataset contains "
                    "no records."
                ),
            )

        analysis_response = (
            supabase
            .table("analyses")
            .insert(
                {
                    "dataset_id": dataset_id,
                    "client_id": client_id,
                    "analysis_status": (
                        "RUNNING"
                    ),
                    "total_transactions": (
                        len(dataframe)
                    ),
                    "high_risk_count": 0,
                    "medium_risk_count": 0,
                    "low_risk_count": 0,
                }
            )
            .execute()
        )

        if not analysis_response.data:
            raise HTTPException(
                status_code=500,
                detail=(
                    "Failed to create "
                    "analysis record."
                ),
            )

        analysis = cast(
            dict[str, Any],
            analysis_response.data[0],
        )

        analysis_id_value = (
            analysis.get("id")
        )

        if not isinstance(
            analysis_id_value,
            str,
        ):
            raise HTTPException(
                status_code=500,
                detail=(
                    "Analysis ID was "
                    "not returned."
                ),
            )

        analysis_id = analysis_id_value

        try:
            client_rules_response = (
                supabase
                .table("client_rules")
                .select("*, rules(*)")
                .eq(
                    "client_id",
                    client_id,
                )
                .eq("enabled", True)
                .execute()
            )

            client_rules = cast(
                list[dict[str, Any]],
                (
                    client_rules_response
                    .data
                    or []
                ),
            )

            rule_findings = (
                RuleEngineService.apply_rules(
                    dataframe,
                    client_rules,
                )
            )

            ml_findings = (
                MLService.detect_anomalies(
                    dataframe
                )
            )

            network_result = (
                NetworkService
                .analyse_dataframe(
                    dataframe
                )
            )

            network_findings = cast(
                list[dict[str, Any]],
                (
                    network_result.get(
                        "network_findings"
                    )
                    or []
                ),
            )

            final_findings = (
                AnalysisService
                .merge_rule_ml_network_findings(
                    rule_findings=(
                        rule_findings
                    ),
                    ml_findings=(
                        ml_findings
                    ),
                    network_findings=(
                        network_findings
                    ),
                )
            )

            findings_payload: list[
                dict[str, Any]
            ] = []

            for finding in final_findings:
                findings_payload.append(
                    {
                        **finding,
                        "analysis_id": (
                            analysis_id
                        ),
                    }
                )

            if findings_payload:
                findings_insert_response = (
                    supabase
                    .table("findings")
                    .insert(
                        findings_payload
                    )
                    .execute()
                )

                if (
                    not
                    findings_insert_response
                    .data
                ):
                    raise HTTPException(
                        status_code=500,
                        detail=(
                            "Failed to store "
                            "analysis findings."
                        ),
                    )

            low_count = sum(
                1
                for finding
                in final_findings
                if finding[
                    "risk_level"
                ] == "Low"
            )

            medium_count = sum(
                1
                for finding
                in final_findings
                if finding[
                    "risk_level"
                ] == "Medium"
            )

            high_count = sum(
                1
                for finding
                in final_findings
                if finding[
                    "risk_level"
                ] in [
                    "High",
                    "Critical",
                ]
            )

            network_finding_count = sum(
                1
                for finding
                in final_findings
                if "NETWORK"
                in (
                    finding.get(
                        "detection_sources"
                    )
                    or []
                )
            )

            completed_response = (
                supabase
                .table("analyses")
                .update(
                    {
                        "analysis_status": (
                            "COMPLETED"
                        ),
                        "low_risk_count": (
                            low_count
                        ),
                        "medium_risk_count": (
                            medium_count
                        ),
                        "high_risk_count": (
                            high_count
                        ),
                    }
                )
                .eq("id", analysis_id)
                .execute()
            )

            if not completed_response.data:
                raise HTTPException(
                    status_code=500,
                    detail=(
                        "Failed to complete "
                        "analysis record."
                    ),
                )

            network_summary = cast(
                dict[str, Any],
                (
                    network_result.get(
                        "summary"
                    )
                    or {}
                ),
            )

            return {
                "analysis_id": analysis_id,
                "dataset_id": dataset_id,
                "client_id": client_id,
                "total_transactions": (
                    len(dataframe)
                ),
                "rule_findings_count": (
                    len(rule_findings)
                ),
                "ml_findings_count": (
                    len(ml_findings)
                ),
                "network_findings_count": (
                    network_finding_count
                ),
                "findings_count": (
                    len(final_findings)
                ),
                "low_risk_count": (
                    low_count
                ),
                "medium_risk_count": (
                    medium_count
                ),
                "high_risk_count": (
                    high_count
                ),
                "network_supported": bool(
                    network_result.get(
                        "supported"
                    )
                ),
                "network_summary": (
                    network_summary
                ),
                "columns_detected": (
                    network_result.get(
                        "columns_detected"
                    )
                ),
                "findings_preview": (
                    final_findings[:10]
                ),
            }

        except Exception:
            (
                supabase
                .table("analyses")
                .update(
                    {
                        "analysis_status": (
                            "FAILED"
                        ),
                    }
                )
                .eq("id", analysis_id)
                .execute()
            )

            raise
