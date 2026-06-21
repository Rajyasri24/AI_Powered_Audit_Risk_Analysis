from fastapi import APIRouter

from app.services.analysis_services import AnalysisService


router = APIRouter(
    prefix="/analysis",
    tags=["Analysis"]
)


@router.post("/run/{dataset_id}")
def run_analysis(dataset_id: str):
    return AnalysisService.run_analysis(dataset_id)