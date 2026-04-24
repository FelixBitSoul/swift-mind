from __future__ import annotations

from typing import Any

from llama_index.core.schema import BaseNode, Document as LlamaDocument

from .base import BaseSplitter


class TokenSplitter(BaseSplitter):
    def split(self, doc: LlamaDocument, params: dict[str, Any]) -> list[BaseNode]:
        chunk_size = int(params.get("chunk_size", 512))
        chunk_overlap = int(params.get("chunk_overlap", 64))
        try:
            from llama_index.core.node_parser import TokenTextSplitter
        except Exception as e:  # pragma: no cover
            raise RuntimeError("TokenTextSplitter is not available in current llama-index-core") from e
        splitter = TokenTextSplitter(chunk_size=chunk_size, chunk_overlap=chunk_overlap)
        return splitter.get_nodes_from_documents([doc])

