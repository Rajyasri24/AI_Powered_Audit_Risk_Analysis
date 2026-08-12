import json
import math
from datetime import datetime, timedelta
from io import StringIO
from pathlib import Path
from typing import Any, cast
from urllib import response

import pandas as pd
from fastapi import HTTPException

from app.core.supabase_client import supabase
from app.core.supabase_client import (
    execute_with_retry,
    supabase,
)
from app.services.schema_mapping_service import SchemaMappingService
from app.services.validation_service import ValidationService


BASE_DIR = Path(__file__).resolve().parents[2]
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)


def clean_for_json(value: Any):
    if isinstance(value, float):
        if math.isnan(value) or math.isinf(value):
            return None

        return value

    if isinstance(value, dict):
        return {
            key: clean_for_json(item)
            for key, item in value.items()
        }

    if isinstance(value, list):
        return [
            clean_for_json(item)
            for item in value
        ]

    return value


def read_csv_safely(file_path: Path) -> pd.DataFrame:
    """
    Reads a normal comma-separated CSV.

    It also repairs files where every row has accidentally been
    stored as one quoted comma-separated field.
    """

    try:
        dataframe = pd.read_csv(
            file_path,
            encoding="utf-8-sig",
        )
    except Exception:
        dataframe = pd.read_csv(
            file_path,
            sep=None,
            engine="python",
            encoding="utf-8-sig",
        )

    if len(dataframe.columns) > 1:
        return dataframe

    first_column = str(dataframe.columns[0])

    if "," not in first_column:
        return dataframe

    raw_text = file_path.read_text(
        encoding="utf-8-sig",
    )

    repaired_lines: list[str] = []

    for raw_line in raw_text.splitlines():
        line = raw_line.strip()

        if (
            len(line) >= 2
            and line.startswith('"')
            and line.endswith('"')
        ):
            line = line[1:-1].replace('""', '"')

        repaired_lines.append(line)

    repaired_text = "\n".join(repaired_lines)

    repaired_dataframe = pd.read_csv(
        StringIO(repaired_text),
        sep=",",
    )

    if len(repaired_dataframe.columns) <= 1:
        raise HTTPException(
            status_code=400,
            detail=(
                "CSV structure could not be parsed. "
                "Please export the file using comma-separated columns."
            ),
        )

    return repaired_dataframe


class DatasetService:

    @staticmethod
    def process_upload(client_id: str, uploaded_file):
        filename = uploaded_file.filename

        if not filename:
            raise HTTPException(
                status_code=400,
                detail="No file selected.",
            )

        extension = filename.split(".")[-1].lower()

        allowed_types = [
            "csv",
            "xlsx",
            "json",
        ]

        if extension not in allowed_types:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Only CSV, XLSX and JSON files are supported."
                ),
            )

        timestamp = datetime.now().strftime(
            "%Y%m%d%H%M%S%f"
        )

        safe_original_name = Path(filename).name

        safe_filename = (
            f"{timestamp}_{safe_original_name}"
        )

        file_path = UPLOAD_DIR / safe_filename

        try:
            file_content = uploaded_file.file.read()

            if not file_content:
                raise HTTPException(
                    status_code=400,
                    detail="The selected file is empty.",
                )

            with open(file_path, "wb") as buffer:
                buffer.write(file_content)

            if extension == "csv":
                dataframe = read_csv_safely(
                    file_path
                )

            elif extension == "xlsx":
                dataframe = pd.read_excel(
                    file_path
                )

            elif extension == "json":
                with open(
                    file_path,
                    "r",
                    encoding="utf-8-sig",
                ) as file:
                    data = json.load(file)

                if isinstance(data, dict):
                    if isinstance(
                        data.get("data"),
                        list,
                    ):
                        data = data["data"]

                    elif isinstance(
                        data.get("transactions"),
                        list,
                    ):
                        data = data["transactions"]

                    else:
                        data = [data]

                if not isinstance(data, list):
                    raise HTTPException(
                        status_code=400,
                        detail=(
                            "JSON dataset must contain "
                            "a list of records."
                        ),
                    )

                dataframe = pd.DataFrame(data)

            else:
                raise HTTPException(
                    status_code=400,
                    detail="Unsupported file type.",
                )

            if dataframe.empty:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "The uploaded dataset contains "
                        "no records."
                    ),
                )

            if len(dataframe.columns) == 0:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "The uploaded dataset contains "
                        "no usable columns."
                    ),
                )

            validation = (
                ValidationService.validate_dataframe(
                    dataframe
                )
            )

            mapping = (
                SchemaMappingService.generate_mapping(
                    dataframe.columns.tolist()
                )
            )

            dataset_payload = {
                "client_id": client_id,
                "dataset_name": safe_original_name,
                "file_type": extension,
                "file_path": str(file_path),
                "total_records": len(dataframe),
                "total_columns": len(
                    dataframe.columns
                ),
                "upload_status": validation[
                    "status"
                ],
            }

            response = (
                supabase
                .table("datasets")
                .insert(dataset_payload)
                .execute()
            )

            if not response.data:
                raise HTTPException(
                    status_code=500,
                    detail=(
                        "Failed to save dataset metadata."
                    ),
                )

            dataset = cast(
                dict[str, Any],
                response.data[0],
            )

            preview_dataframe = dataframe.head(5)

            preview = (
                preview_dataframe
                .astype(object)
                .where(
                    pd.notnull(preview_dataframe),
                    None,
                )
                .to_dict(orient="records")
            )

            return clean_for_json(
                {
                    "dataset": dataset,
                    "preview": preview,
                    "validation": validation,
                    "mapping": mapping,
                    "detected_columns": (
                        dataframe.columns.tolist()
                    ),
                }
            )

        except HTTPException:
            if file_path.exists():
                file_path.unlink()

            raise

        except Exception as error:
            if file_path.exists():
                file_path.unlink()

            raise HTTPException(
                status_code=400,
                detail=(
                    f"Failed to process dataset: "
                    f"{str(error)}"
                ),
            ) from error

    # @staticmethod
    # def get_all_datasets():
    #     response = (
    #         supabase
    #         .table("datasets")
    #         .select("*, clients(*)")
    #         .order("upload_date", desc=True)
    #         .execute()
    #     )

    #     return response.data or []

    @staticmethod
    def get_all_datasets():
        response = execute_with_retry(
            lambda: (
                supabase
                .table("datasets")
                .select("*, clients(*)")
                .order(
                    "upload_date",
                    desc=True,
                )
                .execute()
            )
        )

        return response.data or []
    
    # @staticmethod
    # def get_dataset(dataset_id: str):
    #     response = (
    #         supabase
    #         .table("datasets")
    #         .select("*, clients(*)")
    #         .eq("id", dataset_id)
    #         .execute()
    #     )

    #     if not response.data:
    #         raise HTTPException(
    #             status_code=404,
    #             detail="Dataset not found.",
    #         )

    #     return cast(
    #         dict[str, Any],
    #         response.data[0],
    #     )
    @staticmethod
    def get_dataset(
        dataset_id: str,
    ):
        response = execute_with_retry(
            lambda: (
                supabase
                .table("datasets")
                .select("*, clients(*)")
                .eq(
                    "id",
                    dataset_id,
                )
                .execute()
            )
        )

        if not response.data:
            raise HTTPException(
                status_code=404,
                detail="Dataset not found.",
            )

        return cast(
            dict[str, Any],
            response.data[0],
        )

    @staticmethod
    def delete_dataset(dataset_id: str):
        dataset_response = (
            supabase
            .table("datasets")
            .select("*")
            .eq("id", dataset_id)
            .execute()
        )

        if not dataset_response.data:
            raise HTTPException(
                status_code=404,
                detail="Dataset not found.",
            )

        dataset_raw = dataset_response.data[0]

        if not isinstance(dataset_raw, dict):
            raise HTTPException(
                status_code=500,
                detail="Invalid dataset record returned from database.",
            )

        dataset = cast(
            dict[str, Any],
            dataset_raw,
        )

        file_path_value = dataset.get("file_path")

        file_path = (
            str(file_path_value)
            if file_path_value
            else ""
        )

        delete_response = (
            supabase
            .table("datasets")
            .delete()
            .eq("id", dataset_id)
            .execute()
        )

        if not delete_response.data:
            raise HTTPException(
                status_code=500,
                detail="Dataset could not be deleted.",
            )

        if file_path:
            path = Path(file_path)

            if path.exists():
                path.unlink()

        return {
            "message": "Dataset deleted successfully.",
            "dataset_id": dataset_id,
        }
    @staticmethod
    def cleanup_old_datasets(
        days: int = 30,
    ):
        if days <= 0:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Cleanup period must be "
                    "greater than zero."
                ),
            )

        cutoff_date = (
            datetime.now()
            - timedelta(days=days)
        )

        old_response = (
            supabase
            .table("datasets")
            .select("*")
            .lt(
                "upload_date",
                cutoff_date.isoformat(),
            )
            .execute()
        )

        old_datasets = old_response.data or []

        deleted_count = 0

        for dataset_raw in old_datasets:
            dataset = cast(
                dict[str, Any],
                dataset_raw,
            )

            dataset_id = str(
                dataset.get("id") or ""
            )

            file_path = str(
                dataset.get("file_path") or ""
            )

            if not dataset_id:
                continue

            delete_response = (
                supabase
                .table("datasets")
                .delete()
                .eq("id", dataset_id)
                .execute()
            )

            if delete_response.data:
                deleted_count += 1

                if file_path:
                    path = Path(file_path)

                    if path.exists():
                        path.unlink()

        return {
            "message": (
                f"Deleted {deleted_count} dataset(s) "
                f"older than {days} days."
            ),
            "deleted_count": deleted_count,
        }