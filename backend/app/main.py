from __future__ import annotations

from fastapi import Depends, FastAPI

from .api.chat import router as chat_router
from .api.conversations import router as conversations_router
from .api.documents import router as documents_router
from .api.ingest import router as ingest_router
from .api.kb import router as kb_router
from .core.auth import get_current_user


def create_app() -> FastAPI:
    app = FastAPI(title="mini-rag-backend", dependencies=[Depends(get_current_user)])
    app.include_router(ingest_router)
    app.include_router(chat_router)
    app.include_router(conversations_router)
    app.include_router(kb_router)
    app.include_router(documents_router)
    return app


app = create_app()

