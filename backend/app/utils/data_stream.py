from __future__ import annotations

import json


def ds_text(token: str) -> bytes:
    # AI SDK Data Stream Protocol: text part
    # 0:"token"\n
    return f"0:{json.dumps(token, ensure_ascii=False)}\n".encode("utf-8")


def ds_finish(payload: dict) -> bytes:
    # AI SDK Data Stream Protocol: finish part
    # d:{...}\n
    return f"d:{json.dumps(payload, ensure_ascii=False)}\n".encode("utf-8")

