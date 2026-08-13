from __future__ import annotations

import json
import os
import re
from io import BytesIO, StringIO
from pathlib import Path
from typing import Any
from uuid import uuid4

import pandas as pd
from fastapi import HTTPException
from supabase import Client, create_client

from app.core.config import SUPABASE_URL


class DatasetStorageService:
    """
    Durable dataset storage abstraction.

    New uploads are stored in a private Supabase Storage bucket.
    Existing local file paths are still readable for backward compatibility.

    Stored database value format:
        storage://<bucket>/<object_path>
    """

    BUCKET_NAME = os.getenv(
        "SUPABASE_DATASET_BUCKET",
        "audit-datasets",
    ).strip() or "audit-datasets"

    STORAGE_PREFIX = "storage://"

    @staticmethod
    def _storage_client() -> Client:
        service_role_key = os.getenv(
            "SUPABASE_SERVICE_ROLE_KEY",
            "",
        ).strip()

        if not SUPABASE_URL or not SUPABASE_URL.strip():
            raise RuntimeError(
                "SUPABASE_URL is missing."
            )

        if not service_role_key:
            raise RuntimeError(
                "SUPABASE_SERVICE_ROLE_KEY is missing. "
                "Add it to the backend environment before using durable dataset storage."
            )

        return create_client(
            SUPABASE_URL.strip(),
            service_role_key,
        )

    @staticmethod
    def build_object_path(
        client_id: str,
        original_filename: str,
    ) -> str:
        safe_name = re.sub(
            r"[^A-Za-z0-9._-]+",
            "_",
            Path(original_filename).name,
        ).strip("._")

        if not safe_name:
            safe_name = "dataset"

        return (
            f"{client_id}/"
            f"{uuid4().hex}_{safe_name}"
        )

    @staticmethod
    def storage_uri(
        object_path: str,
    ) -> str:
        return (
            f"{DatasetStorageService.STORAGE_PREFIX}"
            f"{DatasetStorageService.BUCKET_NAME}/"
            f"{object_path}"
        )

    @staticmethod
    def is_storage_uri(
        value: str,
    ) -> bool:
        return str(value).startswith(
            DatasetStorageService.STORAGE_PREFIX
        )

    @staticmethod
    def parse_storage_uri(
        value: str,
    ) -> tuple[str, str]:
        if not DatasetStorageService.is_storage_uri(
            value
        ):
            raise ValueError(
                "Value is not a Supabase Storage URI."
            )

        remainder = value[
            len(
                DatasetStorageService.STORAGE_PREFIX
            ):
        ]

        bucket, separator, object_path = (
            remainder.partition("/")
        )

        if (
            not separator
            or not bucket
            or not object_path
        ):
            raise ValueError(
                "Invalid dataset storage URI."
            )

        return bucket, object_path

    @staticmethod
    def upload_bytes(
        *,
        client_id: str,
        original_filename: str,
        content: bytes,
        file_type: str,
    ) -> str:
        object_path = (
            DatasetStorageService
            .build_object_path(
                client_id,
                original_filename,
            )
        )

        mime_type = {
            "csv": "text/csv",
            "xlsx": (
                "application/vnd.openxmlformats-officedocument."
                "spreadsheetml.sheet"
            ),
            "json": "application/json",
        }.get(
            file_type.strip().lower(),
            "application/octet-stream",
        )

        try:
            (
                DatasetStorageService
                ._storage_client()
                .storage
                .from_(
                    DatasetStorageService
                    .BUCKET_NAME
                )
                .upload(
                    path=object_path,
                    file=BytesIO(content),
                    file_options={
                        "content-type": mime_type,
                        "upsert": "false",
                    },
                )
            )
        except Exception as exc:
            raise HTTPException(
                status_code=500,
                detail=(
                    "Dataset could not be stored in persistent storage. "
                    f"{str(exc)}"
                ),
            ) from exc

        return (
            DatasetStorageService
            .storage_uri(
                object_path
            )
        )

    @staticmethod
    def download_bytes(
        storage_uri: str,
    ) -> bytes:
        bucket, object_path = (
            DatasetStorageService
            .parse_storage_uri(
                storage_uri
            )
        )

        try:
            content = (
                DatasetStorageService
                ._storage_client()
                .storage
                .from_(bucket)
                .download(
                    object_path
                )
            )
        except Exception as exc:
            raise HTTPException(
                status_code=404,
                detail=(
                    "Stored dataset file could not be downloaded. "
                    f"{str(exc)}"
                ),
            ) from exc

        if isinstance(
            content,
            bytearray,
        ):
            return bytes(content)

        if isinstance(
            content,
            bytes,
        ):
            return content

        raise HTTPException(
            status_code=500,
            detail=(
                "Persistent storage returned an unexpected file format."
            ),
        )

    @staticmethod
    def delete(
        storage_reference: str,
    ) -> None:
        if not storage_reference:
            return

        if DatasetStorageService.is_storage_uri(
            storage_reference
        ):
            bucket, object_path = (
                DatasetStorageService
                .parse_storage_uri(
                    storage_reference
                )
            )

            try:
                (
                    DatasetStorageService
                    ._storage_client()
                    .storage
                    .from_(bucket)
                    .remove(
                        [object_path]
                    )
                )
            except Exception as exc:
                raise HTTPException(
                    status_code=500,
                    detail=(
                        "Stored dataset file could not be deleted. "
                        f"{str(exc)}"
                    ),
                ) from exc

            return

        # Backward compatibility for previously uploaded local files.
        path = Path(
            storage_reference
        )

        if path.exists():
            path.unlink()

    @staticmethod
    def read_dataframe(
        storage_reference: str,
        file_type: str,
    ) -> pd.DataFrame:
        normalized_type = (
            str(file_type)
            .strip()
            .lower()
        )

        if normalized_type not in {
            "csv",
            "xlsx",
            "json",
        }:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Unsupported dataset type."
                ),
            )

        if DatasetStorageService.is_storage_uri(
            storage_reference
        ):
            content = (
                DatasetStorageService
                .download_bytes(
                    storage_reference
                )
            )

            return (
                DatasetStorageService
                .dataframe_from_bytes(
                    content,
                    normalized_type,
                )
            )

        # Backward compatibility with old local-disk records.
        path = Path(
            storage_reference
        )

        if not path.exists():
            raise HTTPException(
                status_code=404,
                detail=(
                    "Dataset file was not found. "
                    "If this is an older deployment record, re-upload the dataset "
                    "so it is stored in persistent storage."
                ),
            )

        content = path.read_bytes()

        return (
            DatasetStorageService
            .dataframe_from_bytes(
                content,
                normalized_type,
            )
        )

    @staticmethod
    def dataframe_from_bytes(
        content: bytes,
        file_type: str,
    ) -> pd.DataFrame:
        normalized_type = (
            str(file_type)
            .strip()
            .lower()
        )

        if normalized_type == "csv":
            return (
                DatasetStorageService
                ._read_csv_bytes(
                    content
                )
            )

        if normalized_type == "xlsx":
            return pd.read_excel(
                BytesIO(content)
            )

        if normalized_type == "json":
            try:
                data: Any = json.loads(
                    content.decode(
                        "utf-8-sig"
                    )
                )
            except Exception as exc:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "JSON dataset could not be parsed."
                    ),
                ) from exc

            if isinstance(
                data,
                dict,
            ):
                if isinstance(
                    data.get("data"),
                    list,
                ):
                    data = data["data"]

                elif isinstance(
                    data.get("transactions"),
                    list,
                ):
                    data = data[
                        "transactions"
                    ]

                else:
                    data = [data]

            if not isinstance(
                data,
                list,
            ):
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "JSON dataset must contain a list of records."
                    ),
                )

            return pd.DataFrame(
                data
            )

        raise HTTPException(
            status_code=400,
            detail=(
                "Unsupported dataset type."
            ),
        )

    @staticmethod
    def _read_csv_bytes(
        content: bytes,
    ) -> pd.DataFrame:
        text = content.decode(
            "utf-8-sig"
        )

        try:
            dataframe = pd.read_csv(
                StringIO(text),
            )
        except Exception:
            dataframe = pd.read_csv(
                StringIO(text),
                sep=None,
                engine="python",
            )

        if len(
            dataframe.columns
        ) > 1:
            return dataframe

        if dataframe.empty:
            return dataframe

        first_column = str(
            dataframe.columns[0]
        )

        if "," not in first_column:
            return dataframe

        repaired_lines: list[str] = []

        for raw_line in text.splitlines():
            line = raw_line.strip()

            if (
                len(line) >= 2
                and line.startswith('"')
                and line.endswith('"')
            ):
                line = (
                    line[1:-1]
                    .replace(
                        '""',
                        '"',
                    )
                )

            repaired_lines.append(
                line
            )

        repaired = pd.read_csv(
            StringIO(
                "\n".join(
                    repaired_lines
                )
            )
        )

        if len(
            repaired.columns
        ) <= 1:
            raise HTTPException(
                status_code=400,
                detail=(
                    "CSV structure could not be parsed. "
                    "Please export using comma-separated columns."
                ),
            )

        return repaired
