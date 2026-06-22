from fastapi import APIRouter

from app.services.dashboard_service import DashboardService


router = APIRouter(
    prefix="/dashboard",
    tags=["Dashboard"]
)


@router.get("/summary")
def get_dashboard_summary():
    return DashboardService.get_summary()