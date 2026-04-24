from __future__ import annotations

from pathlib import Path

import pytest

from backend.app.infra.parsing.registry import ParserRegistry
from backend.app.infra.splitting.registry import SplitterRegistry


def _options_path() -> Path:
    return Path(__file__).resolve().parents[1] / "app" / "config" / "ingest_options.yaml"


def test_parser_registry_get_for_format() -> None:
    reg = ParserRegistry(options_path=_options_path())
    assert reg.get_for_format("pdf") in {"pymupdf", "pdfplumber"}
    assert reg.get_for_format("md") == "markdown_reader"
    assert reg.get_for_format("csv") == "csv_reader"


def test_parser_registry_validates_enum() -> None:
    reg = ParserRegistry(options_path=_options_path())
    p = reg.get("html_reader", {"mode": "text_only"})
    parsed = p.parse(b"<h1>Hello</h1>", {})
    assert "Hello" in parsed.text

    with pytest.raises(RuntimeError):
        reg.get("html_reader", {"mode": "nope"})


def test_splitter_registry_validates_integer_bounds() -> None:
    reg = SplitterRegistry(options_path=_options_path(), embed_model=object())
    reg.get("sentence", {"chunk_size": 128, "chunk_overlap": 0})
    with pytest.raises(Exception):
        reg.get("sentence", {"chunk_size": 1})

