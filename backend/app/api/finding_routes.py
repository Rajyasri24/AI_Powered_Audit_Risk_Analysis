from fastapi import APIRouter, HTTPException

from app.services.finding_service import FindingService

router = APIRouter(
    prefix="/findings",
    tags=["Findings"]
)


@router.get("/")
def get_findings():
    return FindingService.get_all_findings()


@router.get("/{finding_id}")
def get_finding(finding_id: str):
    finding = FindingService.get_finding(finding_id)

    if not finding:
        raise HTTPException(
            status_code=404,
            detail="Finding not found"
        )

    return finding