from __future__ import annotations

import argparse
import json

from app.evaluation.ml_evaluation import MLEvaluator


def main():
    parser = argparse.ArgumentParser(
        description=(
            "Evaluate AuditRisk AI anomaly detection "
            "against a labelled dataset."
        )
    )
    parser.add_argument(
        "dataset",
        help="Path to CSV/XLSX/JSON labelled dataset.",
    )
    parser.add_argument(
        "--label-column",
        default=None,
        help="Ground-truth label column. Auto-detected when omitted.",
    )
    args = parser.parse_args()

    dataframe = MLEvaluator.read_dataset(args.dataset)
    result = MLEvaluator.evaluate_dataframe(
        dataframe,
        label_column=args.label_column,
    )

    print(
        json.dumps(
            result.as_dict(),
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
