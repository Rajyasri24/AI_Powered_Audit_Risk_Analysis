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
        if score <= 20:
            return "Low"
        if score <= 50:
            return "Medium"
        if score <= 75:
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
    def is_empty(value: Any):
        return value is None or pd.isna(value) or str(value).strip() == ""

    @staticmethod
    def get_row_value_case_insensitive(row: dict[str, Any], field: str):
        lower_map = {str(key).lower(): key for key in row.keys()}
        actual_key = lower_map.get(field.lower())

        if actual_key is None:
            return False, None

        return True, row.get(actual_key)

    @staticmethod
    def evaluate_condition(row: dict[str, Any], condition: dict[str, Any]):
        field = str(condition.get("field") or "").strip()
        operator = str(condition.get("operator") or "").strip()
        value = condition.get("value")

        if not field or not operator:
            return False

        field_exists, actual = RuleEngineService.get_row_value_case_insensitive(
            row,
            field
        )

        if not field_exists:
            return False

        if operator == "is_null":
            return RuleEngineService.is_empty(actual)

        if operator == "not_null":
            return not RuleEngineService.is_empty(actual)

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
            return str(actual).strip().lower() == str(value).strip().lower()

        if operator == "!=":
            return str(actual).strip().lower() != str(value).strip().lower()

        return False

    @staticmethod
    def evaluate_json_rule(row: dict[str, Any], rule_definition: Any):
        if not isinstance(rule_definition, dict):
            return False

        logic = str(rule_definition.get("logic") or "AND").upper()
        conditions = rule_definition.get("conditions", [])

        if logic not in ["AND", "OR"]:
            logic = "AND"

        if not isinstance(conditions, list) or len(conditions) == 0:
            return False

        results = []

        for condition in conditions:
            if isinstance(condition, dict):
                results.append(
                    RuleEngineService.evaluate_condition(row, condition)
                )

        if not results:
            return False

        if logic == "OR":
            return any(results)

        return all(results)

    @staticmethod
    def apply_rules(
        dataframe: pd.DataFrame,
        client_rules: list[dict[str, Any]]
    ):
        findings: list[dict[str, Any]] = []

        amount_col = RuleEngineService.get_column(
            dataframe,
            [
                "amount",
                "txn_amt",
                "invoice_value",
                "payment_amount",
                "transaction_amount",
            ]
        )

        gst_col = RuleEngineService.get_column(
            dataframe,
            ["gst", "vendor_gst", "gst_number"]
        )

        transaction_col = RuleEngineService.get_column(
            dataframe,
            ["transaction_id", "txn_id", "invoice_id", "id"]
        )

        for row_index, row_series in dataframe.iterrows():
            row = dict(row_series)

            for client_rule in client_rules:
                if client_rule.get("enabled") is False:
                    continue

                rule = client_rule.get("rules") or {}

                rule_name = str(rule.get("rule_name") or "").strip()
                rule_definition = rule.get("rule_definition")
                threshold = client_rule.get("custom_threshold")

                likelihood = int(
                    client_rule.get("likelihood")
                    or rule.get("likelihood")
                    or 1
                )

                impact = int(
                    client_rule.get("impact")
                    or rule.get("impact")
                    or 1
                )

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
                    threshold_num = RuleEngineService.safe_float(threshold) or 50000

                    if (
                        amount is not None
                        and amount >= threshold_num
                        and amount % 10000 == 0
                    ):
                        triggered = True
                        reason = "Suspicious round number transaction"

                elif rule_name == "Missing GST" and gst_col:
                    gst_value = row.get(gst_col)

                    if RuleEngineService.is_empty(gst_value):
                        triggered = True
                        reason = "GST value is missing"

                elif isinstance(rule_definition, dict):
                    triggered = RuleEngineService.evaluate_json_rule(
                        row,
                        rule_definition
                    )

                    if triggered:
                        logic = str(rule_definition.get("logic") or "AND").upper()
                        reason = f"Custom JSON rule condition matched using {logic} logic"

                if triggered:
                    transaction_id = (
                        str(row.get(transaction_col))
                        if transaction_col
                        else str(row_index)
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