from __future__ import annotations

from fastapi import APIRouter, Depends, File, HTTPException, Path, UploadFile
from pydantic import BaseModel, Field

from ..core.auth import CurrentUser, get_current_user
from ..core.config import get_settings
from ..services.document_service import get_kb_documents, upload_kb_document_file
from ..services.kb_service import create_kb, delete_kb, get_user_kbs, update_kb

router = APIRouter()


class KnowledgeBaseOut(BaseModel):
    id: str
    name: str
    description: str | None = None
    ingest_config: dict | None = None
    created_at: str
    updated_at: str


class ListKnowledgeBasesResponse(BaseModel):
    data: list[KnowledgeBaseOut]


class CreateKnowledgeBaseBody(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: str | None = Field(None, max_length=2000)


class UpdateKnowledgeBaseBody(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=200)
    description: str | None = Field(None, max_length=2000)
    ingest_config: dict | None = None


class DeleteKnowledgeBaseResponse(BaseModel):
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


class ListDocumentsResponse(BaseModel):
    data: list[DocumentOut]


class UploadDocumentsResponse(BaseModel):
    data: list[DocumentOut]


@router.post("/api/kb", response_model=KnowledgeBaseOut)
async def post_kb(
    body: CreateKnowledgeBaseBody,
    user: CurrentUser = Depends(get_current_user),
) -> KnowledgeBaseOut:
    try:
        settings = get_settings()
        row = await create_kb(
            settings=settings,
            user_id=user.user_id,
            name=body.name,
            description=body.description,
        )
        return KnowledgeBaseOut(**row)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.get("/api/kb", response_model=ListKnowledgeBasesResponse)
async def list_kbs(user: CurrentUser = Depends(get_current_user)) -> ListKnowledgeBasesResponse:
    try:
        settings = get_settings()
        rows = await get_user_kbs(
            settings=settings,
            user_id=user.user_id,
            order_by_created_at_desc=True,
        )
        return ListKnowledgeBasesResponse(data=[KnowledgeBaseOut(**r) for r in rows])
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.patch("/api/kb/{id}", response_model=KnowledgeBaseOut)
async def patch_kb(
    body: UpdateKnowledgeBaseBody,
    id: str = Path(..., description="Knowledge base id"),
    user: CurrentUser = Depends(get_current_user),
) -> KnowledgeBaseOut:
    if body.name is None and body.description is None and body.ingest_config is None:
        raise HTTPException(
            status_code=422, detail="At least one of name/description/ingest_config is required"
        )
    try:
        settings = get_settings()
        row = await update_kb(
            settings=settings,
            user_id=user.user_id,
            kb_id=id,
            name=body.name,
            description=body.description,
            ingest_config=body.ingest_config,
        )
        return KnowledgeBaseOut(**row)
    except Exception as e:
        msg = str(e)
        if "not found" in msg.lower():
            raise HTTPException(status_code=404, detail=msg) from e
        raise HTTPException(status_code=400, detail=msg) from e


@router.delete("/api/kb/{id}", response_model=DeleteKnowledgeBaseResponse)
async def delete_kb_route(
    id: str = Path(..., description="Knowledge base id"),
    user: CurrentUser = Depends(get_current_user),
) -> DeleteKnowledgeBaseResponse:
    try:
        settings = get_settings()
        await delete_kb(settings=settings, user_id=user.user_id, kb_id=id)
        return DeleteKnowledgeBaseResponse(ok=True)
    except Exception as e:
        msg = str(e)
        if "not found" in msg.lower():
            raise HTTPException(status_code=404, detail=msg) from e
        raise HTTPException(status_code=400, detail=msg) from e


@router.get("/api/kb/{id}/documents", response_model=ListDocumentsResponse)
async def list_kb_documents(
    id: str = Path(..., description="Knowledge base id"),
    user: CurrentUser = Depends(get_current_user),
) -> ListDocumentsResponse:
    try:
        settings = get_settings()
        rows = await get_kb_documents(settings=settings, user_id=user.user_id, kb_id=id)
        return ListDocumentsResponse(data=[DocumentOut(**r) for r in rows])
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.post("/api/kb/{id}/documents", response_model=UploadDocumentsResponse)
async def upload_kb_documents(
    id: str = Path(..., description="Knowledge base id"),
    files: list[UploadFile] = File(..., description="One or more files to upload"),
    user: CurrentUser = Depends(get_current_user),
) -> UploadDocumentsResponse:
    if not files:
        raise HTTPException(status_code=422, detail="No files uploaded")
    try:
        settings = get_settings()
        out_rows: list[dict] = []
        for f in files:
            raw = await f.read()
            row = await upload_kb_document_file(
                settings=settings,
                user_id=user.user_id,
                kb_id=id,
                filename=f.filename or "upload.pdf",
                content_type=f.content_type,
                data=raw,
            )
            out_rows.append(row)
        return UploadDocumentsResponse(data=[DocumentOut(**r) for r in out_rows])
    except Exception as e:
        msg = str(e)
        if "not found" in msg.lower():
            raise HTTPException(status_code=404, detail=msg) from e
        raise HTTPException(status_code=400, detail=msg) from e

