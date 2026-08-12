from __future__ import annotations

from dataclasses import dataclass
from typing import Any, cast

from fastapi import HTTPException, Request

from app.core.supabase_client import supabase


ADMIN = "Admin"
AUDIT_MANAGER = "Audit Manager"
AUDITOR = "Auditor"

VALID_ROLES = {
    ADMIN,
    AUDIT_MANAGER,
    AUDITOR,
}


@dataclass(frozen=True)
class AuthenticatedUser:
    id: str
    email: str
    full_name: str
    role: str
    status: str


def _extract_bearer_token(request: Request) -> str:
    header = (request.headers.get("Authorization") or "").strip()

    if not header:
        raise HTTPException(status_code=401, detail="Authentication token is required.")

    parts = header.split(" ", 1)

    if len(parts) != 2 or parts[0].lower() != "bearer" or not parts[1].strip():
        raise HTTPException(status_code=401, detail="Invalid authorization header.")

    return parts[1].strip()


def authenticate_request(request: Request) -> AuthenticatedUser:
    token = _extract_bearer_token(request)

    try:
        user_response = supabase.auth.get_user(token)
    except Exception as exc:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired authentication token.",
        ) from exc

    user = getattr(user_response, "user", None)
    user_id = getattr(user, "id", None)
    user_email = getattr(user, "email", "")

    if not user_id:
        raise HTTPException(
            status_code=401,
            detail="Authenticated user could not be resolved.",
        )

    response = (
        supabase.table("profiles")
        .select("id, email, full_name, role, status")
        .eq("id", str(user_id))
        .execute()
    )

    rows = cast(list[dict[str, Any]], response.data or [])

    if not rows:
        raise HTTPException(status_code=403, detail="User profile is not configured.")

    profile = rows[0]
    role = str(profile.get("role") or "")
    status = str(profile.get("status") or "")

    if status != "Active":
        raise HTTPException(status_code=403, detail="This account is inactive.")

    if role not in VALID_ROLES:
        raise HTTPException(
            status_code=403,
            detail="This account does not have a valid role.",
        )

    return AuthenticatedUser(
        id=str(user_id),
        email=str(profile.get("email") or user_email or ""),
        full_name=str(profile.get("full_name") or ""),
        role=role,
        status=status,
    )


def allowed_roles_for_request(request: Request) -> set[str]:
    path = request.url.path
    method = request.method.upper()

    all_roles = {ADMIN, AUDIT_MANAGER, AUDITOR}
    admin_only = {ADMIN}
    auditor_work = {ADMIN, AUDITOR}

    if path.startswith("/settings") or path.startswith("/admin"):
        return admin_only

    if path.startswith("/clients"):
        return all_roles if method in {"GET", "HEAD"} else admin_only

    if path.startswith("/rules") or path.startswith("/client-rules"):
        return all_roles if method in {"GET", "HEAD"} else auditor_work

    if path.startswith("/datasets"):
        return all_roles if method in {"GET", "HEAD"} else auditor_work

    if path.startswith("/analysis"):
        return all_roles if method in {"GET", "HEAD"} else auditor_work

    if (
        path.startswith("/dashboard")
        or path.startswith("/findings")
        or path.startswith("/network")
        or path.startswith("/reports")
        or path.startswith("/copilot")
    ):
        return all_roles

    return all_roles


def enforce_rbac(request: Request) -> AuthenticatedUser:
    user = authenticate_request(request)
    allowed_roles = allowed_roles_for_request(request)

    if user.role not in allowed_roles:
        raise HTTPException(
            status_code=403,
            detail="You do not have permission to perform this action.",
        )

    return user
