from __future__ import annotations

import mimetypes
import uuid

import anyio
from supabase import Client

from ..core.config import Settings
from ..infra.supabase.client import get_supabase_client
from .ingestion_service import IngestionService, IngestRequest


def _supabase(settings: Settings) -> Client:
    return get_supabase_client(settings)


def _guess_mime_type(filename: str) -> str | None:
    guessed, _enc = mimetypes.guess_type(filename)
    return guessed


_ALLOWED_DOC_EXT = frozenset({".pdf", ".md", ".markdown"})


def _safe_ext(filename: str) -> str:
    base = filename.rsplit("/", maxsplit=1)[-1]
    if "." not in base:
        return ""
    ext = "." + base.rsplit(".", maxsplit=1)[-1].lower()
    # Keep extension reasonably small/safe
    if len(ext) > 12:
        return ""
    return ext if ext in _ALLOWED_DOC_EXT else ""


async def _assert_kb_owned(*, settings: Settings, user_id: str, kb_id: str) -> None:
    supabase = _supabase(settings)

    def _run() -> None:
        resp = (
            supabase.table("knowledge_bases")
            .select("id")
            .eq("id", kb_id)
            .eq("user_id", user_id)
            .execute()
        )
        rows = resp.data or []
        if not rows:
            raise RuntimeError("Knowledge base not found")

    await anyio.to_thread.run_sync(_run)


async def upload_kb_document_file(
    *,
    settings: Settings,
    user_id: str,
    kb_id: str,
    filename: str,
    content_type: str | None,
    data: bytes,
) -> dict:
    if len(data) > settings.kb_document_max_bytes:
        raise RuntimeError(f"File too large (max {settings.kb_document_max_bytes} bytes)")

    await _assert_kb_owned(settings=settings, user_id=user_id, kb_id=kb_id)

    ext = _safe_ext(filename)
    mime = content_type or _guess_mime_type(filename) or "application/octet-stream"
    if ext != ".pdf" and mime == "application/pdf":
        ext = ".pdf"
    if not ext and mime in ("text/markdown", "text/x-markdown"):
        ext = ".md"
    if ext not in _ALLOWED_DOC_EXT:
        raise RuntimeError("Only PDF and Markdown (.md, .markdown) uploads are supported")

    if ext in (".md", ".markdown"):
        mime = content_type or _guess_mime_type(filename) or "text/markdown"
    elif ext == ".pdf":
        mime = content_type or _guess_mime_type(filename) or "application/pdf"

    ingest_filetype = "md" if ext in (".md", ".markdown") else "pdf"
    doc_id = str(uuid.uuid4())
    bucket = settings.kb_documents_bucket
    storage_path = f"{user_id}/{kb_id}/{doc_id}{ext}"

    supabase = _supabase(settings)

    def _insert_row() -> dict:
        resp = (
            supabase.table("documents")
            .insert(
                {
                    "id": doc_id,
                    "user_id": user_id,
                    "kb_id": kb_id,
                    "title": filename,
                    "source": filename,
                    "mime_type": mime,
                    "bucket": bucket,
                    "path": storage_path,
                    "status": "uploaded",
                    "error": None,
                }
            )
            .execute()
        )
        rows = resp.data or []
        if not rows:
            raise RuntimeError("Failed to create document row")
        return dict(rows[0])

    def _upload_storage() -> None:
        supabase.storage.from_(bucket).upload(
            storage_path,
            data,
            {
                "content-type": mime,
                # storage3 FileOptions uses string flags
                "upsert": "true",
            },
        )

    def _update_status(status: str, error: str | None) -> None:
        supabase.table("documents").update({"status": status, "error": error}).eq("id", doc_id).eq(
            "user_id", user_id
        ).execute()

    def _delete_chunks_best_effort() -> None:
        supabase.table("doc_chunks").delete().eq("doc_id", doc_id).eq("user_id", user_id).execute()

    await anyio.to_thread.run_sync(_insert_row)
    try:
        await anyio.to_thread.run_sync(_upload_storage)
        await anyio.to_thread.run_sync(_update_status, "processing", None)

        def _ingest() -> None:
            IngestionService(settings).ingest(
                IngestRequest(
                    user_id=user_id,
                    kb_id=kb_id,
                    doc_id=doc_id,
                    bucket=bucket,
                    path=storage_path,
                    filetype=ingest_filetype,
                )
            )

        await anyio.to_thread.run_sync(_ingest)

        def _fetch_row() -> dict:
            resp = (
                supabase.table("documents")
                .select("id,kb_id,title,source,mime_type,bucket,path,status,error,created_at,updated_at")
                .eq("id", doc_id)
                .eq("user_id", user_id)
                .execute()
            )
            rows = resp.data or []
            if not rows:
                raise RuntimeError("Document row missing after ingest")
            return dict(rows[0])

        return await anyio.to_thread.run_sync(_fetch_row)
    except Exception as e:
        await anyio.to_thread.run_sync(_delete_chunks_best_effort)
        await anyio.to_thread.run_sync(_update_status, "failed", str(e))
        raise


async def get_kb_documents(*, settings: Settings, user_id: str, kb_id: str) -> list[dict]:
    supabase = _supabase(settings)

    def _run() -> list[dict]:
        resp = (
            supabase.table("documents")
            .select("id,kb_id,title,source,mime_type,bucket,path,status,error,created_at,updated_at")
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


async def get_document_detail(
    *, settings: Settings, user_id: str, doc_id: str, chunk_limit: int = 2000
) -> dict:
    supabase = _supabase(settings)

    def _run() -> dict:
        doc_resp = (
            supabase.table("documents")
            .select("id,kb_id,title,source,mime_type,bucket,path,status,error,created_at,updated_at")
            .eq("id", doc_id)
            .eq("user_id", user_id)
            .execute()
        )
        doc_rows = doc_resp.data or []
        if not doc_rows:
            raise RuntimeError("Document not found")
        doc = dict(doc_rows[0]) if isinstance(doc_rows[0], dict) else {}

        chunks_resp = (
            supabase.table("doc_chunks")
            .select("id,kb_id,doc_id,chunk_index,content,metadata,created_at")
            .eq("doc_id", doc_id)
            .eq("user_id", user_id)
            .order("chunk_index", desc=False)
            .limit(int(chunk_limit))
            .execute()
        )
        chunks = [dict(r) for r in (chunks_resp.data or [])]

        return {"document": doc, "chunks": chunks}

    return await anyio.to_thread.run_sync(_run)

