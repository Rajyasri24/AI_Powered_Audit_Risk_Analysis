from typing import Any

import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.neighbors import LocalOutlierFactor
from sklearn.preprocessing import StandardScaler


class MLService:

    @staticmethod
    def get_transaction_id_column(dataframe: pd.DataFrame):
        possible_columns = [
            "transaction_id",
            "txn_id",
            "invoice_id",
            "id",
        ]

        lower_map = {col.lower(): col for col in dataframe.columns}

        for col in possible_columns:
            if col in lower_map:
                return lower_map[col]

        return None

    @staticmethod
    def generate_anomaly_reasons(row: dict[str, Any], dataframe: pd.DataFrame):
        reasons = []

        amount_columns = [
            col for col in dataframe.columns
            if "amount" in col.lower()
            or "value" in col.lower()
            or "payment" in col.lower()
        ]

        vendor_columns = [
            col for col in dataframe.columns
            if "vendor" in col.lower()
            or "supplier" in col.lower()
        ]

        if amount_columns:
            amount_col = amount_columns[0]
            amount = pd.to_numeric(row.get(amount_col), errors="coerce")

            dataset_median = pd.to_numeric(
                dataframe[amount_col],
                errors="coerce"
            ).median()

            if pd.notna(amount) and pd.notna(dataset_median) and dataset_median > 0:
                if amount > dataset_median * 3:
                    reasons.append(
                        f"Amount is significantly higher than dataset median ({round(float(dataset_median), 2)})."
                    )

        if vendor_columns:
            vendor_col = vendor_columns[0]
            vendor = row.get(vendor_col)

            if vendor:
                vendor_count = int((dataframe[vendor_col] == vendor).sum())

                if vendor_count == 1:
                    reasons.append("Vendor appears only once in the dataset.")

        return reasons

    @staticmethod
    def detect_anomalies(dataframe: pd.DataFrame):
        numeric_dataframe = dataframe.select_dtypes(include=["number"]).copy()

        if numeric_dataframe.empty or len(numeric_dataframe) < 5:
            return []

        numeric_dataframe = numeric_dataframe.fillna(0)

        scaler = StandardScaler()
        scaled_data = scaler.fit_transform(numeric_dataframe)

        isolation_forest = IsolationForest(
            contamination=0.2,
            random_state=42
        )

        if_predictions = isolation_forest.fit_predict(scaled_data)

        lof = LocalOutlierFactor(
            n_neighbors=min(5, len(dataframe) - 1),
            contamination=0.2
        )

        lof_predictions = lof.fit_predict(scaled_data)

        transaction_col = MLService.get_transaction_id_column(dataframe)

        anomalies = []

        for index, row_series in dataframe.iterrows():
            row = dict(row_series)

            if_flagged = if_predictions[index] == -1
            lof_flagged = lof_predictions[index] == -1

            if not if_flagged and not lof_flagged:
                continue

            anomaly_score = 0
            anomaly_reasons = []

            if if_flagged:
                anomaly_score += 10
                anomaly_reasons.append(
                    "Isolation Forest classified this transaction as anomalous."
                )

            if lof_flagged:
                anomaly_score += 10
                anomaly_reasons.append(
                    "Local Outlier Factor detected local deviation from neighboring transactions."
                )

            anomaly_reasons.extend(
                MLService.generate_anomaly_reasons(row, dataframe)
            )

            transaction_id = (
                str(row.get(transaction_col))
                if transaction_col
                else str(index)
            )

            anomalies.append(
                {
                    "transaction_id": transaction_id,
                    "anomaly_score": anomaly_score,
                    "anomaly_reasons": anomaly_reasons,
                    "detection_sources": ["ML"],
                }
            )

        return anomalies