from __future__ import annotations

from fastapi import FastAPI

from .api.ingest import router as ingest_router
from .api.chat import router as chat_router


def create_app() -> FastAPI:
    app = FastAPI(title="mini-rag-backend")
    app.include_router(ingest_router)
    app.include_router(chat_router)
    return app


app = create_app()

