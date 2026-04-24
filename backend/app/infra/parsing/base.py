from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

from .pymupdf_reader import ParsedDocument


class BaseParser(ABC):
    @abstractmethod
    def parse(self, data: bytes, params: dict[str, Any]) -> ParsedDocument:
        raise NotImplementedError

