from fastapi import APIRouter, File, Form, UploadFile

from app.services.dataset_service import DatasetService


router = APIRouter(
    prefix="/datasets",
    tags=["Datasets"]
)


@router.get("/")
def get_datasets():
    return DatasetService.get_all_datasets()


@router.post("/upload")
def upload_dataset(
    client_id: str = Form(...),
    file: UploadFile = File(...)
):
    return DatasetService.process_upload(client_id, file)


@router.delete("/cleanup-old/{days}")
def cleanup_old_datasets(days: int = 30):
    return DatasetService.cleanup_old_datasets(days)


@router.get("/{dataset_id}")
def get_dataset(dataset_id: str):
    return DatasetService.get_dataset(dataset_id)


@router.delete("/{dataset_id}")
def delete_dataset(dataset_id: str):
    return DatasetService.delete_dataset(dataset_id)