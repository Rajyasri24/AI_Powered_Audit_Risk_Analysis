from starlette.requests import Request

from app.core.rbac import (
    ADMIN,
    AUDIT_MANAGER,
    AUDITOR,
    allowed_roles_for_request,
)


def make_request(path: str, method: str = "GET") -> Request:
    return Request(
        {
            "type": "http",
            "method": method,
            "path": path,
            "raw_path": path.encode(),
            "query_string": b"",
            "headers": [],
            "scheme": "http",
            "server": ("testserver", 80),
            "client": ("127.0.0.1", 12345),
        }
    )


def test_dashboard_access_all_roles():
    assert allowed_roles_for_request(
        make_request("/dashboard/summary", "GET")
    ) == {ADMIN, AUDIT_MANAGER, AUDITOR}


def test_client_read_all_roles():
    assert allowed_roles_for_request(
        make_request("/clients/", "GET")
    ) == {ADMIN, AUDIT_MANAGER, AUDITOR}


def test_client_mutation_admin_only():
    assert allowed_roles_for_request(
        make_request("/clients/", "POST")
    ) == {ADMIN}


def test_rule_mutation_admin_and_auditor():
    assert allowed_roles_for_request(
        make_request("/client-rules/custom", "POST")
    ) == {ADMIN, AUDITOR}


def test_dataset_mutation_admin_and_auditor():
    assert allowed_roles_for_request(
        make_request("/datasets/upload", "POST")
    ) == {ADMIN, AUDITOR}


def test_analysis_execution_admin_and_auditor():
    assert allowed_roles_for_request(
        make_request("/analysis/run/dataset-1", "POST")
    ) == {ADMIN, AUDITOR}
