from fastapi import APIRouter, HTTPException

from app.services.analysis_services import AnalysisService


router = APIRouter(
    prefix="/analysis",
    tags=["Analysis"],
)


@router.post("/run/{dataset_id}")
def run_analysis(dataset_id: str):
    try:
        result = AnalysisService.run_analysis(dataset_id)

        if isinstance(result, dict) and result.get("error"):
            raise HTTPException(
                status_code=400,
                detail=str(result["error"]),
            )

        return result

    except HTTPException:
        raise

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Analysis failed: {str(error)}",
        ) from error


@router.get("/")
def get_analyses():
    try:
        return AnalysisService.get_all_analyses()

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to load analyses: {str(error)}",
        ) from error