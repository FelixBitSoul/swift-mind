from __future__ import annotations

from typing import Any

import pdfplumber

from .base import BaseParser
from .pymupdf_reader import ParsedDocument


def _table_to_markdown(table: list[list[str | None]]) -> str:
    # Basic markdown table conversion; avoids extra deps.
    if not table:
        return ""
    norm: list[list[str]] = []
    for row in table:
        norm.append([("" if c is None else str(c)).strip() for c in row])
    width = max(len(r) for r in norm)
    for r in norm:
        while len(r) < width:
            r.append("")
    header = norm[0]
    body = norm[1:]
    lines = []
    lines.append("| " + " | ".join(header) + " |")
    lines.append("| " + " | ".join(["---"] * width) + " |")
    for r in body:
        lines.append("| " + " | ".join(r) + " |")
    return "\n".join(lines)


class PdfPlumberReader(BaseParser):
    def parse(self, data: bytes, params: dict[str, Any]) -> ParsedDocument:
        extract_tables = bool(params.get("extract_tables", True))

        parts: list[str] = []
        page_count = 0
        with pdfplumber.open(stream=data) as pdf:
            page_count = len(pdf.pages)
            for page in pdf.pages:
                t = page.extract_text() or ""
                if t.strip():
                    parts.append(t.strip())
                if extract_tables:
                    for table in page.extract_tables() or []:
                        md = _table_to_markdown(table)
                        if md.strip():
                            parts.append(md)
        text = "\n\n".join(parts).strip()
        if not text:
            raise RuntimeError("Parsed document is empty")
        return ParsedDocument(text=text, page_count=page_count or 1)

