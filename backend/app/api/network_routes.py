from fastapi import APIRouter, HTTPException

from app.services.network_service import NetworkService


router = APIRouter(
    prefix="/network",
    tags=["Network Analytics"],
)


@router.get("/datasets")
def get_network_datasets():
    try:
        return NetworkService.get_available_datasets()
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to load datasets: {str(error)}",
        ) from error


@router.get("/analyse/{dataset_id}")
def analyse_network(dataset_id: str):
    try:
        return NetworkService.analyse_dataset(dataset_id)
    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        ) from error
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Network analysis failed: {str(error)}",
        ) from error