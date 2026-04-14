from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Iterable, Iterator, Sequence

from llama_index.core.schema import NodeWithScore
from llama_index.core.vector_stores import MetadataFilter, MetadataFilters
from llama_index.core.vector_stores.types import FilterOperator
from llama_index.core.vector_stores.utils import node_to_metadata_dict
from llama_index.core.base.llms.types import ChatMessage, MessageRole
from llama_index.core.indices.vector_store import VectorStoreIndex
from llama_index.vector_stores.supabase import SupabaseVectorStore

from ..core.config import Settings
from ..infra.embeddings.siliconflow import get_siliconflow_embedding_model
from ..infra.llms.deepseek import get_deepseek_llm
from ..infra.supabase.client import get_supabase_client


@dataclass(frozen=True)
class ChatRequest:
    user_id: str
    conversation_id: str
    kb_ids: Sequence[str]
    message: str
    top_k: int = 5


class ChatService:
    def __init__(self, settings: Settings):
        self._settings = settings
        self._supabase = get_supabase_client(settings)
        self._embed_model = get_siliconflow_embedding_model(settings)
        self._llm = get_deepseek_llm(settings)
        self._vector_store = SupabaseVectorStore(
            supabase_client=self._supabase,
            table_name="doc_chunks",
        )
        self._index = VectorStoreIndex.from_vector_store(
            vector_store=self._vector_store,
            embed_model=self._embed_model,
        )

    def _load_history(self, *, user_id: str, conversation_id: str) -> list[ChatMessage]:
        resp = (
            self._supabase.table("messages")
            .select("role, content, created_at")
            .eq("conversation_id", conversation_id)
            .eq("user_id", user_id)
            .order("created_at", desc=False)
            .execute()
        )
        rows = resp.data or []
        messages: list[ChatMessage] = []
        for r in rows:
            role = r.get("role")
            content = r.get("content") or ""
            if role == "system":
                messages.append(ChatMessage(role=MessageRole.SYSTEM, content=content))
            elif role == "assistant":
                messages.append(ChatMessage(role=MessageRole.ASSISTANT, content=content))
            elif role == "tool":
                messages.append(ChatMessage(role=MessageRole.TOOL, content=content))
            else:
                messages.append(ChatMessage(role=MessageRole.USER, content=content))
        return messages

    def _retrieve(self, *, user_id: str, kb_ids: Sequence[str], query: str, top_k: int) -> list[NodeWithScore]:
        filters = MetadataFilters(
            filters=[
                MetadataFilter(key="user_id", value=user_id),
                MetadataFilter(key="kb_id", value=list(kb_ids), operator=FilterOperator.IN),
            ]
        )
        retriever = self._index.as_retriever(similarity_top_k=top_k, filters=filters)
        return list(retriever.retrieve(query))

    def _format_context(self, nodes: Sequence[NodeWithScore]) -> str:
        if not nodes:
            return ""
        parts: list[str] = []
        for i, nws in enumerate(nodes, start=1):
            n = nws.node
            meta = node_to_metadata_dict(n, remove_text=True, flat_metadata=True)
            parts.append(
                f"[{i}] score={nws.score}\n"
                f"metadata={json.dumps(meta, ensure_ascii=False)}\n"
                f"text=\n{n.get_content(metadata_mode='none')}".strip()
            )
        return "\n\n---\n\n".join(parts)

    def _persist_user_message(self, *, user_id: str, conversation_id: str, content: str) -> None:
        (
            self._supabase.table("messages")
            .insert(
                {
                    "conversation_id": conversation_id,
                    "user_id": user_id,
                    "role": "user",
                    "content": content,
                }
            )
            .execute()
        )

    def _persist_assistant_message(self, *, user_id: str, conversation_id: str, content: str) -> None:
        (
            self._supabase.table("messages")
            .insert(
                {
                    "conversation_id": conversation_id,
                    "user_id": user_id,
                    "role": "assistant",
                    "content": content,
                }
            )
            .execute()
        )

    def stream_chat(self, req: ChatRequest) -> Iterator[bytes]:
        """
        Yields Vercel AI SDK Data Stream Protocol parts:
          - text: 0:"token"\n
          - finish: d:{...}\n
        """
        # Persist user message immediately
        self._persist_user_message(
            user_id=req.user_id, conversation_id=req.conversation_id, content=req.message
        )

        history = self._load_history(user_id=req.user_id, conversation_id=req.conversation_id)
        nodes = self._retrieve(
            user_id=req.user_id, kb_ids=req.kb_ids, query=req.message, top_k=req.top_k
        )
        context = self._format_context(nodes)

        system = (
            "You are a helpful RAG assistant.\n"
            "Use the provided CONTEXT to answer. If the context is insufficient, say so.\n"
        )
        if context:
            system += f"\nCONTEXT:\n{context}\n"

        messages: list[ChatMessage] = [ChatMessage(role=MessageRole.SYSTEM, content=system)]
        messages.extend(history)
        messages.append(ChatMessage(role=MessageRole.USER, content=req.message))

        full_text_parts: list[str] = []
        try:
            stream = self._llm.stream_chat(messages)
            for event in stream:
                # LlamaIndex streaming events expose incremental text in different fields
                delta = getattr(event, "delta", None) or getattr(event, "message", None)
                if delta is None:
                    continue
                if hasattr(delta, "content"):
                    token = delta.content or ""
                else:
                    token = str(delta)
                if not token:
                    continue
                full_text_parts.append(token)
                payload = f'0:{json.dumps(token, ensure_ascii=False)}\n'
                yield payload.encode("utf-8")
        finally:
            full = "".join(full_text_parts).strip()
            if full:
                # Persist assistant message only once at end
                self._persist_assistant_message(
                    user_id=req.user_id, conversation_id=req.conversation_id, content=full
                )
            finish = 'd:{"finishReason":"stop","usage":{"promptTokens":0,"completionTokens":0}}\n'
            yield finish.encode("utf-8")

