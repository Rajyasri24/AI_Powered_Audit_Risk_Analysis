import json
from types import SimpleNamespace

import pandas as pd
import pytest
from fastapi import HTTPException

import app.services.analysis_services as analysis_module
from app.services.analysis_services import AnalysisService


@pytest.mark.parametrize(
    ("score", "expected"),
    [
        (20, "Low"),
        (21, "Medium"),
        (51, "High"),
        (76, "Critical"),
    ],
)
def test_risk_level_boundaries(score, expected):
    assert AnalysisService.calculate_risk_level(score) == expected


def test_transaction_id_normalization():
    assert AnalysisService.normalize_transaction_id("9944.0") == "9944"


def test_merge_rule_ml_network_scores():
    result = AnalysisService.merge_rule_ml_network_findings(
        rule_findings=[
            {
                "transaction_id": "TXN001",
                "rule_score": 15,
                "triggered_rules": ["High Value Transaction"],
                "reasons": "Threshold exceeded.",
            }
        ],
        ml_findings=[
            {
                "transaction_id": "TXN001",
                "anomaly_score": 10,
                "anomaly_reasons": ["Unusual behaviour."],
            }
        ],
        network_findings=[
            {
                "transaction_id": "TXN001",
                "network_score": 12,
                "network_reasons": ["Shared bank account."],
            }
        ],
    )

    finding = result[0]
    assert finding["risk_score"] == 37
    assert finding["risk_level"] == "Medium"
    assert finding["detection_sources"] == ["RULE", "ML", "NETWORK"]


class Query:
    def __init__(self, rows):
        self.rows = rows

    def select(self, *_args, **_kwargs):
        return self

    def order(self, *_args, **_kwargs):
        return self

    def execute(self):
        return SimpleNamespace(data=self.rows)


class FakeSupabase:
    def __init__(self, rows):
        self.rows = rows

    def table(self, name):
        assert name == "analyses"
        return Query(self.rows)


def test_latest_completed_analysis_per_dataset(monkeypatch):
    rows = [
        {
            "id": "new-d1",
            "dataset_id": "d1",
            "analysis_status": "COMPLETED",
            "created_at": "2026-08-12T12:00:00",
        },
        {
            "id": "failed-d2",
            "dataset_id": "d2",
            "analysis_status": "FAILED",
            "created_at": "2026-08-12T11:30:00",
        },
        {
            "id": "new-d2",
            "dataset_id": "d2",
            "analysis_status": "COMPLETED",
            "created_at": "2026-08-12T11:00:00",
        },
        {
            "id": "old-d1",
            "dataset_id": "d1",
            "analysis_status": "COMPLETED",
            "created_at": "2026-08-11T09:00:00",
        },
    ]

    monkeypatch.setattr(
        analysis_module,
        "supabase",
        FakeSupabase(rows),
    )

    result = AnalysisService.get_all_analyses()

    assert {item["id"] for item in result} == {"new-d1", "new-d2"}


def test_csv_loading(tmp_path):
    path = tmp_path / "sample.csv"
    path.write_text(
        "transaction_id,amount\nTXN001,100\nTXN002,200\n",
        encoding="utf-8",
    )
    result = AnalysisService.read_dataset(str(path), "csv")
    assert len(result) == 2


def test_json_loading(tmp_path):
    path = tmp_path / "sample.json"
    path.write_text(
        json.dumps(
            {
                "transactions": [
                    {"transaction_id": "TXN001", "amount": 100},
                    {"transaction_id": "TXN002", "amount": 200},
                ]
            }
        ),
        encoding="utf-8",
    )
    result = AnalysisService.read_dataset(str(path), "json")
    assert len(result) == 2


def test_xlsx_loading(tmp_path):
    path = tmp_path / "sample.xlsx"
    pd.DataFrame(
        {
            "transaction_id": ["TXN001", "TXN002"],
            "amount": [100, 200],
        }
    ).to_excel(path, index=False)

    result = AnalysisService.read_dataset(str(path), "xlsx")
    assert len(result) == 2


def test_unsupported_file_type_rejected(tmp_path):
    path = tmp_path / "sample.txt"
    path.write_text("sample", encoding="utf-8")

    with pytest.raises(HTTPException) as exc_info:
        AnalysisService.read_dataset(str(path), "txt")

    assert exc_info.value.status_code == 400
