import pandas as pd


class ValidationService:

    @staticmethod
    def validate_dataframe(dataframe: pd.DataFrame):
        total_rows = len(dataframe)
        total_columns = len(dataframe.columns)

        duplicate_rows = int(dataframe.duplicated().sum())

        missing_values = int(dataframe.isnull().sum().sum())

        invalid_amounts = 0
        amount_columns = [
            col for col in dataframe.columns
            if "amount" in col.lower()
            or "value" in col.lower()
            or "payment" in col.lower()
        ]

        for col in amount_columns:
            numeric_col = pd.to_numeric(dataframe[col], errors="coerce")
            invalid_amounts += int((numeric_col < 0).sum())
            invalid_amounts += int(numeric_col.isna().sum())

        invalid_dates = 0
        date_columns = [
            col for col in dataframe.columns
            if "date" in col.lower()
            or "time" in col.lower()
        ]

        for col in date_columns:
            parsed_dates = pd.to_datetime(
                dataframe[col],
                errors="coerce"
            )
            invalid_dates += int(parsed_dates.isna().sum())

        status = "PASSED"

        if (
            duplicate_rows > 0
            or missing_values > 0
            or invalid_amounts > 0
            or invalid_dates > 0
        ):
            status = "WARNING"

        if total_rows == 0:
            status = "FAILED"

        return {
            "total_rows": total_rows,
            "total_columns": total_columns,
            "duplicate_rows": duplicate_rows,
            "missing_values": missing_values,
            "invalid_amounts": invalid_amounts,
            "invalid_dates": invalid_dates,
            "status": status
        }