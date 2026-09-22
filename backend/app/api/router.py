from fastapi import APIRouter

from app.api.routes import audit, cases, demo, documents, exceptions, health, questions

api_router = APIRouter()
api_router.include_router(documents.router, prefix="/documents", tags=["documents"])
api_router.include_router(questions.router, prefix="/questions", tags=["questions"])
api_router.include_router(cases.router, prefix="/cases", tags=["cases"])
api_router.include_router(exceptions.router, prefix="/exceptions", tags=["exceptions"])
api_router.include_router(audit.router, prefix="/audit", tags=["audit"])
api_router.include_router(demo.router, prefix="/demo", tags=["demo"])

root_router = APIRouter()
root_router.include_router(health.router, tags=["health"])
root_router.include_router(api_router, prefix="/api")
root_router.include_router(api_router, prefix="/api/v1")
