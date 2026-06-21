from pydantic import BaseModel


class MappingResponse(BaseModel):
    mapping: dict