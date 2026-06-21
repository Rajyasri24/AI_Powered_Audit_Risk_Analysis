from fastapi import APIRouter

from app.services.finding_service import FindingService


router = APIRouter(
    prefix="/findings",
    tags=["Findings"]
)


@router.get("/")
def get_all_findings():
    return FindingService.get_all_findings()


@router.get("/{analysis_id}")
def get_findings_by_analysis(analysis_id: str):
    return FindingService.get_findings_by_analysis(analysis_id)