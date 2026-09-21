from contextlib import asynccontextmanager
from pathlib import Path
from uuid import uuid4

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.ai.factory import build_ai_provider
from app.api.router import root_router
from app.core.config import get_settings
from app.core.errors import AppError, app_error_handler

WEB_DIST = Path(__file__).resolve().parents[2] / "web" / "dist"


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    if settings.embedding_dimensions != 768:
        raise RuntimeError("EMBEDDING_DIMENSIONS must be 768 for this index")
    app.state.ai_provider = build_ai_provider(settings)
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="Academic Escalation Referee",
        version="0.1.0",
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def request_id_middleware(request: Request, call_next):  # type: ignore[no-untyped-def]
        request.state.request_id = request.headers.get("X-Request-ID", f"req_{uuid4().hex}")
        response = await call_next(request)
        response.headers["X-Request-ID"] = request.state.request_id
        return response

    app.add_exception_handler(AppError, app_error_handler)  # type: ignore[arg-type]
    app.include_router(root_router)
    if (WEB_DIST / "assets").is_dir():
        app.mount("/assets", StaticFiles(directory=WEB_DIST / "assets"), name="web-assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_web(full_path: str):  # type: ignore[no-untyped-def]
        if full_path.startswith(("api/", "health/")) or not (WEB_DIST / "index.html").is_file():
            raise HTTPException(status_code=404, detail="Not found")
        return FileResponse(WEB_DIST / "index.html")

    return app


app = create_app()
