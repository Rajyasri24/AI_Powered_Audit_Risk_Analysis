from pydantic import BaseModel
from typing import Optional


class ClientCreate(BaseModel):
    client_code: str
    client_name: str
    industry: Optional[str] = None
    risk_profile: Optional[str] = None


class ClientResponse(BaseModel):
    id: str
    client_code: str
    client_name: str
    industry: Optional[str] = None
    risk_profile: Optional[str] = None
    client_status: str