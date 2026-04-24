from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

from llama_index.core.schema import Document as LlamaDocument

from ..core.config import Settings
from ..infra.embeddings.siliconflow import get_siliconflow_embedding_model
from ..infra.parsing.pymupdf_reader import ParsedDocument
from ..infra.parsing.registry import ParserRegistry
from ..infra.splitting.registry import SplitterRegistry
from ..infra.supabase.client import get_supabase_client


@dataclass(frozen=True)
class IngestRequest:
    user_id: str
    kb_id: str
    doc_id: str
    bucket: str
    path: str
    filetype: str | None = None  # optional hint
    parser_config: dict[str, Any] | None = None  # {"parser_id": str, "params": dict}
    splitter_config: dict[str, Any] | None = None  # {"splitter_id": str, "params": dict}


@dataclass(frozen=True)
class IngestResult:
    page_count: int
    chunk_count: int


class IngestionService:
    def __init__(self, settings: Settings):
        self._settings = settings
        self._supabase = get_supabase_client(settings)
        self._embed_model = get_siliconflow_embedding_model(settings)
        options_path = Path(__file__).resolve().parents[1] / "config" / "ingest_options.yaml"
        self._parsers = ParserRegistry(options_path=options_path)
        self._splitters = SplitterRegistry(options_path=options_path, embed_model=self._embed_model)

    def _get_kb_ingest_config(self, *, user_id: str, kb_id: str) -> dict[str, Any] | None:
        resp = (
            self._supabase.table("knowledge_bases")
            .select("ingest_config")
            .eq("id", kb_id)
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        rows = resp.data or []
        if not rows:
            return None
        row = rows[0] if isinstance(rows[0], dict) else {}
        cfg = row.get("ingest_config")
        return cfg if isinstance(cfg, dict) else None

    def _resolve_config(self, *, req: IngestRequest, kb_config: dict[str, Any] | None) -> dict[str, Any]:
        system_defaults: dict[str, Any] = {
            "parser_id": "pymupdf",
            "parser_params": {},
            "splitter_id": "sentence",
            "splitter_params": {"chunk_size": 1024, "chunk_overlap": 128},
        }

        merged: dict[str, Any] = dict(system_defaults)
        if isinstance(kb_config, dict):
            merged.update({k: v for k, v in kb_config.items() if v is not None})

        if req.parser_config:
            if req.parser_config.get("parser_id") is not None:
                merged["parser_id"] = req.parser_config["parser_id"]
            if req.parser_config.get("params") is not None:
                merged["parser_params"] = req.parser_config.get("params") or {}

        if req.splitter_config:
            if req.splitter_config.get("splitter_id") is not None:
                merged["splitter_id"] = req.splitter_config["splitter_id"]
            if req.splitter_config.get("params") is not None:
                merged["splitter_params"] = req.splitter_config.get("params") or {}

        # Infer parser from suffix when not explicitly provided (system/kb/request all missing)
        suffix = Path(req.path).suffix.lower().lstrip(".")
        if not merged.get("parser_id"):
            merged["parser_id"] = self._parsers.get_for_format(suffix)
        elif merged.get("parser_id") in ("pymupdf", None) and suffix:
            # allow suffix-based pick when system default is still in place and file isn't pdf/md
            pid = self._parsers.get_for_format(suffix)
            if pid != "pymupdf":
                merged["parser_id"] = pid

        # Provide filetype hint to parsers that need it (pymupdf)
        merged.setdefault("parser_params", {})
        if isinstance(merged["parser_params"], dict):
            merged["parser_params"].setdefault("filetype", req.filetype or suffix or None)

        return merged

    def _write_chunks(self, *, req: IngestRequest, nodes, embeddings) -> None:
        # Ensure idempotency for re-ingestion
        (
            self._supabase.table("doc_chunks")
            .delete()
            .eq("doc_id", req.doc_id)
            .eq("user_id", req.user_id)
            .execute()
        )

        rows = []
        for i, n in enumerate(nodes):
            # store text in dedicated column, and keep metadata for retrieval filters
            rows.append(
                {
                    "user_id": req.user_id,
                    "kb_id": req.kb_id,
                    "doc_id": req.doc_id,
                    "chunk_index": i,
                    "content": n.get_content(metadata_mode="none"),
                    "metadata": dict(n.metadata or {}),
                    "embedding": embeddings[i],
                }
            )

        # Insert in batches to avoid payload limits
        batch_size = 200
        for start in range(0, len(rows), batch_size):
            self._supabase.table("doc_chunks").insert(rows[start : start + batch_size]).execute()

    def _parse_bytes(self, *, file_bytes: bytes, parser_id: str, parser_params: dict[str, Any]) -> ParsedDocument:
        parser = self._parsers.get(parser_id, parser_params or {})
        parsed = parser.parse(file_bytes, {})
        if not isinstance(parsed, ParsedDocument):
            raise RuntimeError("Parser returned invalid ParsedDocument")
        return parsed

    def ingest(self, req: IngestRequest) -> IngestResult:
        # Mark as processing (idempotent)
        (
            self._supabase.table("documents")
            .update({"status": "processing", "error": None})
            .eq("id", req.doc_id)
            .eq("user_id", req.user_id)
            .execute()
        )

        # 1) download from Supabase Storage
        data = self._supabase.storage.from_(req.bucket).download(req.path)
        if not isinstance(data, (bytes, bytearray)):
            raise RuntimeError("Supabase storage download did not return bytes")
        file_bytes = bytes(data)

        # 2) resolve config and parse
        kb_cfg = self._get_kb_ingest_config(user_id=req.user_id, kb_id=req.kb_id)
        resolved = self._resolve_config(req=req, kb_config=kb_cfg)
        parsed = self._parse_bytes(
            file_bytes=file_bytes,
            parser_id=str(resolved.get("parser_id") or "pymupdf"),
            parser_params=dict(resolved.get("parser_params") or {}),
        )
        if not parsed.text:
            raise RuntimeError("Parsed document is empty")

        # 3) split into nodes
        base_metadata = {"user_id": req.user_id, "kb_id": req.kb_id, "doc_id": req.doc_id}
        doc = LlamaDocument(text=parsed.text, metadata=base_metadata)
        splitter = self._splitters.get(
            str(resolved.get("splitter_id") or "sentence"),
            dict(resolved.get("splitter_params") or {}),
        )
        nodes = splitter.split(doc, {})

        # 4) embed via SiliconFlow (OpenAI-compatible, HTTP-only)
        texts = [n.get_content(metadata_mode="none") for n in nodes]
        embeddings = self._embed_model.get_text_embedding_batch(texts)
        if len(embeddings) != len(nodes):
            raise RuntimeError("Embedding batch size mismatch")
        for i, n in enumerate(nodes):
            n.embedding = embeddings[i]
            n.metadata.update(base_metadata)
            n.metadata["chunk_index"] = i

        # 5) write to Supabase `doc_chunks` table (pgvector(1024))
        self._write_chunks(req=req, nodes=nodes, embeddings=embeddings)

        # 6) update documents.status -> ready (+ persist effective ingest config)
        (
            self._supabase.table("documents")
            .update({"status": "ready", "error": None, "ingest_config": resolved})
            .eq("id", req.doc_id)
            .eq("user_id", req.user_id)
            .execute()
        )

        return IngestResult(page_count=parsed.page_count, chunk_count=len(nodes))

