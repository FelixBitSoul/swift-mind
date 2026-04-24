from __future__ import annotations

from typing import Any

from llama_index.core.schema import BaseNode, Document as LlamaDocument

from .base import BaseSplitter


class MarkdownSplitter(BaseSplitter):
    def split(self, doc: LlamaDocument, params: dict[str, Any]) -> list[BaseNode]:
        include_metadata = bool(params.get("include_metadata", True))
        try:
            from llama_index.core.node_parser import MarkdownNodeParser
        except Exception as e:  # pragma: no cover
            raise RuntimeError("MarkdownNodeParser is not available in current llama-index-core") from e
        parser = MarkdownNodeParser(include_metadata=include_metadata)
        return parser.get_nodes_from_documents([doc])

