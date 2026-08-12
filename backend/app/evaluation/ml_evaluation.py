from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from sklearn.metrics import (
    accuracy_score,
    average_precision_score,
    balanced_accuracy_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)

from app.services.ml_service import MLService


LABEL_CANDIDATES = [
    "isFraud",
    "isfraud",
    "fraud",
    "fraud_flag",
    "label",
    "target",
]


@dataclass
class MLEvaluationResult:
    label_column: str
    total_rows: int
    positive_rows: int
    predicted_positive_rows: int
    precision: float
    recall: float
    f1: float
    accuracy: float
    balanced_accuracy: float
    roc_auc: float | None
    pr_auc: float | None
    confusion_matrix: list[list[int]]

    def as_dict(self) -> dict[str, Any]:
        return {
            "label_column": self.label_column,
            "total_rows": self.total_rows,
            "positive_rows": self.positive_rows,
            "predicted_positive_rows": self.predicted_positive_rows,
            "precision": self.precision,
            "recall": self.recall,
            "f1": self.f1,
            "accuracy": self.accuracy,
            "balanced_accuracy": self.balanced_accuracy,
            "roc_auc": self.roc_auc,
            "pr_auc": self.pr_auc,
            "confusion_matrix": self.confusion_matrix,
        }


class MLEvaluator:
    @staticmethod
    def detect_label_column(
        dataframe: pd.DataFrame,
        requested: str | None = None,
    ) -> str:
        if requested:
            if requested not in dataframe.columns:
                raise ValueError(
                    f"Label column '{requested}' was not found."
                )
            return requested

        lower_map = {
            str(column).lower(): str(column)
            for column in dataframe.columns
        }

        for candidate in LABEL_CANDIDATES:
            match = lower_map.get(candidate.lower())
            if match:
                return match

        raise ValueError(
            "No ground-truth fraud label column was found. "
            "Pass --label-column explicitly."
        )

    @staticmethod
    def evaluate_dataframe(
        dataframe: pd.DataFrame,
        label_column: str | None = None,
    ) -> MLEvaluationResult:
        if dataframe.empty:
            raise ValueError("Dataset is empty.")

        label = MLEvaluator.detect_label_column(
            dataframe,
            label_column,
        )

        y_true = (
            pd.to_numeric(
                dataframe[label],
                errors="coerce",
            )
            .fillna(0)
            .astype(int)
            .clip(0, 1)
            .to_numpy()
        )

        anomalies = MLService.detect_anomalies(
            dataframe
        )

        transaction_col = MLService.get_transaction_id_column(
            dataframe
        )

        if transaction_col:
            row_ids = [
                MLEvaluator._normalise_id(value)
                for value in dataframe[transaction_col].tolist()
            ]
        else:
            row_ids = [
                str(index)
                for index in range(len(dataframe))
            ]

        score_by_id = {
            MLEvaluator._normalise_id(
                item.get("transaction_id")
            ): float(item.get("anomaly_score") or 0)
            for item in anomalies
        }

        scores = np.array(
            [
                score_by_id.get(row_id, 0.0)
                for row_id in row_ids
            ],
            dtype=float,
        )

        y_pred = (scores > 0).astype(int)

        matrix = confusion_matrix(
            y_true,
            y_pred,
            labels=[0, 1],
        )

        roc_auc = None
        pr_auc = None

        if len(np.unique(y_true)) == 2:
            roc_auc = float(
                roc_auc_score(
                    y_true,
                    scores,
                )
            )
            pr_auc = float(
                average_precision_score(
                    y_true,
                    scores,
                )
            )

        return MLEvaluationResult(
            label_column=label,
            total_rows=len(dataframe),
            positive_rows=int(y_true.sum()),
            predicted_positive_rows=int(y_pred.sum()),
            precision=round(
                float(
                    precision_score(
                        y_true,
                        y_pred,
                        zero_division=0,
                    )
                ),
                6,
            ),
            recall=round(
                float(
                    recall_score(
                        y_true,
                        y_pred,
                        zero_division=0,
                    )
                ),
                6,
            ),
            f1=round(
                float(
                    f1_score(
                        y_true,
                        y_pred,
                        zero_division=0,
                    )
                ),
                6,
            ),
            accuracy=round(
                float(
                    accuracy_score(
                        y_true,
                        y_pred,
                    )
                ),
                6,
            ),
            balanced_accuracy=round(
                float(
                    balanced_accuracy_score(
                        y_true,
                        y_pred,
                    )
                ),
                6,
            ),
            roc_auc=(
                round(roc_auc, 6)
                if roc_auc is not None
                else None
            ),
            pr_auc=(
                round(pr_auc, 6)
                if pr_auc is not None
                else None
            ),
            confusion_matrix=matrix.astype(int).tolist(),
        )

    @staticmethod
    def read_dataset(path: str) -> pd.DataFrame:
        file_path = Path(path)
        suffix = file_path.suffix.lower()

        if suffix == ".csv":
            return pd.read_csv(file_path)
        if suffix == ".xlsx":
            return pd.read_excel(file_path)
        if suffix == ".json":
            return pd.read_json(file_path)

        raise ValueError(
            "Supported evaluation files are CSV, XLSX and JSON."
        )

    @staticmethod
    def _normalise_id(value: Any) -> str:
        text = str(value).strip()
        if text.endswith(".0") and text[:-2].isdigit():
            return text[:-2]
        return text
