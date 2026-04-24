from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable

import yaml
from pydantic import BaseModel, ConfigDict, Field, create_model

from .base import BaseParser
from .csv_reader import CsvReader
from .docx_reader import DocxReader
from .excel_reader import ExcelReader
from .html_reader import HtmlReader
from .markdown_reader import MarkdownReader
from .pdfplumber_reader import PdfPlumberReader
from .pymupdf_reader import PyMuPDFReader
from .txt_reader import TxtReader


@dataclass(frozen=True)
class ParserSpec:
    parser_id: str
    formats: list[str]
    params_schema: dict[str, Any]


def _build_params_model(parser_id: str, schema: dict[str, Any]) -> type[BaseModel]:
    fields: dict[str, tuple[Any, Any]] = {}
    for name, s in (schema or {}).items():
        t = (s or {}).get("type")
        default = (s or {}).get("default", None)
        if t == "boolean":
            fields[name] = (bool, Field(default=bool(default) if default is not None else False))
        elif t == "integer":
            min_v = (s or {}).get("min")
            max_v = (s or {}).get("max")
            fields[name] = (int, Field(default=int(default) if default is not None else 0, ge=min_v, le=max_v))
        elif t == "enum":
            # Keep runtime simple: validate allowed values and keep as str.
            values = list((s or {}).get("values") or [])
            if not values:
                raise RuntimeError(f"Invalid enum schema for {parser_id}.{name}: missing values")
            d = default if default is not None else values[0]
            fields[name] = (str, Field(default=str(d)))
        else:
            raise RuntimeError(f"Unsupported param type for {parser_id}.{name}: {t}")
    return create_model(
        f"{parser_id.title()}Params",
        __config__=ConfigDict(extra="allow"),
        **fields,
    )  # type: ignore[arg-type]


class ParserRegistry:
    def __init__(self, options_path: Path):
        self._options_path = options_path
        self._options = self._load_yaml()
        self._specs = self._parse_specs()
        self._constructors: dict[str, Callable[[], BaseParser]] = {
            "pymupdf": lambda: _PyMuPDFAdapter(),
            "pdfplumber": lambda: PdfPlumberReader(),
            "html_reader": lambda: HtmlReader(),
            "txt_reader": lambda: TxtReader(),
            "docx_reader": lambda: DocxReader(),
            "excel_reader": lambda: ExcelReader(),
            "csv_reader": lambda: CsvReader(),
            "markdown_reader": lambda: MarkdownReader(),
        }

    def _load_yaml(self) -> dict[str, Any]:
        raw = self._options_path.read_text(encoding="utf-8")
        return yaml.safe_load(raw) or {}

    def _parse_specs(self) -> dict[str, ParserSpec]:
        parsers = (self._options or {}).get("parsers") or {}
        out: dict[str, ParserSpec] = {}
        for pid, spec in parsers.items():
            formats = list((spec or {}).get("formats") or [])
            params = dict((spec or {}).get("params") or {})
            out[str(pid)] = ParserSpec(parser_id=str(pid), formats=[str(f) for f in formats], params_schema=params)
        return out

    def get_for_format(self, suffix: str) -> str:
        s = suffix.lower().lstrip(".")
        for pid, spec in self._specs.items():
            if s in spec.formats:
                return pid
        return "pymupdf"

    def get(self, parser_id: str, params: dict[str, Any]) -> BaseParser:
        pid = str(parser_id)
        if pid not in self._specs:
            raise RuntimeError(f"Unknown parser_id: {pid}")
        ctor = self._constructors.get(pid)
        if not ctor:
            raise RuntimeError(f"Parser not implemented: {pid}")

        model = _build_params_model(pid, self._specs[pid].params_schema)
        validated = model(**(params or {})).model_dump()
        if self._specs[pid].params_schema:
            # enum validation for 'values' (kept as str field)
            for name, s in self._specs[pid].params_schema.items():
                if (s or {}).get("type") == "enum":
                    allowed = set((s or {}).get("values") or [])
                    if validated.get(name) not in allowed:
                        raise RuntimeError(
                            f"Invalid value for {pid}.{name}: {validated.get(name)} (allowed: {sorted(allowed)})"
                        )
        parser = ctor()
        setattr(parser, "_validated_params", validated)
        return _ParserWithBoundParams(parser=parser, params=validated)

    def options(self) -> dict[str, Any]:
        return dict(self._options or {})


class _ParserWithBoundParams(BaseParser):
    def __init__(self, *, parser: BaseParser, params: dict[str, Any]):
        self._parser = parser
        self._params = params

    def parse(self, data: bytes, params: dict[str, Any]) -> Any:
        # ignore external params; use bound validated params
        return self._parser.parse(data, self._params)


class _PyMuPDFAdapter(BaseParser):
    def __init__(self) -> None:
        self._inner = PyMuPDFReader()

    def parse(self, data: bytes, params: dict[str, Any]) -> Any:
        # PyMuPDFReader expects (bytes, filetype) in current codebase; infer from params if provided.
        filetype = params.get("filetype")
        return self._inner.load_bytes(data, filetype=filetype)

