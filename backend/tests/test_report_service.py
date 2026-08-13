import pytest
from fastapi import HTTPException

from app.services.report_service import ReportService


def test_report_latest_completed_per_dataset():
    analyses = [
        {
            "id": "old-d1",
            "dataset_id": "d1",
            "analysis_status": "COMPLETED",
            "created_at": "2026-08-10T09:00:00",
        },
        {
            "id": "new-d1",
            "dataset_id": "d1",
            "analysis_status": "COMPLETED",
            "created_at": "2026-08-12T09:00:00",
        },
        {
            "id": "failed-d2",
            "dataset_id": "d2",
            "analysis_status": "FAILED",
            "created_at": "2026-08-12T10:00:00",
        },
        {
            "id": "current-d2",
            "dataset_id": "d2",
            "analysis_status": "COMPLETED",
            "created_at": "2026-08-11T10:00:00",
        },
    ]

    result = ReportService._latest_completed_by_dataset(analyses)
    assert {item["id"] for item in result} == {"new-d1", "current-d2"}


def test_report_client_scope_requires_client_id():
    with pytest.raises(HTTPException):
        ReportService._validate_scope(
            report_type="client",
            client_id=None,
            dataset_id=None,
            analysis_id=None,
        )


def test_invalid_report_type_rejected():
    with pytest.raises(HTTPException):
        ReportService._validate_scope(
            report_type="unsupported",
            client_id=None,
            dataset_id=None,
            analysis_id=None,
        )
