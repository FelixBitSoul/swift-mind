from __future__ import annotations

import json
import math
from dataclasses import dataclass
from typing import Iterator, Sequence

from llama_index.core.base.llms.types import ChatMessage, MessageRole
from llama_index.core.schema import NodeWithScore, TextNode
from llama_index.core.vector_stores.utils import node_to_metadata_dict

from ..core.config import Settings
from ..infra.embeddings.siliconflow import get_siliconflow_embedding_model
from ..infra.llms.deepseek import get_deepseek_llm
from ..infra.supabase.client import get_supabase_client
from ..utils.data_stream import ds_finish, ds_text
from .citations import build_citations


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

    @staticmethod
    def _cosine_similarity(a: Sequence[float], b: Sequence[float]) -> float:
        # Pure python cosine similarity (no heavy deps).
        # Returns 0.0 for degenerate vectors.
        if not a or not b or len(a) != len(b):
            return 0.0
        dot = 0.0
        na = 0.0
        nb = 0.0
        for x, y in zip(a, b, strict=False):
            xf = float(x)
            yf = float(y)
            dot += xf * yf
            na += xf * xf
            nb += yf * yf
        denom = math.sqrt(na) * math.sqrt(nb)
        return dot / denom if denom > 0 else 0.0

    @staticmethod
    def _coerce_embedding(value: object) -> list[float] | None:
        """
        Supabase/PostgREST may return pgvector as:
        - list[float] (ideal)
        - string like "[0.1, 0.2, ...]" or "{...}" depending on adapter
        """
        if isinstance(value, list) and value and isinstance(value[0], (int, float)):
            return [float(x) for x in value]
        if isinstance(value, str):
            s = value.strip()
            if not s:
                return None
            # Common pgvector string form: "[0.1,0.2,...]"
            if (s.startswith("[") and s.endswith("]")) or (s.startswith("{") and s.endswith("}")):
                try:
                    parsed = json.loads(s.replace("{", "[").replace("}", "]"))
                    if isinstance(parsed, list) and parsed:
                        return [float(x) for x in parsed]
                except Exception:
                    return None
        return None

    def _retrieve(
        self, *, user_id: str, kb_ids: Sequence[str], query: str, top_k: int
    ) -> list[NodeWithScore]:
        # NOTE: We avoid llama-index SupabaseVectorStore here because its API changed
        # to a `vecs` collection that requires a Postgres connection string.
        # For this MVP, we query `doc_chunks` directly via Supabase and rank in Python.
        if not kb_ids or not query.strip() or top_k <= 0:
            return []

        q_emb = self._embed_model.get_text_embedding(query)

        # Prefer server-side pgvector similarity if RPC is installed.
        try:
            rpc = self._supabase.rpc(
                "match_doc_chunks",
                {
                    "p_user_id": user_id,
                    "p_kb_ids": list(kb_ids),
                    "query_embedding": q_emb,
                    "match_count": int(top_k),
                },
            ).execute()
            rows = rpc.data or []
        except Exception:
            # Fallback: fetch a bounded candidate set and rank in Python.
            candidate_limit = max(500, min(4000, top_k * 400))
            resp = (
                self._supabase.table("doc_chunks")
                .select("id,kb_id,doc_id,chunk_index,content,metadata,embedding,created_at")
                .eq("user_id", user_id)
                .in_("kb_id", list(kb_ids))
                .order("created_at", desc=True)
                .limit(candidate_limit)
                .execute()
            )
            rows = resp.data or []

        scored: list[NodeWithScore] = []
        for r in rows:
            emb = self._coerce_embedding(r.get("embedding"))
            if not emb:
                continue

            score = (
                float(r.get("similarity") or 0.0)
                if "similarity" in r
                else self._cosine_similarity(q_emb, emb)
            )
            meta = r.get("metadata") if isinstance(r.get("metadata"), dict) else {}
            # Ensure core IDs are present for traceability.
            meta = {**meta, "user_id": user_id, "kb_id": r.get("kb_id"), "doc_id": r.get("doc_id")}
            node = TextNode(
                id_=str(r.get("id") or ""),
                text=str(r.get("content") or ""),
                metadata=meta,
            )
            scored.append(NodeWithScore(node=node, score=score))

        scored.sort(key=lambda x: float(x.score or 0.0), reverse=True)
        return scored[:top_k]

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

    def _persist_assistant_message(
        self, *, user_id: str, conversation_id: str, content: str
    ) -> None:
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

    def _load_doc_meta(self, *, user_id: str, doc_ids: Sequence[str]) -> dict[str, dict[str, str]]:
        uniq = [d for d in dict.fromkeys([x for x in doc_ids if x])]
        if not uniq:
            return {}
        resp = (
            self._supabase.table("documents")
            .select("id,title,source")
            .eq("user_id", user_id)
            .in_("id", uniq)
            .execute()
        )
        rows = resp.data or []
        out: dict[str, dict[str, str]] = {}
        for r in rows:
            did = str(r.get("id") or "")
            if not did:
                continue
            title = r.get("title")
            source = r.get("source")
            meta: dict[str, str] = {}
            if isinstance(title, str) and title:
                meta["title"] = title
            if isinstance(source, str) and source:
                meta["source"] = source
            out[did] = meta
        return out

    def stream_chat(self, req: ChatRequest) -> Iterator[bytes]:
        """
        Yields AI SDK Data Stream Protocol parts.
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
        doc_ids = [str((nws.node.metadata or {}).get("doc_id") or "") for nws in nodes]
        doc_meta_by_id = self._load_doc_meta(user_id=req.user_id, doc_ids=doc_ids)
        citations = build_citations(nodes, doc_meta_by_id=doc_meta_by_id)

        system = (
            "You are a helpful RAG assistant.\n"
            "Use the provided CONTEXT to answer. If the context is insufficient, say so.\n"
            "When you use information from the CONTEXT, cite it with footnote markers like [1].\n"
            "that refer to the numbered context items.\n"
        )
        if context:
            system += f"\nCONTEXT:\n{context}\n"

        messages: list[ChatMessage] = [ChatMessage(role=MessageRole.SYSTEM, content=system)]
        messages.extend(history)
        messages.append(ChatMessage(role=MessageRole.USER, content=req.message))

        full_text_parts: list[str] = []
        sent_finish = False
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
                yield ds_text(token)
            yield ds_finish({"citations": citations})
            sent_finish = True
        finally:
            full = "".join(full_text_parts).strip()
            if full:
                # Persist assistant message only once at end
                self._persist_assistant_message(
                    user_id=req.user_id, conversation_id=req.conversation_id, content=full
                )
            if not sent_finish:
                # Best-effort finish marker so the client can finalize state.
                yield ds_finish({"citations": citations})

