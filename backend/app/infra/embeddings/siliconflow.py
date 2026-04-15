from __future__ import annotations

from llama_index.embeddings.openai import OpenAIEmbedding

from ...core.config import Settings


def get_siliconflow_embedding_model(settings: Settings) -> OpenAIEmbedding:
    """
    SiliconFlow provides an OpenAI-compatible HTTP API.
    We MUST use OpenAIEmbedding (no local models).
    """
    return OpenAIEmbedding(
        # llama-index validates `model` against OpenAIEmbeddingModelType, which does
        # not include SiliconFlow model ids like "BAAI/bge-m3". We pass a valid
        # OpenAI embedding model to satisfy validation, then override the actual
        # engine name via `model_name`, which OpenAIEmbedding uses for requests.
        model="text-embedding-3-small",
        model_name=settings.siliconflow_embedding_model,
        api_key=settings.siliconflow_api_key,
        api_base=settings.siliconflow_api_base,
    )

