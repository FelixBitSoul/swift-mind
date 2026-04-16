from __future__ import annotations

import re

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ..core.auth import CurrentUser, get_current_user
from ..core.config import get_settings
from ..infra.llms import deepseek as deepseek_llms
from ..infra.supabase import client as supabase_client

router = APIRouter()


class GenerateTitleResponse(BaseModel):
    data: dict[str, str]


_URL_RE = re.compile(r"(https?://\S+|www\.\S+)", flags=re.IGNORECASE)
_MD_RE = re.compile(r"[`*_#>\[\]\(\){}~^|]+")
_QUOTE_CHARS_RE = re.compile(r"[\"'“”‘’]")
_EMOJI_RE = re.compile(
    "["
    "\U0001F1E6-\U0001F1FF"  # flags
    "\U0001F300-\U0001F5FF"  # symbols & pictographs
    "\U0001F600-\U0001F64F"  # emoticons
    "\U0001F680-\U0001F6FF"  # transport & map symbols
    "\U0001F700-\U0001F77F"  # alchemical symbols
    "\U0001F780-\U0001F7FF"  # geometric shapes extended
    "\U0001F800-\U0001F8FF"  # supplemental arrows-c
    "\U0001F900-\U0001F9FF"  # supplemental symbols and pictographs
    "\U0001FA00-\U0001FAFF"  # symbols and pictographs extended-a
    "\U00002600-\U000026FF"  # misc symbols
    "\U00002700-\U000027BF"  # dingbats
    "]+",
    flags=re.UNICODE,
)


def _truncate_default_title(text: str) -> str:
    s = (text or "").strip()
    if len(s) <= 60:
        return s
    return s[:60] + "…"


def _is_default_title(current_title: str | None, *, first_user_text: str) -> bool:
    title = (current_title or "").strip()
    if not title:
        return True
    if title in {"New conversation", "Untitled"}:
        return True
    return False


def _clean_title(raw: str) -> str:
    s = (raw or "").strip()
    if not s:
        return ""

    # Must be plain text: no quotes, emoji, markdown, or urls.
    s = _QUOTE_CHARS_RE.sub("", s)
    s = _EMOJI_RE.sub("", s)
    # Some providers return escaped quotes like \" inside a raw string.
    s = s.replace("\\", "")

    s = _URL_RE.sub("", s)
    s = _MD_RE.sub(" ", s)
    s = s.replace("\n", " ").replace("\r", " ").replace("\t", " ")
    s = re.sub(r"\s+", " ", s).strip()
    s = s.strip(" -–—:：;；，,。.!！？?·")

    # Bound length to keep UI tidy.
    if len(s) > 40:
        s = s[:40].rstrip()
    return s


@router.post("/api/conversations/{id}/title/generate", response_model=GenerateTitleResponse)
def generate_conversation_title(
    id: str, user: CurrentUser = Depends(get_current_user)
) -> GenerateTitleResponse:
    settings = get_settings()
    supabase = supabase_client.get_supabase_client(settings)

    convo_resp = (
        supabase.table("conversations")
        .select("id,title")
        .eq("id", id)
        .eq("user_id", user.user_id)
        .execute()
    )
    convo_rows = convo_resp.data or []
    convo = convo_rows[0] if convo_rows else None
    if not convo:
        raise HTTPException(status_code=404, detail="Conversation not found")

    msg_resp = (
        supabase.table("messages")
        .select("role,content,created_at")
        .eq("conversation_id", id)
        .eq("user_id", user.user_id)
        .order("created_at", desc=False)
        .execute()
    )
    rows = msg_resp.data or []

    first_user_text = ""
    first_assistant_text = ""
    saw_first_user = False
    for r in rows:
        role = (r.get("role") or "").strip()
        content = (r.get("content") or "").strip()
        if not saw_first_user and role == "user" and content:
            first_user_text = content
            saw_first_user = True
            continue
        if saw_first_user and role == "assistant" and content:
            first_assistant_text = content
            break

    if not first_user_text or not first_assistant_text:
        raise HTTPException(status_code=409, detail="First turn not complete")

    current_title = convo.get("title")
    if not _is_default_title(current_title, first_user_text=first_user_text):
        return GenerateTitleResponse(data={"title": str(current_title or "").strip()})

    llm = deepseek_llms.get_deepseek_llm_non_streaming(settings)
    prompt = (
        "Generate a short conversation title based on the following first turn.\n"
        "Constraints:\n"
        "- Output only the title text.\n"
        "- 8–20 Chinese characters OR 3–8 English words.\n"
        "- No markdown, no quotes, no emoji, no URLs.\n"
        "- Max length 40 characters.\n\n"
        f"USER:\n{first_user_text.strip()}\n\n"
        f"ASSISTANT:\n{first_assistant_text.strip()}\n"
    )

    try:
        completion = llm.complete(prompt)
        raw_title = getattr(completion, "text", None) or str(completion)
    except Exception as e:
        # Never break chat UX on LLM failure. Return existing title (or safe fallback)
        # and do not update the conversation title.
        existing = str(current_title or "").strip()
        return GenerateTitleResponse(data={"title": existing or "Untitled"})

    title = _clean_title(raw_title)
    if not title:
        title = "Untitled"

    (
        supabase.table("conversations")
        .update({"title": title})
        .eq("id", id)
        .eq("user_id", user.user_id)
        .execute()
    )

    return GenerateTitleResponse(data={"title": title})

