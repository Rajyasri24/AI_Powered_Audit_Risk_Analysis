from fastapi import APIRouter

from app.schemas.client_schema import ClientCreate
from app.services.client_service import ClientService

router = APIRouter(
    prefix="/clients",
    tags=["Clients"]
)


@router.post("/")
def create_client(client: ClientCreate):

    return ClientService.create_client(
        client.model_dump()
    )


@router.get("/")
def get_clients():

    return ClientService.get_all_clients()


@router.get("/{client_id}")
def get_client(client_id: str):

    return ClientService.get_client(client_id)


@router.delete("/{client_id}")
def delete_client(client_id: str):

    return ClientService.delete_client(client_id)