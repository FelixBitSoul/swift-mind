from __future__ import annotations

from dataclasses import dataclass

from llama_index.core.node_parser import SentenceSplitter
from llama_index.core.schema import Document as LlamaDocument
from llama_index.vector_stores.supabase import SupabaseVectorStore

from ..core.config import Settings
from ..infra.embeddings.siliconflow import get_siliconflow_embedding_model
from ..infra.parsing.pymupdf_reader import PyMuPDFReader
from ..infra.supabase.client import get_supabase_client


@dataclass(frozen=True)
class IngestRequest:
    user_id: str
    kb_id: str
    doc_id: str
    bucket: str
    path: str
    filetype: str | None = None  # e.g. "pdf"


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
        self._vector_store = SupabaseVectorStore(
            supabase_client=self._supabase,
            table_name="doc_chunks",
        )

    def ingest(self, req: IngestRequest) -> IngestResult:
        # 1) download from Supabase Storage
        data = self._supabase.storage.from_(req.bucket).download(req.path)
        if not isinstance(data, (bytes, bytearray)):
            raise RuntimeError("Supabase storage download did not return bytes")
        file_bytes = bytes(data)

        # 2) parse via PyMuPDFReader
        parsed = self._reader.load_bytes(file_bytes, filetype=req.filetype)
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

        # 5) write to SupabaseVectorStore; tags injected via metadata (and optionally mapped server-side)
        self._vector_store.add(nodes)

        # 6) update documents.status -> ready
        (
            self._supabase.table("documents")
            .update({"status": "ready", "error": None})
            .eq("id", req.doc_id)
            .eq("user_id", req.user_id)
            .execute()
        )

        return IngestResult(page_count=parsed.page_count, chunk_count=len(nodes))

