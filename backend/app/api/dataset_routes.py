from fastapi import APIRouter
from fastapi import File
from fastapi import Form
from fastapi import UploadFile

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
    return DatasetService.process_upload(
        client_id,
        file
    )