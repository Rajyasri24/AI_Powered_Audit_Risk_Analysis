import json
import math
from pathlib import Path
from typing import Any

import pandas as pd

from app.core.supabase_client import supabase
from app.services.validation_service import ValidationService
from app.services.schema_mapping_service import SchemaMappingService


BASE_DIR = Path(__file__).resolve().parents[2]
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)


def clean_for_json(value: Any):
    if isinstance(value, float):
        if math.isnan(value) or math.isinf(value):
            return None
        return value

    if isinstance(value, dict):
        return {key: clean_for_json(val) for key, val in value.items()}

    if isinstance(value, list):
        return [clean_for_json(item) for item in value]

    return value


class DatasetService:

    @staticmethod
    def process_upload(client_id: str, uploaded_file):
        filename = uploaded_file.filename

        if not filename:
            raise ValueError("No file selected")

        extension = filename.split(".")[-1].lower()
        allowed_types = ["csv", "xlsx", "json"]

        if extension not in allowed_types:
            raise ValueError("Only CSV, XLSX and JSON files are supported")

        file_path = UPLOAD_DIR / filename

        with open(file_path, "wb") as buffer:
            buffer.write(uploaded_file.file.read())

        if extension == "csv":
            dataframe = pd.read_csv(
                file_path,
                sep=None,
                engine="python",
                encoding="utf-8-sig"
            )

        elif extension == "xlsx":
            dataframe = pd.read_excel(file_path)

        elif extension == "json":
            with open(file_path, "r", encoding="utf-8-sig") as file:
                data = json.load(file)

            if isinstance(data, dict):
                if "data" in data:
                    data = data["data"]
                elif "transactions" in data:
                    data = data["transactions"]
                else:
                    data = [data]

            dataframe = pd.DataFrame(data)

        else:
            raise ValueError("Unsupported file type")

        validation = ValidationService.validate_dataframe(dataframe)

        mapping = SchemaMappingService.generate_mapping(
            dataframe.columns.tolist()
        )

        dataset_payload = {
            "client_id": client_id,
            "dataset_name": filename,
            "file_type": extension,
            "file_path": str(file_path),
            "total_records": len(dataframe),
            "total_columns": len(dataframe.columns),
            "upload_status": validation["status"]
        }

        response = (
            supabase
            .table("datasets")
            .insert(dataset_payload)
            .execute()
        )

        if not response.data:
            return {"error": "Failed to save dataset metadata"}

        dataset = response.data[0]

        preview = (
            dataframe
            .head(5)
            .astype(object)
            .where(pd.notnull(dataframe.head(5)), None)
            .to_dict(orient="records")
        )

        result = {
            "dataset": dataset,
            "preview": preview,
            "validation": validation,
            "mapping": mapping
        }

        return clean_for_json(result)

    @staticmethod
    def get_all_datasets():
        response = (
            supabase
            .table("datasets")
            .select("*, clients(*)")
            .order("upload_date", desc=True)
            .execute()
        )

        return response.data