from fastapi import APIRouter, HTTPException

from app.services.dashboard_service import DashboardService


router = APIRouter(
    prefix="/dashboard",
    tags=["Dashboard"],
)


@router.get("/summary")
def get_dashboard_summary():
    try:
        return DashboardService.get_summary()

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to load dashboard: {str(error)}",
        ) from error