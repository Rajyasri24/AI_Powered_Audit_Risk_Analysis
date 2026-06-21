from pydantic import BaseModel


class DatasetResponse(BaseModel):
    dataset_id: str
    dataset_name: str
    file_type: str
    total_records: int
    total_columns: int
    upload_status: str