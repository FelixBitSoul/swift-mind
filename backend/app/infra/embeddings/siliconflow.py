from __future__ import annotations

from llama_index.embeddings.openai import OpenAIEmbedding

from ...core.config import Settings


def get_siliconflow_embedding_model(settings: Settings) -> OpenAIEmbedding:
    """
    SiliconFlow provides an OpenAI-compatible HTTP API.
    We MUST use OpenAIEmbedding (no local models).
    """
    return OpenAIEmbedding(
        model=settings.siliconflow_embedding_model,
        api_key=settings.siliconflow_api_key,
        api_base=settings.siliconflow_api_base,
    )

