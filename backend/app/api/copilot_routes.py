from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from app.services.copilot_service import CopilotService

router = APIRouter(prefix="/copilot", tags=["AI Copilot"])


class CopilotQuestion(BaseModel):
    question: str = Field(..., min_length=2, max_length=3000)
    client_id: str | None = None
    dataset_id: str | None = None
    transaction_id: str | None = None


@router.get("/context")
def get_copilot_context():
    return CopilotService.get_selector_context()


@router.get("/history")
def get_copilot_history(request: Request, limit: int = 20):
    user = getattr(request.state, "user", None)
    user_id = getattr(user, "id", None) if user else None
    return CopilotService.get_history(user_id=user_id, limit=max(1, min(limit, 50)))


@router.post("/ask")
def ask_copilot(payload: CopilotQuestion, request: Request):
    user = getattr(request.state, "user", None)
    user_id = getattr(user, "id", None) if user else None
    user_role = getattr(user, "role", None) if user else None

    try:
        return CopilotService.ask(
            question=payload.question,
            client_id=payload.client_id,
            dataset_id=payload.dataset_id,
            transaction_id=payload.transaction_id,
            user_id=user_id,
            user_role=user_role,
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"AI Copilot could not complete the request. {str(exc)}",
        ) from exc
