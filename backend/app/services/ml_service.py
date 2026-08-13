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
    Deterministic unsupervised anomaly-detection service.

    Design:
    - Isolation Forest captures global anomalies.
    - Local Outlier Factor captures local/neighbourhood anomalies.
    - Both detectors produce continuous anomaly severity.
    - Detector severities are rank-normalised to remove scale incompatibility.
    - A weighted ensemble produces the final continuous anomaly ranking.
    - Only the highest-ranked observations are returned as ML findings.
    - Fraud/target labels and transaction identifiers are never used as features.

    The external service contract is preserved:
        detect_anomalies(dataframe) -> list[dict]
    """

    RANDOM_STATE = 42

    IF_N_ESTIMATORS = 200
    LOF_NEIGHBORS = 20

    # LOF was empirically the stronger local anomaly detector on transaction
    # behaviour, while Isolation Forest remains a complementary global signal.
    IF_WEIGHT = 0.15
    LOF_WEIGHT = 0.85

    # Flag the most exceptional 0.2% of the current population.
    # Audit rules/network analytics still identify additional review items.
    ALERT_QUANTILE = 0.998

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
            str(column).strip().lower(): str(column)
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
            .select_dtypes(include=["number"])
            .copy()
        )

        columns_to_exclude: list[str] = []

        for column in numeric_dataframe.columns:
            normalized = str(column).strip().lower()

            if (
                normalized in MLService.LABEL_COLUMNS
                or normalized in MLService.TRANSACTION_ID_CANDIDATES
            ):
                columns_to_exclude.append(column)

        numeric_dataframe = numeric_dataframe.drop(
            columns=columns_to_exclude,
            errors="ignore",
        )

        if numeric_dataframe.empty:
            return numeric_dataframe

        numeric_dataframe = numeric_dataframe.reindex(
            sorted(
                numeric_dataframe.columns,
                key=lambda item: str(item).lower(),
            ),
            axis=1,
        )

        numeric_dataframe = numeric_dataframe.replace(
            [np.inf, -np.inf],
            np.nan,
        )

        # Median imputation is less distortionary than forcing missing
        # transaction values to zero. Constant/all-null columns fall back to 0.
        for column in numeric_dataframe.columns:
            median = pd.to_numeric(
                numeric_dataframe[column],
                errors="coerce",
            ).median()

            fill_value = float(median) if pd.notna(median) else 0.0

            numeric_dataframe[column] = (
                pd.to_numeric(
                    numeric_dataframe[column],
                    errors="coerce",
                )
                .fillna(fill_value)
            )

        # Constant features carry no anomaly information and can be removed
        # without changing transaction semantics.
        varying_columns = [
            column
            for column in numeric_dataframe.columns
            if numeric_dataframe[column].nunique(dropna=False) > 1
        ]

        return numeric_dataframe[varying_columns]

    @staticmethod
    def _percentile_rank(
        values: np.ndarray,
    ) -> np.ndarray:
        """
        Deterministic percentile rank in [0, 1].

        Higher values must mean "more anomalous" before this method is called.
        """
        if len(values) == 0:
            return np.array([], dtype=float)

        if len(values) == 1:
            return np.array([1.0], dtype=float)

        ranks = (
            pd.Series(values)
            .rank(method="average", pct=True)
            .to_numpy(dtype=float)
        )

        return np.clip(ranks, 0.0, 1.0)

    @staticmethod
    def score_dataframe(
        dataframe: pd.DataFrame,
    ) -> pd.DataFrame:
        """
        Return a score for every row without exposing or using a fraud label.

        Columns:
        - transaction_id
        - if_percentile
        - lof_percentile
        - ensemble_score       [0, 1]
        - anomaly_score        [0, 20]
        - is_anomaly
        """
        if dataframe.empty:
            return pd.DataFrame(
                columns=[
                    "transaction_id",
                    "if_percentile",
                    "lof_percentile",
                    "ensemble_score",
                    "anomaly_score",
                    "is_anomaly",
                ]
            )

        if len(dataframe) < 5:
            transaction_col = MLService.get_transaction_id_column(
                dataframe
            )

            ids = [
                MLService._normalise_id(
                    row.get(transaction_col)
                    if transaction_col
                    else position
                )
                for position, (_, row) in enumerate(dataframe.iterrows())
            ]

            return pd.DataFrame(
                {
                    "transaction_id": ids,
                    "if_percentile": np.zeros(len(dataframe)),
                    "lof_percentile": np.zeros(len(dataframe)),
                    "ensemble_score": np.zeros(len(dataframe)),
                    "anomaly_score": np.zeros(len(dataframe)),
                    "is_anomaly": np.zeros(len(dataframe), dtype=bool),
                }
            )

        random.seed(MLService.RANDOM_STATE)
        np.random.seed(MLService.RANDOM_STATE)

        numeric_dataframe = MLService._prepare_numeric_features(
            dataframe
        )

        if numeric_dataframe.empty:
            return pd.DataFrame(
                {
                    "transaction_id": [
                        MLService._normalise_id(index)
                        for index in range(len(dataframe))
                    ],
                    "if_percentile": np.zeros(len(dataframe)),
                    "lof_percentile": np.zeros(len(dataframe)),
                    "ensemble_score": np.zeros(len(dataframe)),
                    "anomaly_score": np.zeros(len(dataframe)),
                    "is_anomaly": np.zeros(len(dataframe), dtype=bool),
                }
            )

        scaler = StandardScaler()
        scaled_data = scaler.fit_transform(numeric_dataframe)

        isolation_forest = IsolationForest(
            n_estimators=MLService.IF_N_ESTIMATORS,
            max_samples="auto",
            contamination="auto",
            max_features=1.0,
            bootstrap=False,
            random_state=MLService.RANDOM_STATE,
            n_jobs=1,
        )

        isolation_forest.fit(scaled_data)

        # score_samples: lower = more abnormal, so negate it.
        if_raw_severity = -isolation_forest.score_samples(
            scaled_data
        )

        lof_neighbors = min(
            MLService.LOF_NEIGHBORS,
            len(dataframe) - 1,
        )

        local_outlier_factor = LocalOutlierFactor(
            n_neighbors=lof_neighbors,
            algorithm="auto",
            contamination="auto",
            novelty=False,
            n_jobs=1,
        )

        local_outlier_factor.fit_predict(scaled_data)

        # negative_outlier_factor_: more negative = more abnormal.
        lof_raw_severity = -local_outlier_factor.negative_outlier_factor_

        if_percentile = MLService._percentile_rank(
            if_raw_severity
        )
        lof_percentile = MLService._percentile_rank(
            lof_raw_severity
        )

        ensemble_score = (
            MLService.IF_WEIGHT * if_percentile
            + MLService.LOF_WEIGHT * lof_percentile
        )

        # Population-relative threshold. No fraud labels are used.
        alert_threshold = float(
            np.quantile(
                ensemble_score,
                MLService.ALERT_QUANTILE,
            )
        )

        is_anomaly = ensemble_score >= alert_threshold

        # Preserve the platform's existing ML contribution range (0..20),
        # but make it continuous instead of binary 10/20.
        anomaly_score = np.clip(
            ensemble_score * 20.0,
            0.0,
            20.0,
        )

        transaction_col = MLService.get_transaction_id_column(
            dataframe
        )

        transaction_ids: list[str] = []

        for position, (_, row_series) in enumerate(
            dataframe.iterrows()
        ):
            row = dict(row_series)

            value = (
                row.get(transaction_col)
                if transaction_col
                else position
            )

            transaction_ids.append(
                MLService._normalise_id(value)
            )

        return pd.DataFrame(
            {
                "transaction_id": transaction_ids,
                "if_percentile": np.round(
                    if_percentile,
                    8,
                ),
                "lof_percentile": np.round(
                    lof_percentile,
                    8,
                ),
                "ensemble_score": np.round(
                    ensemble_score,
                    8,
                ),
                "anomaly_score": np.round(
                    anomaly_score,
                    4,
                ),
                "is_anomaly": is_anomaly.astype(bool),
            }
        )

    @staticmethod
    def generate_anomaly_reasons(
        row: dict[str, Any],
        dataframe: pd.DataFrame,
    ) -> list[str]:
        reasons: list[str] = []

        amount_columns = sorted(
            [
                column
                for column in dataframe.columns
                if (
                    "amount" in str(column).lower()
                    or "value" in str(column).lower()
                    or "payment" in str(column).lower()
                )
            ],
            key=lambda item: str(item).lower(),
        )

        vendor_columns = sorted(
            [
                column
                for column in dataframe.columns
                if (
                    "vendor" in str(column).lower()
                    or "supplier" in str(column).lower()
                    or str(column).lower() in {"nameorig", "namedest"}
                )
            ],
            key=lambda item: str(item).lower(),
        )

        if amount_columns:
            amount_col = amount_columns[0]

            amount = pd.to_numeric(
                row.get(amount_col),
                errors="coerce",
            )

            dataset_median = pd.to_numeric(
                dataframe[amount_col],
                errors="coerce",
            ).median()

            if (
                pd.notna(amount)
                and pd.notna(dataset_median)
                and float(dataset_median) > 0
                and float(amount) > float(dataset_median) * 3
            ):
                reasons.append(
                    (
                        "Amount is significantly higher than "
                        "dataset median "
                        f"({round(float(dataset_median), 2)})."
                    )
                )

        if vendor_columns:
            vendor_col = vendor_columns[0]
            vendor = row.get(vendor_col)

            if vendor is not None and str(vendor).strip():
                vendor_count = int(
                    (dataframe[vendor_col] == vendor).sum()
                )

                if vendor_count == 1:
                    reasons.append(
                        "Entity appears only once in the dataset."
                    )

        return reasons

    @staticmethod
    def detect_anomalies(
        dataframe: pd.DataFrame,
    ) -> list[dict[str, Any]]:
        if dataframe.empty or len(dataframe) < 5:
            return []

        score_frame = MLService.score_dataframe(
            dataframe
        )

        if score_frame.empty:
            return []

        transaction_col = MLService.get_transaction_id_column(
            dataframe
        )

        anomalies: list[dict[str, Any]] = []

        for position, (_, row_series) in enumerate(
            dataframe.iterrows()
        ):
            score_row = score_frame.iloc[position]

            if not bool(score_row["is_anomaly"]):
                continue

            row = dict(row_series)

            if_percentile = float(
                score_row["if_percentile"]
            )
            lof_percentile = float(
                score_row["lof_percentile"]
            )

            anomaly_reasons: list[str] = []

            if if_percentile >= 0.95:
                anomaly_reasons.append(
                    (
                        "Transaction shows a strong global anomaly "
                        "pattern compared with the overall dataset."
                    )
                )

            if lof_percentile >= 0.95:
                anomaly_reasons.append(
                    (
                        "Transaction differs materially from "
                        "similar neighbouring transactions."
                    )
                )

            anomaly_reasons.extend(
                MLService.generate_anomaly_reasons(
                    row,
                    dataframe,
                )
            )

            if not anomaly_reasons:
                anomaly_reasons.append(
                    (
                        "Transaction falls within the highest-ranked "
                        "combined anomaly observations."
                    )
                )

            anomaly_reasons = list(
                dict.fromkeys(anomaly_reasons)
            )

            transaction_id = (
                MLService._normalise_id(
                    row.get(transaction_col)
                    if transaction_col
                    else position
                )
            )

            anomalies.append(
                {
                    "transaction_id": transaction_id,
                    "anomaly_score": round(
                        float(
                            score_row["anomaly_score"]
                        ),
                        4,
                    ),
                    "anomaly_reasons": anomaly_reasons,
                    "detection_sources": ["ML"],
                }
            )

        anomalies.sort(
            key=lambda item: str(
                item.get("transaction_id") or ""
            )
        )

        return anomalies

    @staticmethod
    def _normalise_id(
        value: Any,
    ) -> str:
        text = str(value).strip()

        if text.endswith(".0") and text[:-2].isdigit():
            return text[:-2]

        return text
