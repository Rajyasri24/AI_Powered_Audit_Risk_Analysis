import math
from datetime import datetime, timedelta
from typing import Any, cast

import pandas as pd
from fastapi import HTTPException

from app.core.supabase_client import supabase
from app.services.dataset_storage_service import DatasetStorageService
from app.services.schema_mapping_service import SchemaMappingService
from app.services.validation_service import ValidationService


def clean_for_json(
    value: Any,
):
    if isinstance(
        value,
        float,
    ):
        if (
            math.isnan(value)
            or math.isinf(value)
        ):
            return None

        return value

    if isinstance(
        value,
        dict,
    ):
        return {
            key: clean_for_json(val)
            for key, val in value.items()
        }

    if isinstance(
        value,
        list,
    ):
        return [
            clean_for_json(item)
            for item in value
        ]

    return value


class DatasetService:
    """
    Dataset metadata remains in public.datasets.

    New physical files are stored in Supabase Storage and `file_path`
    contains a storage:// URI. Existing local paths remain readable for
    backward compatibility through DatasetStorageService.
    """

    @staticmethod
    def process_upload(
        client_id: str,
        uploaded_file,
    ):
        filename = uploaded_file.filename

        if not filename:
            raise HTTPException(
                status_code=400,
                detail="No file selected.",
            )

        extension = (
            filename
            .split(".")[-1]
            .lower()
        )

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

        try:
            content = (
                uploaded_file.file.read()
            )
        except Exception as exc:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Uploaded file could not be read."
                ),
            ) from exc

        if not content:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Uploaded file is empty."
                ),
            )

        # Parse and validate before permanent storage.
        dataframe = (
            DatasetStorageService
            .dataframe_from_bytes(
                content,
                extension,
            )
        )

        if dataframe.empty:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Uploaded dataset contains no records."
                ),
            )

        validation = (
            ValidationService
            .validate_dataframe(
                dataframe
            )
        )

        mapping = (
            SchemaMappingService
            .generate_mapping(
                dataframe
                .columns
                .tolist()
            )
        )

        storage_reference = (
            DatasetStorageService
            .upload_bytes(
                client_id=client_id,
                original_filename=filename,
                content=content,
                file_type=extension,
            )
        )

        dataset_payload = {
            "client_id": client_id,
            "dataset_name": filename,
            "file_type": extension,
            # Existing DB schema remains unchanged.
            # This field now stores storage://bucket/object-path.
            "file_path": storage_reference,
            "total_records": len(
                dataframe
            ),
            "total_columns": len(
                dataframe.columns
            ),
            "upload_status": validation[
                "status"
            ],
        }

        try:
            response = (
                supabase
                .table("datasets")
                .insert(
                    dataset_payload
                )
                .execute()
            )

            if not response.data:
                raise HTTPException(
                    status_code=500,
                    detail=(
                        "Failed to save dataset metadata."
                    ),
                )

        except Exception:
            # Avoid orphaned storage objects when metadata persistence fails.
            try:
                DatasetStorageService.delete(
                    storage_reference
                )
            except Exception:
                pass

            raise

        dataset = cast(
            dict[str, Any],
            response.data[0],
        )

        preview_source = (
            dataframe
            .head(5)
            .copy()
        )

        preview = (
            preview_source
            .astype(object)
            .where(
                pd.notnull(
                    preview_source
                ),
                None,
            )
            .to_dict(
                orient="records"
            )
        )

        return clean_for_json(
            {
                "dataset": dataset,
                "preview": preview,
                "validation": validation,
                "mapping": mapping,
            }
        )

    @staticmethod
    def get_all_datasets():
        response = (
            supabase
            .table("datasets")
            .select(
                "*, clients(*)"
            )
            .order(
                "upload_date",
                desc=True,
            )
            .execute()
        )

        return (
            response.data
            or []
        )

    @staticmethod
    def get_dataset(
        dataset_id: str,
    ):
        response = (
            supabase
            .table("datasets")
            .select(
                "*, clients(*)"
            )
            .eq(
                "id",
                dataset_id,
            )
            .execute()
        )

        if not response.data:
            raise HTTPException(
                status_code=404,
                detail=(
                    "Dataset not found."
                ),
            )

        return cast(
            dict[str, Any],
            response.data[0],
        )

    @staticmethod
    def delete_dataset(
        dataset_id: str,
    ):
        dataset = cast(
            dict[str, Any],
            DatasetService
            .get_dataset(
                dataset_id
            ),
        )

        file_path = str(
            dataset.get(
                "file_path"
            )
            or ""
        )

        # Remove physical object before metadata so a storage failure does not
        # silently leave a database record pointing at nothing.
        if file_path:
            DatasetStorageService.delete(
                file_path
            )

        response = (
            supabase
            .table("datasets")
            .delete()
            .eq(
                "id",
                dataset_id,
            )
            .execute()
        )

        if not response.data:
            raise HTTPException(
                status_code=500,
                detail=(
                    "Failed to delete dataset metadata."
                ),
            )

        return {
            "message": (
                "Dataset deleted successfully."
            ),
            "dataset_id": dataset_id,
        }

    @staticmethod
    def cleanup_old_datasets(
        days: int = 30,
    ):
        if days < 1:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Cleanup days must be at least 1."
                ),
            )

        cutoff_date = (
            datetime.now()
            - timedelta(
                days=days
            )
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

        old_datasets = (
            old_response.data
            or []
        )

        deleted_count = 0

        for dataset_raw in old_datasets:
            dataset = cast(
                dict[str, Any],
                dataset_raw,
            )

            dataset_id = str(
                dataset.get("id")
                or ""
            )

            file_path = str(
                dataset.get(
                    "file_path"
                )
                or ""
            )

            if not dataset_id:
                continue

            if file_path:
                DatasetStorageService.delete(
                    file_path
                )

            (
                supabase
                .table("datasets")
                .delete()
                .eq(
                    "id",
                    dataset_id,
                )
                .execute()
            )

            deleted_count += 1

        return {
            "message": (
                f"Deleted {deleted_count} dataset(s) "
                f"older than {days} days."
            ),
            "deleted_count": deleted_count,
        }
