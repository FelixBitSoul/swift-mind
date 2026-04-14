from __future__ import annotations

from typing import Sequence

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from ..core.config import get_settings
from ..services.chat_service import ChatRequest, ChatService


router = APIRouter()


class ChatBody(BaseModel):
    user_id: str = Field(..., description="Owner user id (auth.uid())")
    conversation_id: str
    kb_ids: Sequence[str] = Field(default_factory=list)
    message: str
    top_k: int = 5


@router.post("/api/chat")
def chat(body: ChatBody) -> StreamingResponse:
    settings = get_settings()
    service = ChatService(settings)

    gen = service.stream_chat(
        ChatRequest(
            user_id=body.user_id,
            conversation_id=body.conversation_id,
            kb_ids=body.kb_ids,
            message=body.message,
            top_k=body.top_k,
        )
    )

    return StreamingResponse(
        gen,
        media_type="text/plain; charset=utf-8",
        headers={"x-vercel-ai-data-stream": "v1"},
    )

