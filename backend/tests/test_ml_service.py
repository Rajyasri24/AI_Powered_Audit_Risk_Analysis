import pandas as pd

from app.services.ml_service import MLService


def sample_dataframe():
    return pd.DataFrame(
        {
            "transaction_id": [str(i) for i in range(1, 31)],
            "amount": [
                100, 101, 99, 102, 98, 105, 110, 95, 103, 100,
                99, 101, 98, 102, 97, 100, 104, 96, 103, 101,
                99, 98, 105, 100, 97, 102, 5000, 5200, 5400, 5600,
            ],
            "balance": [1000 + i for i in range(30)],
            "isFraud": [0] * 26 + [1, 1, 1, 1],
        }
    )


def test_ml_small_dataset_returns_empty():
    df = pd.DataFrame(
        {
            "transaction_id": ["1", "2", "3", "4"],
            "amount": [10, 20, 30, 40],
        }
    )
    assert MLService.detect_anomalies(df) == []


def test_ml_excludes_ids_and_labels():
    df = pd.DataFrame(
        {
            "transaction_id": [1, 2, 3, 4, 5],
            "amount": [10, 20, 30, 40, 50],
            "balance": [100, 200, 300, 400, 500],
            "isFraud": [0, 0, 0, 1, 1],
            "isFlaggedFraud": [0, 0, 0, 0, 1],
        }
    )
    prepared = MLService._prepare_numeric_features(df)
    assert list(prepared.columns) == ["amount", "balance"]


def test_ml_deterministic_same_input():
    df = sample_dataframe()
    assert MLService.detect_anomalies(df) == MLService.detect_anomalies(df)


def test_ml_output_has_ml_source():
    result = MLService.detect_anomalies(sample_dataframe())
    assert result
    assert all(item["detection_sources"] == ["ML"] for item in result)
