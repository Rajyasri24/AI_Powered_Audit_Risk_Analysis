from typing import Any

import pandas as pd


class RuleEngineService:

    @staticmethod
    def get_column(df: pd.DataFrame, possible_names: list[str]):
        lower_map = {col.lower(): col for col in df.columns}

        for name in possible_names:
            if name.lower() in lower_map:
                return lower_map[name.lower()]

        return None

    @staticmethod
    def risk_level(score: int):
        if score <= 5:
            return "Low"
        if score <= 10:
            return "Medium"
        if score <= 15:
            return "High"
        return "Critical"

    @staticmethod
    def safe_float(value: Any):
        try:
            if value is None or pd.isna(value):
                return None
            return float(value)
        except (ValueError, TypeError):
            return None

    @staticmethod
    def evaluate_condition(row: dict[str, Any], condition: dict[str, Any]):
        field = condition.get("field")
        operator = condition.get("operator")
        value = condition.get("value")

        if not field:
            return False

        actual = row.get(str(field))

        if operator == "is_null":
            return pd.isna(actual) or actual == ""

        if operator == "not_null":
            return not pd.isna(actual) and actual != ""

        if operator in [">", "<", ">=", "<="]:
            actual_num = RuleEngineService.safe_float(actual)
            value_num = RuleEngineService.safe_float(value)

            if actual_num is None or value_num is None:
                return False

            if operator == ">":
                return actual_num > value_num
            if operator == "<":
                return actual_num < value_num
            if operator == ">=":
                return actual_num >= value_num
            if operator == "<=":
                return actual_num <= value_num

        if operator == "=":
            return str(actual) == str(value)

        if operator == "!=":
            return str(actual) != str(value)

        return False

    @staticmethod
    def apply_rules(
        dataframe: pd.DataFrame,
        client_rules: list[dict[str, Any]]
    ):
        findings: list[dict[str, Any]] = []

        amount_col = RuleEngineService.get_column(
            dataframe,
            ["amount", "txn_amt", "invoice_value", "payment_amount"]
        )

        gst_col = RuleEngineService.get_column(
            dataframe,
            ["gst", "vendor_gst", "gst_number"]
        )

        transaction_col = RuleEngineService.get_column(
            dataframe,
            ["transaction_id", "txn_id", "invoice_id", "id"]
        )

        for index, row_series in dataframe.iterrows():
            row = dict(row_series)

            for client_rule in client_rules:
                rule = client_rule.get("rules") or {}

                rule_name = str(rule.get("rule_name", ""))
                rule_definition = rule.get("rule_definition")

                threshold = client_rule.get("custom_threshold")
                likelihood = int(client_rule.get("likelihood") or 1)
                impact = int(client_rule.get("impact") or 1)

                score = likelihood * impact

                triggered = False
                reason = ""

                if rule_name == "High Value Transaction" and amount_col:
                    amount = RuleEngineService.safe_float(row.get(amount_col))
                    threshold_num = RuleEngineService.safe_float(threshold)

                    if (
                        amount is not None
                        and threshold_num is not None
                        and amount > threshold_num
                    ):
                        triggered = True
                        reason = f"Amount exceeds threshold {threshold_num}"

                elif rule_name == "Negative Invoice Amount" and amount_col:
                    amount = RuleEngineService.safe_float(row.get(amount_col))

                    if amount is not None and amount < 0:
                        triggered = True
                        reason = "Negative transaction amount detected"

                elif rule_name == "Round Number Transaction" and amount_col:
                    amount = RuleEngineService.safe_float(row.get(amount_col))
                    threshold_num = (
                        RuleEngineService.safe_float(threshold) or 50000
                    )

                    if (
                        amount is not None
                        and amount >= threshold_num
                        and amount % 10000 == 0
                    ):
                        triggered = True
                        reason = "Suspicious round number transaction"

                elif rule_name == "Missing GST" and gst_col:
                    gst_value = row.get(gst_col)

                    if pd.isna(gst_value) or gst_value == "":
                        triggered = True
                        reason = "GST value is missing"

                elif isinstance(rule_definition, dict):
                    conditions = rule_definition.get("conditions", [])

                    if isinstance(conditions, list):
                        triggered = all(
                            RuleEngineService.evaluate_condition(
                                row,
                                condition
                            )
                            for condition in conditions
                            if isinstance(condition, dict)
                        )

                        if triggered:
                            reason = "Custom JSON rule condition matched"

                if triggered:
                    transaction_id = (
                        str(row.get(transaction_col))
                        if transaction_col
                        else str(index)
                    )

                    findings.append(
                        {
                            "transaction_id": transaction_id,
                            "risk_score": score,
                            "risk_level": RuleEngineService.risk_level(score),
                            "rule_score": score,
                            "anomaly_score": None,
                            "network_score": None,
                            "reasons": reason,
                            "triggered_rules": [rule_name],
                        }
                    )

        return findings