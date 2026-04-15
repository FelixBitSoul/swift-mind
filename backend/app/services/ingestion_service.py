from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from llama_index.core.node_parser import SentenceSplitter
from llama_index.core.schema import Document as LlamaDocument

from ..core.config import Settings
from ..infra.embeddings.siliconflow import get_siliconflow_embedding_model
from ..infra.parsing.pymupdf_reader import ParsedDocument, PyMuPDFReader
from ..infra.supabase.client import get_supabase_client


@dataclass(frozen=True)
class IngestRequest:
    user_id: str
    kb_id: str
    doc_id: str
    bucket: str
    path: str
    filetype: str | None = None  # "pdf" (PyMuPDF) or "md" / "markdown" (UTF-8 text)


@dataclass(frozen=True)
class IngestResult:
    page_count: int
    chunk_count: int


class IngestionService:
    def __init__(self, settings: Settings):
        self._settings = settings
        self._supabase = get_supabase_client(settings)
        self._embed_model = get_siliconflow_embedding_model(settings)
        self._reader = PyMuPDFReader()
        self._splitter = SentenceSplitter(chunk_size=1024, chunk_overlap=128)

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

    def _parse_bytes(self, file_bytes: bytes, req: IngestRequest) -> ParsedDocument:
        """Return ParsedDocument from pymupdf_reader (text + page_count)."""
        suffix = Path(req.path).suffix.lower()
        ft = (req.filetype or "").lower()
        if suffix in (".md", ".markdown") or ft in ("md", "markdown"):
            text = file_bytes.decode("utf-8", errors="replace").strip()
            if not text:
                raise RuntimeError("Parsed document is empty")
            return ParsedDocument(text=text, page_count=1)

        filetype = req.filetype or ("pdf" if suffix == ".pdf" else None)
        return self._reader.load_bytes(file_bytes, filetype=filetype)

    def ingest(self, req: IngestRequest) -> IngestResult:
        # 1) download from Supabase Storage
        data = self._supabase.storage.from_(req.bucket).download(req.path)
        if not isinstance(data, (bytes, bytearray)):
            raise RuntimeError("Supabase storage download did not return bytes")
        file_bytes = bytes(data)

        # 2) parse (PDF via PyMuPDF; Markdown as UTF-8 text)
        parsed = self._parse_bytes(file_bytes, req)
        if not parsed.text:
            raise RuntimeError("Parsed document is empty")

        # 3) split into nodes
        base_metadata = {"user_id": req.user_id, "kb_id": req.kb_id, "doc_id": req.doc_id}
        doc = LlamaDocument(text=parsed.text, metadata=base_metadata)
        nodes = self._splitter.get_nodes_from_documents([doc])

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

        # 6) update documents.status -> ready
        (
            self._supabase.table("documents")
            .update({"status": "ready", "error": None})
            .eq("id", req.doc_id)
            .eq("user_id", req.user_id)
            .execute()
        )

        return IngestResult(page_count=parsed.page_count, chunk_count=len(nodes))

