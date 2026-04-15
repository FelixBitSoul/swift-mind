from __future__ import annotations

from llama_index.llms.openai import OpenAI

from ...core.config import Settings


def get_deepseek_llm(settings: Settings) -> OpenAI:
    """
    DeepSeek provides an OpenAI-compatible HTTP API.
    Must be HTTP-only (no local inference).
    """
    return OpenAI(
        # llama-index validates/derives metadata (context window, tokenizer)
        # using OpenAI model names. DeepSeek model ids (e.g. "deepseek-chat")
        # will raise "Unknown model" errors. We keep a known OpenAI model name
        # for metadata, but override the actual request model via additional_kwargs.
        model="gpt-4o-mini",
        additional_kwargs={"model": settings.deepseek_chat_model},
        api_key=settings.deepseek_api_key,
        api_base=settings.deepseek_api_base,
        temperature=0.2,
        streaming=True,
    )

