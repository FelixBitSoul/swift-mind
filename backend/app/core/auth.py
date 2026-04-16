from __future__ import annotations

from dataclasses import dataclass

from fastapi import Depends, HTTPException, Request
from supabase import Client

from ..infra.supabase.client import get_supabase_client
from .config import get_settings


@dataclass(frozen=True)
class CurrentUser:
    user_id: str
    jwt: str


def _extract_bearer_token(request: Request) -> str:
    auth = request.headers.get("authorization") or request.headers.get("Authorization")
    if not auth:
        raise HTTPException(status_code=401, detail="Missing Authorization header")
    parts = auth.split(" ", 1)
    if len(parts) != 2 or parts[0].lower() != "bearer" or not parts[1].strip():
        raise HTTPException(status_code=401, detail="Invalid Authorization header")
    return parts[1].strip()


def _get_supabase_admin() -> Client:
    settings = get_settings()
    return get_supabase_client(settings)


def get_current_user(
    request: Request, supabase: Client = Depends(_get_supabase_admin)
) -> CurrentUser:
    """
    Validate Supabase JWT via Supabase Auth HTTP API (no local JWT libs needed).
    """
    token = _extract_bearer_token(request)
    try:
        user_resp = supabase.auth.get_user(token)
        user = getattr(user_resp, "user", None) or getattr(user_resp, "data", None)
        user_id = getattr(user, "id", None) if user is not None else None
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        return CurrentUser(user_id=str(user_id), jwt=token)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail="Token verification failed") from e

