from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ..core.auth import CurrentUser, get_current_user
from ..core.config import get_settings
from ..services.ingestion_service import IngestionService, IngestRequest

router = APIRouter()


class ParserConfig(BaseModel):
    parser_id: str
    params: dict = {}


class SplitterConfig(BaseModel):
    splitter_id: str
    params: dict = {}


class IngestBody(BaseModel):
    kb_id: str
    doc_id: str
    bucket: str = Field(..., description="Supabase Storage bucket name")
    path: str = Field(..., description="Path in bucket")
    filetype: str | None = Field(None, description='Optional filetype hint (e.g. "pdf")')
    parser_config: ParserConfig | None = None
    splitter_config: SplitterConfig | None = None


class IngestResponse(BaseModel):
    page_count: int
    chunk_count: int


@router.post("/api/ingest", response_model=IngestResponse)
def ingest(body: IngestBody, user: CurrentUser = Depends(get_current_user)) -> IngestResponse:
    try:
        settings = get_settings()
        service = IngestionService(settings)
        result = service.ingest(
            IngestRequest(
                user_id=user.user_id,
                kb_id=body.kb_id,
                doc_id=body.doc_id,
                bucket=body.bucket,
                path=body.path,
                filetype=body.filetype,
                parser_config=body.parser_config.model_dump() if body.parser_config else None,
                splitter_config=body.splitter_config.model_dump() if body.splitter_config else None,
            )
        )
        return IngestResponse(page_count=result.page_count, chunk_count=result.chunk_count)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

