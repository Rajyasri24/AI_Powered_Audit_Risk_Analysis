from app.services.copilot_service import CopilotService
import app.api.network_routes as network_routes


def test_copilot_sanitizes_internal_terms():
    raw = (
        "According to CURRENT AUDIT DATA and priority_transaction_examples, "
        "the provided context contains the result."
    )
    cleaned = CopilotService._sanitize_answer(raw).lower()

    assert "current audit data" not in cleaned
    assert "priority_transaction_examples" not in cleaned
    assert "provided context" not in cleaned


def test_copilot_next_step_question_is_procedural():
    mode = CopilotService._response_mode(
        question="What should I do next for this finding?",
        intent="finding_explanation",
    )
    assert mode == "procedural"


def test_network_route_uses_network_service(monkeypatch):
    monkeypatch.setattr(
        network_routes.NetworkService,
        "analyse_dataset",
        lambda dataset_id: {
            "dataset_id": dataset_id,
            "suspicious_clusters": 2,
        },
    )

    result = network_routes.analyse_network("d1")
    assert result["dataset_id"] == "d1"
    assert result["suspicious_clusters"] == 2
