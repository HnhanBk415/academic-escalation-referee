from pydantic import BaseModel


class DemoLecturerResponse(BaseModel):
    id: str
    display_name: str


class DemoGroupResponse(BaseModel):
    id: str
    name: str


class DemoCourseResponse(BaseModel):
    id: str
    code: str
    name: str
    semester: str
    groups: list[DemoGroupResponse]


class DemoCatalogResponse(BaseModel):
    lecturer: DemoLecturerResponse
    courses: list[DemoCourseResponse]
