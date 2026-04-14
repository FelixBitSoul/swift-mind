from __future__ import annotations

from typing import Any

import anyio
from supabase import Client

from ..core.config import Settings
from ..infra.supabase.client import get_supabase_client


def _supabase(settings: Settings) -> Client:
    return get_supabase_client(settings)


async def get_kb_documents(*, settings: Settings, user_id: str, kb_id: str) -> list[dict]:
    supabase = _supabase(settings)

    def _run() -> list[dict]:
        resp = (
            supabase.table("documents")
            .select("id,kb_id,title,source,mime_type,status,error,created_at,updated_at")
            .eq("kb_id", kb_id)
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .execute()
        )
        return [dict(r) for r in (resp.data or [])]

    return await anyio.to_thread.run_sync(_run)


async def delete_document(*, settings: Settings, user_id: str, doc_id: str) -> None:
    supabase = _supabase(settings)

    def _run() -> None:
        # 1) fetch document (discover storage location if present)
        doc_resp = (
            supabase.table("documents")
            .select("*")
            .eq("id", doc_id)
            .eq("user_id", user_id)
            .execute()
        )
        rows = doc_resp.data or []
        if not rows:
            raise RuntimeError("Document not found")
        doc = rows[0] if isinstance(rows[0], dict) else {}

        # 2) delete physical file (best-effort)
        bucket = doc.get("bucket") or doc.get("storage_bucket")
        path = doc.get("path") or doc.get("storage_path")
        if bucket and path:
            supabase.storage.from_(str(bucket)).remove([str(path)])

        # 3) delete chunks + doc row (scoped to user)
        supabase.table("doc_chunks").delete().eq("doc_id", doc_id).eq("user_id", user_id).execute()
        supabase.table("documents").delete().eq("id", doc_id).eq("user_id", user_id).execute()

    await anyio.to_thread.run_sync(_run)

