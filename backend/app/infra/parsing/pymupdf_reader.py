from __future__ import annotations

from dataclasses import dataclass

import fitz  # PyMuPDF


@dataclass(frozen=True)
class ParsedDocument:
    text: str
    page_count: int


class PyMuPDFReader:
    """
    Minimal PyMuPDF-based reader.
    Kept intentionally small to avoid bringing extra LlamaIndex reader deps.
    """

    def load_bytes(self, data: bytes, *, filetype: str | None = None) -> ParsedDocument:
        doc = fitz.open(stream=data, filetype=filetype)
        try:
            parts: list[str] = []
            for page in doc:
                text = page.get_text("text")
                if text:
                    parts.append(text)
            return ParsedDocument(text="\n".join(parts).strip(), page_count=doc.page_count)
        finally:
            doc.close()

