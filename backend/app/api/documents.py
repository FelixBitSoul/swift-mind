from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Path
from pydantic import BaseModel

from ..core.auth import CurrentUser, get_current_user
from ..core.config import get_settings
from ..services.document_service import delete_document, get_document_detail

router = APIRouter()


class DeleteDocumentResponse(BaseModel):
    ok: bool


class DocumentOut(BaseModel):
    id: str
    kb_id: str
    title: str
    source: str | None = None
    mime_type: str | None = None
    bucket: str | None = None
    path: str | None = None
    status: str
    error: str | None = None
    created_at: str
    updated_at: str


class DocChunkOut(BaseModel):
    id: str
    kb_id: str
    doc_id: str
    chunk_index: int | None = None
    content: str
    metadata: dict | None = None
    created_at: str


class DocumentDetailResponse(BaseModel):
    document: DocumentOut
    chunks: list[DocChunkOut]


@router.get("/api/documents/{id}", response_model=DocumentDetailResponse)
async def get_document_route(
    id: str = Path(..., description="Document id"),
    user: CurrentUser = Depends(get_current_user),
) -> DocumentDetailResponse:
    try:
        settings = get_settings()
        data = await get_document_detail(settings=settings, user_id=user.user_id, doc_id=id)
        return DocumentDetailResponse(
            document=DocumentOut(**data["document"]),
            chunks=[DocChunkOut(**r) for r in (data["chunks"] or [])],
        )
    except Exception as e:
        msg = str(e)
        if "not found" in msg.lower():
            raise HTTPException(status_code=404, detail=msg) from e
        raise HTTPException(status_code=400, detail=msg) from e


@router.delete("/api/documents/{id}", response_model=DeleteDocumentResponse)
async def delete_document_route(
    id: str = Path(..., description="Document id"),
    user: CurrentUser = Depends(get_current_user),
) -> DeleteDocumentResponse:
    try:
        settings = get_settings()
        await delete_document(settings=settings, user_id=user.user_id, doc_id=id)
        return DeleteDocumentResponse(ok=True)
    except Exception as e:
        msg = str(e)
        if "not found" in msg.lower():
            raise HTTPException(status_code=404, detail=msg) from e
        raise HTTPException(status_code=400, detail=msg) from e

