from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Iterable

import pytest
from fastapi.testclient import TestClient


@dataclass
class _Resp:
    data: Any


class _TableQuery:
    def __init__(self, db: "_FakeSupabase", table: str):
        self._db = db
        self._table = table
        self._filters: list[tuple[str, str, Any]] = []
        self._order: tuple[str, bool] | None = None
        self._mode: str = "select"
        self._update_payload: dict[str, Any] | None = None

    def select(self, _cols: str) -> "_TableQuery":
        self._mode = "select"
        return self

    def update(self, payload: dict[str, Any]) -> "_TableQuery":
        self._mode = "update"
        self._update_payload = dict(payload)
        return self

    def eq(self, key: str, value: Any) -> "_TableQuery":
        self._filters.append(("eq", key, value))
        return self

    def order(self, key: str, desc: bool = False) -> "_TableQuery":
        self._order = (key, bool(desc))
        return self

    def execute(self) -> _Resp:
        if self._mode == "select":
            rows = list(self._db._get_rows(self._table))
            for op, key, val in self._filters:
                if op == "eq":
                    rows = [r for r in rows if r.get(key) == val]
            if self._order:
                key, desc = self._order
                rows.sort(key=lambda r: r.get(key) or "", reverse=desc)
            return _Resp(rows)

        if self._mode == "update":
            assert self._update_payload is not None
            updated = 0
            for r in self._db._get_rows(self._table):
                ok = True
                for op, key, val in self._filters:
                    if op == "eq" and r.get(key) != val:
                        ok = False
                        break
                if ok:
                    r.update(self._update_payload)
                    updated += 1
            return _Resp([{"count": updated}])

        raise RuntimeError(f"Unsupported mode: {self._mode}")


class _FakeSupabase:
    def __init__(
        self, *, conversations: list[dict[str, Any]], messages: list[dict[str, Any]]
    ):
        self._tables: dict[str, list[dict[str, Any]]] = {
            "conversations": conversations,
            "messages": messages,
        }

    def table(self, name: str) -> _TableQuery:
        return _TableQuery(self, name)

    def _get_rows(self, name: str) -> Iterable[dict[str, Any]]:
        return self._tables.setdefault(name, [])


class _FakeCompletion:
    def __init__(self, text: str):
        self.text = text


class _FakeLLM:
    def __init__(self, *, text: str | None = None, raise_exc: Exception | None = None):
        self._text = text
        self._raise_exc = raise_exc

    def complete(self, _prompt: str) -> _FakeCompletion:
        if self._raise_exc is not None:
            raise self._raise_exc
        return _FakeCompletion(self._text or "")


def _make_client(
    monkeypatch: pytest.MonkeyPatch, *, supabase: _FakeSupabase, llm: _FakeLLM
) -> TestClient:
    from backend.app.core.auth import CurrentUser, get_current_user  # noqa: PLC0415
    from backend.app.main import create_app  # noqa: PLC0415

    app = create_app()
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(user_id="u1", jwt="t")

    monkeypatch.setattr(
        "backend.app.infra.supabase.client.get_supabase_client",
        lambda _settings: supabase,
    )
    monkeypatch.setattr(
        "backend.app.infra.llms.deepseek.get_deepseek_llm_non_streaming",
        lambda _settings: llm,
    )
    return TestClient(app)


def _first_turn_messages(
    *, conv_id: str, user_text: str, assistant_text: str
) -> list[dict[str, Any]]:
    return [
        {
            "conversation_id": conv_id,
            "user_id": "u1",
            "role": "user",
            "content": user_text,
            "created_at": "2026-01-01T00:00:00Z",
        },
        {
            "conversation_id": conv_id,
            "user_id": "u1",
            "role": "assistant",
            "content": assistant_text,
            "created_at": "2026-01-01T00:00:01Z",
        },
    ]


def test_custom_title_is_never_overwritten(monkeypatch: pytest.MonkeyPatch):
    conv_id = "c_custom"
    supabase = _FakeSupabase(
        conversations=[{"id": conv_id, "user_id": "u1", "title": "My custom title"}],
        messages=_first_turn_messages(
            conv_id=conv_id, user_text="Hello", assistant_text="Hi there!"
        ),
    )
    client = _make_client(monkeypatch, supabase=supabase, llm=_FakeLLM(text="New title"))

    resp = client.post(f"/api/conversations/{conv_id}/title/generate")
    assert resp.status_code == 200
    assert resp.json()["data"]["title"] == "My custom title"
    assert supabase._tables["conversations"][0]["title"] == "My custom title"


@pytest.mark.parametrize("default_title", ["", "   ", None, "New conversation", "Untitled"])
def test_generate_title_updates_when_default_title(
    monkeypatch: pytest.MonkeyPatch, default_title: str | None
):
    conv_id = f"c_default_{default_title}"
    supabase = _FakeSupabase(
        conversations=[{"id": conv_id, "user_id": "u1", "title": default_title}],
        messages=_first_turn_messages(
            conv_id=conv_id,
            user_text="How to implement RAG with Supabase?",
            assistant_text="Sure. Here is an outline...",
        ),
    )
    client = _make_client(monkeypatch, supabase=supabase, llm=_FakeLLM(text=' "RAG with Supabase" '))

    resp = client.post(f"/api/conversations/{conv_id}/title/generate")
    assert resp.status_code == 200
    assert resp.json()["data"]["title"] == "RAG with Supabase"
    assert supabase._tables["conversations"][0]["title"] == "RAG with Supabase"


def test_llm_exception_returns_200_and_does_not_change_title(monkeypatch: pytest.MonkeyPatch):
    conv_id = "c_llm_exc"
    supabase = _FakeSupabase(
        conversations=[{"id": conv_id, "user_id": "u1", "title": "Untitled"}],
        messages=_first_turn_messages(
            conv_id=conv_id,
            user_text="Title me please",
            assistant_text="Ok",
        ),
    )
    client = _make_client(
        monkeypatch,
        supabase=supabase,
        llm=_FakeLLM(raise_exc=RuntimeError("boom")),
    )

    resp = client.post(f"/api/conversations/{conv_id}/title/generate")
    assert resp.status_code == 200
    assert resp.json()["data"]["title"] == "Untitled"
    assert supabase._tables["conversations"][0]["title"] == "Untitled"


def test_generate_title_returns_409_when_first_user_missing(monkeypatch: pytest.MonkeyPatch):
    conv_id = "c_no_first_user"
    supabase = _FakeSupabase(
        conversations=[{"id": conv_id, "user_id": "u1", "title": "Untitled"}],
        messages=[
            {
                "conversation_id": conv_id,
                "user_id": "u1",
                "role": "assistant",
                "content": "Hello",
                "created_at": "2026-01-01T00:00:00Z",
            }
        ],
    )
    client = _make_client(monkeypatch, supabase=supabase, llm=_FakeLLM(text="Ignored"))

    resp = client.post(f"/api/conversations/{conv_id}/title/generate")
    assert resp.status_code == 409


def test_generate_title_returns_409_when_first_assistant_missing(monkeypatch: pytest.MonkeyPatch):
    conv_id = "c_no_first_assistant"
    supabase = _FakeSupabase(
        conversations=[{"id": conv_id, "user_id": "u1", "title": "Untitled"}],
        messages=[
            {
                "conversation_id": conv_id,
                "user_id": "u1",
                "role": "user",
                "content": "Hello",
                "created_at": "2026-01-01T00:00:00Z",
            }
        ],
    )
    client = _make_client(monkeypatch, supabase=supabase, llm=_FakeLLM(text="Ignored"))

    resp = client.post(f"/api/conversations/{conv_id}/title/generate")
    assert resp.status_code == 409


def test_user_scoping_prevents_accessing_other_users_conversations(monkeypatch: pytest.MonkeyPatch):
    conv_id = "c_other_user"
    supabase = _FakeSupabase(
        conversations=[{"id": conv_id, "user_id": "u2", "title": "Untitled"}],
        messages=_first_turn_messages(conv_id=conv_id, user_text="Hello", assistant_text="Hi"),
    )
    client = _make_client(monkeypatch, supabase=supabase, llm=_FakeLLM(text="New title"))

    resp = client.post(f"/api/conversations/{conv_id}/title/generate")
    assert resp.status_code == 404


def test_sanitization_strips_url_markdown_quotes_and_emoji(monkeypatch: pytest.MonkeyPatch):
    conv_id = "c_sanitize"
    supabase = _FakeSupabase(
        conversations=[{"id": conv_id, "user_id": "u1", "title": "Untitled"}],
        messages=_first_turn_messages(
            conv_id=conv_id,
            user_text="Please name this chat",
            assistant_text="Ok",
        ),
    )
    llm_text = ' "**Hello** \\"world\\" 😄 https://example.com [x](https://x.y)" '
    client = _make_client(monkeypatch, supabase=supabase, llm=_FakeLLM(text=llm_text))

    resp = client.post(f"/api/conversations/{conv_id}/title/generate")
    assert resp.status_code == 200
    title = resp.json()["data"]["title"]
    assert title == "Hello world x"
    assert "http" not in title.lower()
    assert not any(ch in title for ch in ['"', "'", "“", "”", "‘", "’"])
    assert supabase._tables["conversations"][0]["title"] == title
