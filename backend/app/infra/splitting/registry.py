from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable

import yaml
from pydantic import BaseModel, ConfigDict, Field, create_model

from .base import BaseSplitter
from .markdown_splitter import MarkdownSplitter
from .semantic_splitter import SemanticSplitter
from .sentence_splitter import SentenceSplitter
from .token_splitter import TokenSplitter


@dataclass(frozen=True)
class SplitterSpec:
    splitter_id: str
    params_schema: dict[str, Any]


def _build_params_model(splitter_id: str, schema: dict[str, Any]) -> type[BaseModel]:
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
            values = list((s or {}).get("values") or [])
            if not values:
                raise RuntimeError(f"Invalid enum schema for {splitter_id}.{name}: missing values")
            d = default if default is not None else values[0]
            fields[name] = (str, Field(default=str(d)))
        else:
            raise RuntimeError(f"Unsupported param type for {splitter_id}.{name}: {t}")
    return create_model(
        f"{splitter_id.title()}Params",
        __config__=ConfigDict(extra="allow"),
        **fields,
    )  # type: ignore[arg-type]


class SplitterRegistry:
    def __init__(self, *, options_path: Path, embed_model: Any):
        self._options_path = options_path
        self._embed_model = embed_model
        self._options = self._load_yaml()
        self._specs = self._parse_specs()
        self._constructors: dict[str, Callable[[], BaseSplitter]] = {
            "sentence": lambda: SentenceSplitter(),
            "token": lambda: TokenSplitter(),
            "semantic": lambda: SemanticSplitter(embed_model=self._embed_model),
            "markdown": lambda: MarkdownSplitter(),
        }

    def _load_yaml(self) -> dict[str, Any]:
        raw = self._options_path.read_text(encoding="utf-8")
        return yaml.safe_load(raw) or {}

    def _parse_specs(self) -> dict[str, SplitterSpec]:
        splitters = (self._options or {}).get("splitters") or {}
        out: dict[str, SplitterSpec] = {}
        for sid, spec in splitters.items():
            params = dict((spec or {}).get("params") or {})
            out[str(sid)] = SplitterSpec(splitter_id=str(sid), params_schema=params)
        return out

    def get(self, splitter_id: str, params: dict[str, Any]) -> BaseSplitter:
        sid = str(splitter_id)
        if sid not in self._specs:
            raise RuntimeError(f"Unknown splitter_id: {sid}")
        ctor = self._constructors.get(sid)
        if not ctor:
            raise RuntimeError(f"Splitter not implemented: {sid}")
        model = _build_params_model(sid, self._specs[sid].params_schema)
        validated = model(**(params or {})).model_dump()
        splitter = ctor()
        return _SplitterWithBoundParams(splitter=splitter, params=validated)

    def options(self) -> dict[str, Any]:
        return dict(self._options or {})


class _SplitterWithBoundParams(BaseSplitter):
    def __init__(self, *, splitter: BaseSplitter, params: dict[str, Any]):
        self._splitter = splitter
        self._params = params

    def split(self, doc, params: dict[str, Any]):  # type: ignore[override]
        return self._splitter.split(doc, self._params)

