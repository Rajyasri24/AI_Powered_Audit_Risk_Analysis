import json
from pathlib import Path

import pandas as pd

from app.core.supabase_client import supabase


BASE_DIR = Path(__file__).resolve().parents[2]
UPLOAD_DIR = BASE_DIR / "uploads"

UPLOAD_DIR.mkdir(exist_ok=True)


class DatasetService:

    @staticmethod
    def process_upload(
        client_id: str,
        uploaded_file
    ):
        filename = uploaded_file.filename

        if not filename:
            raise ValueError("No file selected")

        extension = filename.split(".")[-1].lower()

        allowed_types = [
            "csv",
            "xlsx",
            "json"
        ]

        if extension not in allowed_types:
            raise ValueError(
                "Only CSV, XLSX and JSON files are supported"
            )

        file_path = UPLOAD_DIR / filename

        with open(file_path, "wb") as buffer:
            buffer.write(
                uploaded_file.file.read()
            )

        if extension == "csv":
            dataframe = pd.read_csv(file_path)

        elif extension == "xlsx":
            dataframe = pd.read_excel(file_path)

        else:
            with open(
                file_path,
                "r",
                encoding="utf-8"
            ) as file:
                data = json.load(file)

            dataframe = pd.DataFrame(data)

        total_records = len(dataframe)
        total_columns = len(
            dataframe.columns
        )

        dataset_payload = {
            "client_id": client_id,
            "dataset_name": filename,
            "file_type": extension,
            "file_path": str(file_path),
            "total_records": total_records,
            "total_columns": total_columns,
            "upload_status": "UPLOADED"
        }

        response = (
            supabase
            .table("datasets")
            .insert(dataset_payload)
            .execute()
        )

        dataset = response.data[0]

        preview = dataframe.head(5).to_dict(
            orient="records"
        )

        return {
            "dataset": dataset,
            "preview": preview
        }