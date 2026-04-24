from __future__ import annotations

from typing import Any

from .base import BaseParser
from .pymupdf_reader import ParsedDocument


class MarkdownReader(BaseParser):
    def parse(self, data: bytes, params: dict[str, Any]) -> ParsedDocument:
        text = data.decode("utf-8", errors="replace").strip()
        if not text:
            raise RuntimeError("Parsed document is empty")
        return ParsedDocument(text=text, page_count=1)

