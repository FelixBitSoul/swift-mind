from __future__ import annotations

import os
from dataclasses import dataclass

from dotenv import load_dotenv


def _must_getenv(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


@dataclass(frozen=True)
class Settings:
    supabase_url: str
    supabase_service_role_key: str
    siliconflow_api_key: str
    deepseek_api_key: str
    siliconflow_api_base: str = "https://api.siliconflow.cn/v1"
    siliconflow_embedding_model: str = "BAAI/bge-m3"
    deepseek_api_base: str = "https://api.deepseek.com/v1"
    deepseek_chat_model: str = "deepseek-chat"


def get_settings() -> Settings:
    load_dotenv(override=False)
    return Settings(
        supabase_url=_must_getenv("SUPABASE_URL"),
        supabase_service_role_key=_must_getenv("SUPABASE_SERVICE_ROLE_KEY"),
        siliconflow_api_key=_must_getenv("SILICONFLOW_API_KEY"),
        deepseek_api_key=_must_getenv("DEEPSEEK_API_KEY"),
    )

