from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ..core.config import get_settings
from ..services.ingestion_service import IngestRequest, IngestionService


router = APIRouter()


class IngestBody(BaseModel):
    user_id: str = Field(..., description="Owner user id (auth.uid())")
    kb_id: str
    doc_id: str
    bucket: str = Field(..., description="Supabase Storage bucket name")
    path: str = Field(..., description="Path in bucket")
    filetype: str | None = Field(None, description='Optional filetype hint (e.g. "pdf")')


class IngestResponse(BaseModel):
    page_count: int
    chunk_count: int


@router.post("/api/ingest", response_model=IngestResponse)
def ingest(body: IngestBody) -> IngestResponse:
    try:
        settings = get_settings()
        service = IngestionService(settings)
        result = service.ingest(
            IngestRequest(
                user_id=body.user_id,
                kb_id=body.kb_id,
                doc_id=body.doc_id,
                bucket=body.bucket,
                path=body.path,
                filetype=body.filetype,
            )
        )
        return IngestResponse(page_count=result.page_count, chunk_count=result.chunk_count)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

