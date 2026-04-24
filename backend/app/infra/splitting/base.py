from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

from llama_index.core.schema import BaseNode, Document as LlamaDocument


class BaseSplitter(ABC):
    @abstractmethod
    def split(self, doc: LlamaDocument, params: dict[str, Any]) -> list[BaseNode]:
        raise NotImplementedError

