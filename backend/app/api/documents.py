from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Path
from pydantic import BaseModel

from ..core.auth import CurrentUser, get_current_user
from ..core.config import get_settings
from ..services.document_service import delete_document


router = APIRouter()


class DeleteDocumentResponse(BaseModel):
    ok: bool


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

