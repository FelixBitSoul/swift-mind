from __future__ import annotations

from typing import Any

from llama_index.core.schema import BaseNode, Document as LlamaDocument

from .base import BaseSplitter


class SemanticSplitter(BaseSplitter):
    def __init__(self, *, embed_model) -> None:
        self._embed_model = embed_model

    def split(self, doc: LlamaDocument, params: dict[str, Any]) -> list[BaseNode]:
        threshold = int(params.get("breakpoint_percentile_threshold", 95))
        try:
            from llama_index.core.node_parser import SemanticSplitterNodeParser
        except Exception as e:  # pragma: no cover
            raise RuntimeError(
                "SemanticSplitterNodeParser is not available in current llama-index-core"
            ) from e
        splitter = SemanticSplitterNodeParser(
            embed_model=self._embed_model,
            breakpoint_percentile_threshold=threshold,
        )
        return splitter.get_nodes_from_documents([doc])

