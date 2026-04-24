from __future__ import annotations

import csv
from io import StringIO
from typing import Any, Literal

from .base import BaseParser
from .pymupdf_reader import ParsedDocument


def _row_to_text(headers: list[str], row: dict[str, str]) -> str:
    parts: list[str] = []
    for h in headers:
        v = (row.get(h) or "").strip()
        if not v:
            continue
        key = h.strip() or "col"
        parts.append(f"{key}: {v}")
    return "; ".join(parts).strip()


class CsvReader(BaseParser):
    def parse(self, data: bytes, params: dict[str, Any]) -> ParsedDocument:
        mode: Literal["row_to_text", "chunk_by_rows"] = params.get("mode", "row_to_text")
        rows_per_chunk = int(params.get("rows_per_chunk", 50))
        if rows_per_chunk <= 0:
            raise RuntimeError("rows_per_chunk must be > 0")

        text_data = data.decode("utf-8", errors="replace")
        f = StringIO(text_data)
        reader = csv.DictReader(f)
        headers = reader.fieldnames or []

        parts: list[str] = []
        buffer: list[str] = []
        for row in reader:
            line = _row_to_text(headers, row)
            if not line:
                continue
            if mode == "row_to_text":
                parts.append(line)
            elif mode == "chunk_by_rows":
                buffer.append(line)
                if len(buffer) >= rows_per_chunk:
                    parts.append("\n".join(buffer))
                    buffer = []
            else:
                raise RuntimeError(f"Unsupported csv_reader.mode: {mode}")

        if mode == "chunk_by_rows" and buffer:
            parts.append("\n".join(buffer))

        out = "\n\n".join(parts).strip()
        if not out:
            raise RuntimeError("Parsed document is empty")
        return ParsedDocument(text=out, page_count=1)

