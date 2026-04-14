from __future__ import annotations

from typing import Any

import anyio
from supabase import Client

from ..core.config import Settings
from ..infra.supabase.client import get_supabase_client


def _supabase(settings: Settings) -> Client:
    return get_supabase_client(settings)


async def create_kb(*, settings: Settings, user_id: str, name: str, description: str | None) -> dict:
    supabase = _supabase(settings)

    def _run() -> dict:
        resp = (
            supabase.table("knowledge_bases")
            .insert({"user_id": user_id, "name": name, "description": description})
            .execute()
        )
        rows = resp.data or []
        if not rows:
            raise RuntimeError("Failed to create knowledge base")
        return dict(rows[0])

    return await anyio.to_thread.run_sync(_run)


async def get_user_kbs(
    *,
    settings: Settings,
    user_id: str,
    order_by_created_at_desc: bool = True,
) -> list[dict]:
    supabase = _supabase(settings)

    def _run() -> list[dict]:
        resp = (
            supabase.table("knowledge_bases")
            .select("id,name,description,created_at,updated_at")
            .eq("user_id", user_id)
            .order("created_at", desc=order_by_created_at_desc)
            .execute()
        )
        return [dict(r) for r in (resp.data or [])]

    return await anyio.to_thread.run_sync(_run)


async def update_kb(
    *,
    settings: Settings,
    user_id: str,
    kb_id: str,
    name: str | None = None,
    description: str | None = None,
) -> dict:
    supabase = _supabase(settings)

    payload: dict[str, Any] = {}
    if name is not None:
        payload["name"] = name
    if description is not None:
        payload["description"] = description
    if not payload:
        raise RuntimeError("No fields to update")

    def _run() -> dict:
        resp = (
            supabase.table("knowledge_bases")
            .update(payload)
            .eq("id", kb_id)
            .eq("user_id", user_id)
            .execute()
        )
        rows = resp.data or []
        if not rows:
            raise RuntimeError("Knowledge base not found")
        return dict(rows[0])

    return await anyio.to_thread.run_sync(_run)


async def delete_kb(*, settings: Settings, user_id: str, kb_id: str) -> None:
    supabase = _supabase(settings)

    def _run() -> None:
        # 1) fetch documents first (to discover possible storage object paths)
        docs_resp = (
            supabase.table("documents").select("*").eq("kb_id", kb_id).eq("user_id", user_id).execute()
        )
        docs = docs_resp.data or []

        # 2) delete physical files in Supabase Storage (best-effort only when info exists)
        by_bucket: dict[str, list[str]] = {}
        for d in docs:
            if not isinstance(d, dict):
                continue
            bucket = d.get("bucket") or d.get("storage_bucket")
            path = d.get("path") or d.get("storage_path")
            if bucket and path:
                by_bucket.setdefault(str(bucket), []).append(str(path))

        for bucket, paths in by_bucket.items():
            # Supabase storage remove expects a list of paths
            supabase.storage.from_(bucket).remove(paths)

        # 3) remove rows (explicit cleanup; cascades would also handle this)
        supabase.table("doc_chunks").delete().eq("kb_id", kb_id).eq("user_id", user_id).execute()
        supabase.table("documents").delete().eq("kb_id", kb_id).eq("user_id", user_id).execute()

        # 4) finally delete knowledge base
        kb_del = (
            supabase.table("knowledge_bases")
            .delete()
            .eq("id", kb_id)
            .eq("user_id", user_id)
            .execute()
        )
        if not (kb_del.data or []):
            raise RuntimeError("Knowledge base not found")

    await anyio.to_thread.run_sync(_run)

