from __future__ import annotations

from typing import Any

from llama_index.core.node_parser import SentenceSplitter as _SentenceSplitter
from llama_index.core.schema import BaseNode, Document as LlamaDocument

from .base import BaseSplitter


class SentenceSplitter(BaseSplitter):
    def split(self, doc: LlamaDocument, params: dict[str, Any]) -> list[BaseNode]:
        chunk_size = int(params.get("chunk_size", 1024))
        chunk_overlap = int(params.get("chunk_overlap", 128))
        splitter = _SentenceSplitter(chunk_size=chunk_size, chunk_overlap=chunk_overlap)
        return splitter.get_nodes_from_documents([doc])

