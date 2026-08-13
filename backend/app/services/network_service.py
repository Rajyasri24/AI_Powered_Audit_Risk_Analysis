from __future__ import annotations

from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, cast

import json
import math

import networkx as nx
import pandas as pd

from app.core.supabase_client import supabase
from app.services.dataset_storage_service import DatasetStorageService


class NetworkService:
    IDENTIFIER_COLUMN_GROUPS: dict[str, list[str]] = {
        "gst": [
            "gst",
            "gst_number",
            "gst_no",
            "vendor_gst",
            "supplier_gst",
            "gstin",
        ],
        "pan": [
            "pan",
            "pan_number",
            "pan_no",
            "vendor_pan",
            "supplier_pan",
        ],
        "bank_account": [
            "bank_account",
            "bank_account_number",
            "account_number",
            "account_no",
            "vendor_bank_account",
            "supplier_bank_account",
            "beneficiary_account",
        ],
        "phone": [
            "phone",
            "phone_number",
            "mobile",
            "mobile_number",
            "vendor_phone",
            "supplier_phone",
            "contact_number",
        ],
        "email": [
            "email",
            "email_id",
            "vendor_email",
            "supplier_email",
            "contact_email",
        ],
        "address": [
            "address",
            "vendor_address",
            "supplier_address",
            "registered_address",
            "billing_address",
        ],
    }

    VENDOR_ID_COLUMNS = [
        "vendor_id",
        "vendor_code",
        "supplier_id",
        "supplier_code",
        "party_id",
        "merchant",
        "merchant_id",
        "nameorig",
        "name_dest",
        "namedest",
    ]

    VENDOR_NAME_COLUMNS = [
        "vendor_name",
        "supplier_name",
        "party_name",
        "merchant_name",
        "beneficiary_name",
    ]

    TRANSACTION_ID_COLUMNS = [
        "transaction_id",
        "txn_id",
        "invoice_id",
        "invoice_number",
        "payment_id",
        "id",
    ]

    @staticmethod
    def normalize_column_name(value: Any) -> str:
        return (
            str(value)
            .strip()
            .lower()
            .replace(" ", "_")
            .replace("-", "_")
            .replace("/", "_")
        )

    @staticmethod
    def normalize_identifier(value: Any) -> str | None:
        if value is None:
            return None

        try:
            if pd.isna(value):
                return None
        except (TypeError, ValueError):
            pass

        normalized = str(value).strip().lower()

        if normalized in {"", "nan", "none", "null", "na", "n/a", "-"}:
            return None

        return normalized

    @staticmethod
    def safe_float(value: Any, default: float = 0.0) -> float:
        try:
            numeric_value = float(value)

            if math.isnan(numeric_value) or math.isinf(numeric_value):
                return default

            return numeric_value
        except (TypeError, ValueError):
            return default

    @staticmethod
    def find_column(
        dataframe: pd.DataFrame,
        possible_names: list[str],
    ) -> str | None:
        normalized_map = {
            NetworkService.normalize_column_name(column): str(column)
            for column in dataframe.columns
        }

        for possible_name in possible_names:
            normalized_name = NetworkService.normalize_column_name(
                possible_name
            )

            if normalized_name in normalized_map:
                return normalized_map[normalized_name]

        return None

    @staticmethod
    def read_dataset(
        file_path: str,
        file_type: str,
    ) -> pd.DataFrame:
        """
        Read the same durable dataset object used by AnalysisService.
        Legacy local file paths remain supported for backward compatibility.
        """
        try:
            return DatasetStorageService.read_dataframe(
                storage_reference=file_path,
                file_type=file_type,
            )
        except Exception as exc:
            # Network routes historically expose ValueError for dataset read
            # failures, so preserve that service contract.
            detail = getattr(exc, "detail", str(exc))
            raise ValueError(str(detail)) from exc

    @staticmethod
    def get_vendor_identity(
        row: dict[str, Any],
        row_index: Any,
        vendor_id_column: str | None,
        vendor_name_column: str | None,
    ) -> tuple[str, str]:
        vendor_id_value = (
            NetworkService.normalize_identifier(
                row.get(vendor_id_column)
            )
            if vendor_id_column
            else None
        )

        vendor_name_value = (
            NetworkService.normalize_identifier(
                row.get(vendor_name_column)
            )
            if vendor_name_column
            else None
        )

        vendor_id = (
            vendor_id_value
            or vendor_name_value
            or f"row_vendor_{row_index}"
        )

        vendor_name = (
            str(row.get(vendor_name_column)).strip()
            if vendor_name_column
            and row.get(vendor_name_column) is not None
            and not pd.isna(row.get(vendor_name_column))
            else vendor_id
        )

        return vendor_id, vendor_name

    @staticmethod
    def get_transaction_id(
        row: dict[str, Any],
        row_index: Any,
        transaction_id_column: str | None,
    ) -> str:
        if transaction_id_column:
            value = row.get(transaction_id_column)

            if value is not None:
                try:
                    if not pd.isna(value):
                        return str(value)
                except (TypeError, ValueError):
                    return str(value)

        return str(row_index)

    @staticmethod
    def resolve_columns(
        dataframe: pd.DataFrame,
    ) -> dict[str, Any]:
        vendor_id_column = NetworkService.find_column(
            dataframe,
            NetworkService.VENDOR_ID_COLUMNS,
        )

        vendor_name_column = NetworkService.find_column(
            dataframe,
            NetworkService.VENDOR_NAME_COLUMNS,
        )

        transaction_id_column = NetworkService.find_column(
            dataframe,
            NetworkService.TRANSACTION_ID_COLUMNS,
        )

        identifier_columns: dict[str, str] = {}

        for identifier_type, possible_names in (
            NetworkService.IDENTIFIER_COLUMN_GROUPS.items()
        ):
            matched_column = NetworkService.find_column(
                dataframe,
                possible_names,
            )

            if matched_column:
                identifier_columns[identifier_type] = matched_column

        return {
            "vendor_id_column": vendor_id_column,
            "vendor_name_column": vendor_name_column,
            "transaction_id_column": transaction_id_column,
            "identifier_columns": identifier_columns,
        }

    @staticmethod
    def build_graph(
        dataframe: pd.DataFrame,
    ) -> dict[str, Any]:
        columns = NetworkService.resolve_columns(dataframe)

        vendor_id_column = cast(
            str | None,
            columns["vendor_id_column"],
        )
        vendor_name_column = cast(
            str | None,
            columns["vendor_name_column"],
        )
        transaction_id_column = cast(
            str | None,
            columns["transaction_id_column"],
        )
        identifier_columns = cast(
            dict[str, str],
            columns["identifier_columns"],
        )

        if not identifier_columns:
            return {
                "graph": nx.Graph(),
                "vendor_transactions": {},
                "vendor_names": {},
                "vendor_identifiers": {},
                "identifier_vendors": {},
                "columns": columns,
            }

        graph = nx.Graph()

        vendor_transactions: dict[str, list[str]] = defaultdict(list)
        vendor_names: dict[str, str] = {}
        vendor_identifiers: dict[
            str,
            list[dict[str, str]],
        ] = defaultdict(list)
        identifier_vendors: dict[
            str,
            set[str],
        ] = defaultdict(set)

        for row_index, row_series in dataframe.iterrows():
            row = dict(row_series)

            vendor_id, vendor_name = NetworkService.get_vendor_identity(
                row=row,
                row_index=row_index,
                vendor_id_column=vendor_id_column,
                vendor_name_column=vendor_name_column,
            )

            transaction_id = NetworkService.get_transaction_id(
                row=row,
                row_index=row_index,
                transaction_id_column=transaction_id_column,
            )

            vendor_node = f"vendor::{vendor_id}"

            graph.add_node(
                vendor_node,
                node_type="vendor",
                vendor_id=vendor_id,
                label=vendor_name,
            )

            vendor_names[vendor_id] = vendor_name
            vendor_transactions[vendor_id].append(transaction_id)

            for identifier_type, source_column in (
                identifier_columns.items()
            ):
                normalized_value = (
                    NetworkService.normalize_identifier(
                        row.get(source_column)
                    )
                )

                if not normalized_value:
                    continue

                identifier_key = (
                    f"{identifier_type}::{normalized_value}"
                )

                graph.add_node(
                    identifier_key,
                    node_type="identifier",
                    identifier_type=identifier_type,
                    identifier_value=normalized_value,
                    label=f"{identifier_type}: {normalized_value}",
                )

                graph.add_edge(
                    vendor_node,
                    identifier_key,
                    relationship=identifier_type,
                )

                identifier_vendors[identifier_key].add(vendor_id)

                existing_identifiers = vendor_identifiers[vendor_id]

                identifier_record = {
                    "identifier_type": identifier_type,
                    "identifier_value": normalized_value,
                    "source_column": source_column,
                    "identifier_key": identifier_key,
                }

                if identifier_record not in existing_identifiers:
                    existing_identifiers.append(identifier_record)

        return {
            "graph": graph,
            "vendor_transactions": dict(vendor_transactions),
            "vendor_names": vendor_names,
            "vendor_identifiers": dict(vendor_identifiers),
            "identifier_vendors": {
                key: sorted(list(vendors))
                for key, vendors in identifier_vendors.items()
            },
            "columns": columns,
        }

    @staticmethod
    def identifier_risk_weight(identifier_type: str) -> int:
        weights = {
            "bank_account": 12,
            "gst": 10,
            "pan": 10,
            "phone": 7,
            "email": 7,
            "address": 5,
        }

        return weights.get(identifier_type, 5)

    @staticmethod
    def calculate_vendor_network_score(
        vendor_id: str,
        vendor_identifiers: dict[
            str,
            list[dict[str, str]],
        ],
        identifier_vendors: dict[str, list[str]],
    ) -> tuple[int, list[str]]:
        score = 0
        reasons: list[str] = []

        for identifier in vendor_identifiers.get(vendor_id, []):
            identifier_key = identifier["identifier_key"]
            identifier_type = identifier["identifier_type"]
            identifier_value = identifier["identifier_value"]

            connected_vendors = identifier_vendors.get(
                identifier_key,
                [],
            )

            shared_vendor_count = len(connected_vendors)

            if shared_vendor_count <= 1:
                continue

            base_weight = NetworkService.identifier_risk_weight(
                identifier_type
            )

            additional_vendor_weight = min(
                (shared_vendor_count - 2) * 2,
                8,
            )

            identifier_score = (
                base_weight + additional_vendor_weight
            )

            score += identifier_score

            display_type = identifier_type.replace("_", " ").title()

            reasons.append(
                f"{display_type} '{identifier_value}' is shared "
                f"with {shared_vendor_count} vendors."
            )

        return min(score, 40), reasons

    @staticmethod
    def analyse_dataframe(
        dataframe: pd.DataFrame,
    ) -> dict[str, Any]:
        graph_data = NetworkService.build_graph(dataframe)

        graph = cast(nx.Graph, graph_data["graph"])
        vendor_transactions = cast(
            dict[str, list[str]],
            graph_data["vendor_transactions"],
        )
        vendor_names = cast(
            dict[str, str],
            graph_data["vendor_names"],
        )
        vendor_identifiers = cast(
            dict[str, list[dict[str, str]]],
            graph_data["vendor_identifiers"],
        )
        identifier_vendors = cast(
            dict[str, list[str]],
            graph_data["identifier_vendors"],
        )
        columns = cast(
            dict[str, Any],
            graph_data["columns"],
        )

        vendor_nodes = [
            node
            for node, attributes in graph.nodes(data=True)
            if attributes.get("node_type") == "vendor"
        ]

        identifier_nodes = [
            node
            for node, attributes in graph.nodes(data=True)
            if attributes.get("node_type") == "identifier"
        ]

        suspicious_identifiers: list[dict[str, Any]] = []

        for identifier_key, vendors in identifier_vendors.items():
            if len(vendors) <= 1:
                continue

            node_data = graph.nodes.get(identifier_key, {})

            suspicious_identifiers.append(
                {
                    "identifier_key": identifier_key,
                    "identifier_type": node_data.get(
                        "identifier_type"
                    ),
                    "identifier_value": node_data.get(
                        "identifier_value"
                    ),
                    "vendor_count": len(vendors),
                    "vendor_ids": vendors,
                }
            )

        suspicious_identifiers.sort(
            key=lambda item: item["vendor_count"],
            reverse=True,
        )

        suspicious_clusters: list[dict[str, Any]] = []

        for component_index, component in enumerate(
            nx.connected_components(graph),
            start=1,
        ):
            component_vendor_ids: list[str] = []
            component_identifiers: list[dict[str, Any]] = []

            for node in component:
                node_data = graph.nodes[node]

                if node_data.get("node_type") == "vendor":
                    component_vendor_ids.append(
                        str(node_data.get("vendor_id"))
                    )
                elif node_data.get("node_type") == "identifier":
                    connected_vendor_ids = identifier_vendors.get(
                        node,
                        [],
                    )

                    if len(connected_vendor_ids) > 1:
                        component_identifiers.append(
                            {
                                "identifier_type": node_data.get(
                                    "identifier_type"
                                ),
                                "identifier_value": node_data.get(
                                    "identifier_value"
                                ),
                                "vendor_count": len(
                                    connected_vendor_ids
                                ),
                            }
                        )

            if (
                len(component_vendor_ids) > 1
                and component_identifiers
            ):
                cluster_score = min(
                    20
                    + (len(component_vendor_ids) - 2) * 5
                    + len(component_identifiers) * 3,
                    100,
                )

                suspicious_clusters.append(
                    {
                        "cluster_id": f"CLUSTER-{component_index}",
                        "vendor_count": len(component_vendor_ids),
                        "vendor_ids": component_vendor_ids,
                        "vendor_names": [
                            vendor_names.get(
                                vendor_id,
                                vendor_id,
                            )
                            for vendor_id in component_vendor_ids
                        ],
                        "shared_identifiers": (
                            component_identifiers
                        ),
                        "cluster_score": cluster_score,
                    }
                )

        suspicious_clusters.sort(
            key=lambda item: (
                item["cluster_score"],
                item["vendor_count"],
            ),
            reverse=True,
        )

        network_findings: list[dict[str, Any]] = []
        vendor_scores: dict[str, int] = {}

        for vendor_id, transactions in (
            vendor_transactions.items()
        ):
            network_score, reasons = (
                NetworkService.calculate_vendor_network_score(
                    vendor_id=vendor_id,
                    vendor_identifiers=vendor_identifiers,
                    identifier_vendors=identifier_vendors,
                )
            )

            vendor_scores[vendor_id] = network_score

            if network_score <= 0:
                continue

            for transaction_id in transactions:
                network_findings.append(
                    {
                        "transaction_id": str(transaction_id),
                        "vendor_id": vendor_id,
                        "vendor_name": vendor_names.get(
                            vendor_id,
                            vendor_id,
                        ),
                        "network_score": network_score,
                        "network_reasons": reasons,
                        "detection_sources": ["NETWORK"],
                    }
                )

        degree_centrality: dict[str, float] = {}

        if graph.number_of_nodes() > 1:
            degree_centrality = nx.degree_centrality(graph)

        top_connected_vendors: list[dict[str, Any]] = []

        for vendor_node in vendor_nodes:
            node_data = graph.nodes[vendor_node]
            vendor_id = str(node_data.get("vendor_id"))

            shared_relationships = 0

            for neighbour in graph.neighbors(vendor_node):
                if len(identifier_vendors.get(neighbour, [])) > 1:
                    shared_relationships += 1

            top_connected_vendors.append(
                {
                    "vendor_id": vendor_id,
                    "vendor_name": vendor_names.get(
                        vendor_id,
                        vendor_id,
                    ),
                    "degree": int(graph.degree(vendor_node)),
                    "shared_relationships": (
                        shared_relationships
                    ),
                    "centrality": round(
                        degree_centrality.get(vendor_node, 0.0),
                        4,
                    ),
                    "network_score": vendor_scores.get(
                        vendor_id,
                        0,
                    ),
                }
            )

        top_connected_vendors.sort(
            key=lambda item: (
                item["network_score"],
                item["shared_relationships"],
                item["degree"],
            ),
            reverse=True,
        )

        identifier_type_counts = Counter(
            str(item["identifier_type"])
            for item in suspicious_identifiers
        )

        graph_nodes: list[dict[str, Any]] = []

        for node, attributes in graph.nodes(data=True):
            graph_nodes.append(
                {
                    "id": node,
                    "label": attributes.get("label", node),
                    "node_type": attributes.get("node_type"),
                    "vendor_id": attributes.get("vendor_id"),
                    "identifier_type": attributes.get(
                        "identifier_type"
                    ),
                    "identifier_value": attributes.get(
                        "identifier_value"
                    ),
                    "degree": int(graph.degree(node)),
                }
            )

        graph_edges: list[dict[str, Any]] = []

        for source, target, attributes in graph.edges(data=True):
            graph_edges.append(
                {
                    "source": source,
                    "target": target,
                    "relationship": attributes.get(
                        "relationship"
                    ),
                }
            )

        graph_density = (
            nx.density(graph)
            if graph.number_of_nodes() > 1
            else 0.0
        )

        connected_components = (
            nx.number_connected_components(graph)
            if graph.number_of_nodes() > 0
            else 0
        )

        return {
            "supported": bool(
                columns.get("identifier_columns")
            ),
            "columns_detected": columns,
            "summary": {
                "total_nodes": graph.number_of_nodes(),
                "total_edges": graph.number_of_edges(),
                "vendor_nodes": len(vendor_nodes),
                "identifier_nodes": len(identifier_nodes),
                "connected_components": connected_components,
                "suspicious_clusters": len(
                    suspicious_clusters
                ),
                "suspicious_identifiers": len(
                    suspicious_identifiers
                ),
                "network_findings": len(network_findings),
                "graph_density": round(graph_density, 6),
                "identifier_type_counts": dict(
                    identifier_type_counts
                ),
            },
            "suspicious_clusters": suspicious_clusters,
            "suspicious_identifiers": (
                suspicious_identifiers
            ),
            "top_connected_vendors": (
                top_connected_vendors[:20]
            ),
            "network_findings": network_findings,
            "graph": {
                "nodes": graph_nodes,
                "edges": graph_edges,
            },
        }

    @staticmethod
    def analyse_dataset(dataset_id: str) -> dict[str, Any]:
        dataset_response = (
            supabase
            .table("datasets")
            .select("*, clients(*)")
            .eq("id", dataset_id)
            .execute()
        )

        if not dataset_response.data:
            raise ValueError("Dataset not found.")

        dataset = cast(
            dict[str, Any],
            dataset_response.data[0],
        )

        file_path_value = dataset.get("file_path")
        file_type_value = dataset.get("file_type")

        if not isinstance(file_path_value, str):
            raise ValueError(
                "Dataset file path is missing or invalid."
            )

        if not isinstance(file_type_value, str):
            raise ValueError(
                "Dataset file type is missing or invalid."
            )

        dataframe = NetworkService.read_dataset(
            file_path=file_path_value,
            file_type=file_type_value,
        )

        result = NetworkService.analyse_dataframe(dataframe)

        result["dataset"] = {
            "id": dataset.get("id"),
            "dataset_name": dataset.get("dataset_name"),
            "client_id": dataset.get("client_id"),
            "file_type": dataset.get("file_type"),
            "total_records": dataset.get("total_records"),
            "total_columns": dataset.get("total_columns"),
            "clients": dataset.get("clients"),
        }

        return result

    @staticmethod
    def get_available_datasets() -> list[dict[str, Any]]:
        response = (
            supabase
            .table("datasets")
            .select("*, clients(*)")
            .order("upload_date", desc=True)
            .execute()
        )

        return cast(
            list[dict[str, Any]],
            response.data or [],
        )