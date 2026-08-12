from __future__ import annotations

import random
from typing import Any

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.neighbors import LocalOutlierFactor
from sklearn.preprocessing import StandardScaler


class MLService:
    """
    Deterministic anomaly-detection service.

    Re-running the SAME dataset with the SAME application configuration will
    produce the same anomaly flags, scores and reasons.

    Important:
    - transaction/fraud-label columns are excluded from model features;
    - feature columns are sorted to guarantee stable feature ordering;
    - Isolation Forest uses a fixed random_state and single-thread execution;
    - LOF uses deterministic brute-force neighbour search and single-thread
      execution.
    """

    RANDOM_STATE = 42
    CONTAMINATION = 0.20
    MAX_LOF_NEIGHBORS = 5

    TRANSACTION_ID_CANDIDATES = {
        "transaction_id",
        "txn_id",
        "invoice_id",
        "id",
    }

    LABEL_COLUMNS = {
        "isfraud",
        "isflaggedfraud",
        "fraud",
        "fraud_flag",
        "target",
        "label",
        "class",
    }

    @staticmethod
    def get_transaction_id_column(
        dataframe: pd.DataFrame,
    ) -> str | None:
        lower_map = {
            str(column).lower(): str(column)
            for column in dataframe.columns
        }

        for candidate in [
            "transaction_id",
            "txn_id",
            "invoice_id",
            "id",
        ]:
            if candidate in lower_map:
                return lower_map[candidate]

        return None

    @staticmethod
    def _prepare_numeric_features(
        dataframe: pd.DataFrame,
    ) -> pd.DataFrame:
        numeric_dataframe = (
            dataframe
            .select_dtypes(
                include=["number"]
            )
            .copy()
        )

        columns_to_exclude: list[str] = []

        for column in numeric_dataframe.columns:
            normalized = str(
                column
            ).strip().lower()

            if (
                normalized
                in MLService.LABEL_COLUMNS
                or normalized
                in MLService.TRANSACTION_ID_CANDIDATES
            ):
                columns_to_exclude.append(
                    column
                )

        numeric_dataframe = (
            numeric_dataframe.drop(
                columns=columns_to_exclude,
                errors="ignore",
            )
        )

        if numeric_dataframe.empty:
            return numeric_dataframe

        # Stable feature ordering is important for reproducibility.
        numeric_dataframe = (
            numeric_dataframe.reindex(
                sorted(
                    numeric_dataframe.columns,
                    key=lambda item: str(
                        item
                    ).lower(),
                ),
                axis=1,
            )
        )

        numeric_dataframe = (
            numeric_dataframe.replace(
                [np.inf, -np.inf],
                np.nan,
            )
        )

        # Preserve existing project behaviour: missing numeric values become 0.
        numeric_dataframe = (
            numeric_dataframe.fillna(0)
        )

        return numeric_dataframe

    @staticmethod
    def generate_anomaly_reasons(
        row: dict[str, Any],
        dataframe: pd.DataFrame,
    ) -> list[str]:
        reasons: list[str] = []

        amount_columns = [
            column
            for column in dataframe.columns
            if (
                "amount"
                in str(
                    column
                ).lower()
                or "value"
                in str(
                    column
                ).lower()
                or "payment"
                in str(
                    column
                ).lower()
            )
        ]

        vendor_columns = [
            column
            for column in dataframe.columns
            if (
                "vendor"
                in str(
                    column
                ).lower()
                or "supplier"
                in str(
                    column
                ).lower()
                or str(
                    column
                ).lower()
                in {
                    "nameorig",
                    "namedest",
                }
            )
        ]

        # Sort candidates so the same logical column is chosen every time.
        amount_columns = sorted(
            amount_columns,
            key=lambda item: str(
                item
            ).lower(),
        )
        vendor_columns = sorted(
            vendor_columns,
            key=lambda item: str(
                item
            ).lower(),
        )

        if amount_columns:
            amount_col = (
                amount_columns[0]
            )

            amount = pd.to_numeric(
                row.get(
                    amount_col
                ),
                errors="coerce",
            )

            dataset_median = (
                pd.to_numeric(
                    dataframe[
                        amount_col
                    ],
                    errors="coerce",
                )
                .median()
            )

            if (
                pd.notna(
                    amount
                )
                and pd.notna(
                    dataset_median
                )
                and float(
                    dataset_median
                )
                > 0
                and float(
                    amount
                )
                > float(
                    dataset_median
                )
                * 3
            ):
                reasons.append(
                    (
                        "Amount is significantly higher than "
                        "dataset median "
                        f"({round(float(dataset_median), 2)})."
                    )
                )

        if vendor_columns:
            vendor_col = (
                vendor_columns[0]
            )

            vendor = row.get(
                vendor_col
            )

            if (
                vendor is not None
                and str(
                    vendor
                ).strip()
            ):
                vendor_count = int(
                    (
                        dataframe[
                            vendor_col
                        ]
                        == vendor
                    ).sum()
                )

                if vendor_count == 1:
                    reasons.append(
                        (
                            "Entity appears only once "
                            "in the dataset."
                        )
                    )

        return reasons

    @staticmethod
    def detect_anomalies(
        dataframe: pd.DataFrame,
    ) -> list[dict[str, Any]]:
        if (
            dataframe.empty
            or len(
                dataframe
            )
            < 5
        ):
            return []

        # Defensive seeding. IsolationForest additionally receives random_state.
        random.seed(
            MLService.RANDOM_STATE
        )
        np.random.seed(
            MLService.RANDOM_STATE
        )

        numeric_dataframe = (
            MLService
            ._prepare_numeric_features(
                dataframe
            )
        )

        if numeric_dataframe.empty:
            return []

        scaler = (
            StandardScaler()
        )

        scaled_data = (
            scaler.fit_transform(
                numeric_dataframe
            )
        )

        isolation_forest = (
            IsolationForest(
                n_estimators=100,
                max_samples="auto",
                contamination=(
                    MLService
                    .CONTAMINATION
                ),
                max_features=1.0,
                bootstrap=False,
                random_state=(
                    MLService
                    .RANDOM_STATE
                ),
                n_jobs=1,
            )
        )

        if_predictions = (
            isolation_forest
            .fit_predict(
                scaled_data
            )
        )

        lof_neighbors = min(
            MLService
            .MAX_LOF_NEIGHBORS,
            len(
                dataframe
            )
            - 1,
        )

        local_outlier_factor = (
            LocalOutlierFactor(
                n_neighbors=(
                    lof_neighbors
                ),
                algorithm="brute",
                contamination=(
                    MLService
                    .CONTAMINATION
                ),
                novelty=False,
                n_jobs=1,
            )
        )

        lof_predictions = (
            local_outlier_factor
            .fit_predict(
                scaled_data
            )
        )

        transaction_col = (
            MLService
            .get_transaction_id_column(
                dataframe
            )
        )

        anomalies: list[
            dict[str, Any]
        ] = []

        for position, (
            _,
            row_series,
        ) in enumerate(
            dataframe.iterrows()
        ):
            row = dict(
                row_series
            )

            if_flagged = bool(
                if_predictions[
                    position
                ]
                == -1
            )

            lof_flagged = bool(
                lof_predictions[
                    position
                ]
                == -1
            )

            if (
                not if_flagged
                and not lof_flagged
            ):
                continue

            anomaly_score = 0.0
            anomaly_reasons: list[
                str
            ] = []

            if if_flagged:
                anomaly_score += 10.0

                anomaly_reasons.append(
                    (
                        "Transaction shows an unusual pattern "
                        "compared with the overall dataset."
                    )
                )

            if lof_flagged:
                anomaly_score += 10.0

                anomaly_reasons.append(
                    (
                        "Transaction differs materially from "
                        "similar neighbouring transactions."
                    )
                )

            anomaly_reasons.extend(
                MLService
                .generate_anomaly_reasons(
                    row,
                    dataframe,
                )
            )

            # Remove duplicate reasons while preserving deterministic order.
            anomaly_reasons = list(
                dict.fromkeys(
                    anomaly_reasons
                )
            )

            transaction_id = (
                str(
                    row.get(
                        transaction_col
                    )
                ).strip()
                if transaction_col
                else str(
                    position
                )
            )

            if (
                transaction_id.endswith(
                    ".0"
                )
                and transaction_id[
                    :-2
                ].isdigit()
            ):
                transaction_id = (
                    transaction_id[
                        :-2
                    ]
                )

            anomalies.append(
                {
                    "transaction_id": (
                        transaction_id
                    ),
                    "anomaly_score": (
                        round(
                            anomaly_score,
                            4,
                        )
                    ),
                    "anomaly_reasons": (
                        anomaly_reasons
                    ),
                    "detection_sources": [
                        "ML"
                    ],
                }
            )

        # Stable output ordering protects downstream merging from accidental
        # order differences between repeated executions.
        anomalies.sort(
            key=lambda item: (
                str(
                    item.get(
                        "transaction_id"
                    )
                    or ""
                )
            )
        )

        return anomalies
