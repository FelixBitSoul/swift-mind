from __future__ import annotations

from typing import Any, Literal

from bs4 import BeautifulSoup
import html2text

from .base import BaseParser
from .pymupdf_reader import ParsedDocument


class HtmlReader(BaseParser):
    def parse(self, data: bytes, params: dict[str, Any]) -> ParsedDocument:
        mode: Literal["text_only", "preserve_structure"] = params.get("mode", "text_only")
        html = data.decode("utf-8", errors="replace")
        if not html.strip():
            raise RuntimeError("Parsed document is empty")

        if mode == "text_only":
            soup = BeautifulSoup(html, "html.parser")
            text = soup.get_text("\n", strip=True)
        elif mode == "preserve_structure":
            conv = html2text.HTML2Text()
            conv.ignore_links = False
            conv.ignore_images = True
            conv.body_width = 0
            text = conv.handle(html)
        else:
            raise RuntimeError(f"Unsupported html_reader.mode: {mode}")

        text = (text or "").strip()
        if not text:
            raise RuntimeError("Parsed document is empty")
        return ParsedDocument(text=text, page_count=1)

