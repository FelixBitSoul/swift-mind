# Chat title + mobile + theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add post–first-turn AI conversation titles, improve mobile chat/sidebar UX, and add a quick light/dark/system theme switch next to the avatar (persisted).

**Architecture:** Title generation is implemented in the Python backend (DeepSeek via LlamaIndex OpenAI-compatible HTTP) and exposed via a new backend route. The Next.js frontend triggers it once after the first assistant reply completes and refreshes the conversations list. Theme switching uses `next-themes` to toggle the `.dark` class on `<html>` and persists user preference. Mobile improvements reuse the existing shadcn sidebar mobile `Sheet` behavior and fix safe-area + layout spacing in the chat thread.

**Tech Stack:** FastAPI + LlamaIndex OpenAI (`deepseek-chat`) + Supabase; Next.js App Router + shadcn/ui + Tailwind (CSS vars) + `next-themes`.

---

## File map (create/modify)

**Backend**
- Create: `backend/app/api/conversations.py` (new FastAPI router for title generation)
- Modify: `backend/app/main.py` (include router)
- Modify: `backend/app/infra/llms/deepseek.py` (add a non-streaming LLM constructor for short completions)
- Create: `backend/tests/test_conversation_title_generate.py` (endpoint tests with monkeypatch)

**Frontend**
- Create: `frontend/src/app/api/conversations/[id]/title/generate/route.ts` (proxy to backend, injects Supabase access token)
- Modify: `frontend/src/components/chat/chat-thread.tsx` (detect first-turn completion; call generate endpoint; invalidate conversations query)
- Create: `frontend/src/components/providers/theme-provider.tsx` (wrap `next-themes`)
- Modify: `frontend/src/app/layout.tsx` (install ThemeProvider at root)
- Create: `frontend/src/components/app/theme-switcher.tsx` (icon button + dropdown for system/light/dark)
- Modify: `frontend/src/app/(app)/layout.tsx` (place theme switcher left of avatar; add `SidebarTrigger` for mobile)
- Modify: `frontend/src/components/app/app-sidebar.tsx` (close mobile sidebar after navigation)
- Modify: `frontend/src/components/chat/chat-thread.tsx` (mobile spacing/safe-area tweaks)
- Modify: `frontend/src/app/globals.css` (only if safe-area utility classes are missing; prefer class-based changes first)

**Docs**
- Modify: `frontend/README.md` (document new route handler `POST /api/conversations/:id/title/generate`)

---

### Task 1: Backend API — generate conversation title (TDD)

**Files:**
- Create: `backend/app/api/conversations.py`
- Modify: `backend/app/main.py`
- Modify: `backend/app/infra/llms/deepseek.py`
- Test: `backend/tests/test_conversation_title_generate.py`

- [ ] **Step 1: Write failing test for “updates title only when default”**

Create `backend/tests/test_conversation_title_generate.py`:

```python
from __future__ import annotations

from fastapi.testclient import TestClient

from backend.app.main import create_app


def test_generate_title_updates_only_when_default(monkeypatch):
    app = create_app()
    client = TestClient(app)

    # --- auth: bypass get_current_user dependency globally
    from backend.app.core import auth as auth_module

    class FakeUser:
        user_id = "u1"

    def fake_get_current_user():
        return FakeUser()

    app.dependency_overrides[auth_module.get_current_user] = fake_get_current_user

    # --- supabase: fake client with in-memory tables
    class FakeResp:
        def __init__(self, data):
            self.data = data

    class FakeTable:
        def __init__(self, name, store):
            self.name = name
            self.store = store
            self.filters = []
            self._select = None
            self._update = None

        def select(self, *_):
            return self

        def eq(self, k, v):
            self.filters.append((k, v))
            return self

        def order(self, *_args, **_kwargs):
            return self

        def limit(self, *_):
            return self

        def execute(self):
            rows = list(self.store[self.name])
            for k, v in self.filters:
                rows = [r for r in rows if r.get(k) == v]
            if self._update is not None:
                for r in rows:
                    r.update(self._update)
                return FakeResp(rows)
            return FakeResp(rows)

        def update(self, patch):
            self._update = patch
            return self

    class FakeSupabase:
        def __init__(self):
            self.store = {
                "conversations": [
                    {"id": "c1", "user_id": "u1", "title": "Hello world", "kb_ids": []},
                    {"id": "c2", "user_id": "u1", "title": "Custom name", "kb_ids": []},
                ],
                "messages": [
                    {"conversation_id": "c1", "user_id": "u1", "role": "user", "content": "Hello world"},
                    {"conversation_id": "c1", "user_id": "u1", "role": "assistant", "content": "Sure."},
                    {"conversation_id": "c2", "user_id": "u1", "role": "user", "content": "Question"},
                    {"conversation_id": "c2", "user_id": "u1", "role": "assistant", "content": "Answer"},
                ],
            }

        def table(self, name):
            return FakeTable(name, self.store)

    from backend.app.infra.supabase import client as supa_module

    monkeypatch.setattr(supa_module, "get_supabase_client", lambda _settings: FakeSupabase())

    # --- LLM: deterministic title
    class FakeLLM:
        def complete(self, prompt: str):
            class R:
                text = "更好的标题"

            return R()

    from backend.app.infra.llms import deepseek as deepseek_module

    monkeypatch.setattr(deepseek_module, "get_deepseek_llm_non_streaming", lambda _settings: FakeLLM())

    # c1: default-like title -> should update
    r1 = client.post("/api/conversations/c1/title/generate")
    assert r1.status_code == 200
    assert r1.json()["data"]["title"] == "更好的标题"

    # c2: custom title -> should not update
    r2 = client.post("/api/conversations/c2/title/generate")
    assert r2.status_code in (200, 204)
```

- [ ] **Step 2: Run the test to confirm it fails**

Run:

```bash
uv run pytest backend/tests/test_conversation_title_generate.py -q
```

Expected: FAIL (route not found / import errors).

- [ ] **Step 3: Implement `get_deepseek_llm_non_streaming`**

Modify `backend/app/infra/llms/deepseek.py`:

```python
from llama_index.llms.openai import OpenAI

from ...core.config import Settings


def get_deepseek_llm(settings: Settings) -> OpenAI:
    return OpenAI(
        model="gpt-4o-mini",
        additional_kwargs={"model": settings.deepseek_chat_model},
        api_key=settings.deepseek_api_key,
        api_base=settings.deepseek_api_base,
        temperature=0.2,
        streaming=True,
    )


def get_deepseek_llm_non_streaming(settings: Settings) -> OpenAI:
    return OpenAI(
        model="gpt-4o-mini",
        additional_kwargs={"model": settings.deepseek_chat_model},
        api_key=settings.deepseek_api_key,
        api_base=settings.deepseek_api_base,
        temperature=0.2,
        streaming=False,
    )
```

- [ ] **Step 4: Implement the new backend route**

Create `backend/app/api/conversations.py`:

```python
from __future__ import annotations

import re

from fastapi import APIRouter, Depends, HTTPException, Path
from pydantic import BaseModel

from ..core.auth import CurrentUser, get_current_user
from ..core.config import get_settings
from ..infra.llms.deepseek import get_deepseek_llm_non_streaming
from ..infra.supabase.client import get_supabase_client

router = APIRouter()


class GenerateTitleResponse(BaseModel):
    title: str


def _truncate_default_title(first_text: str) -> str:
    t = (first_text or "").strip()
    if not t:
        return "New conversation"
    return f"{t[:60]}…" if len(t) > 60 else t


_URL_RE = re.compile(r"https?://", re.I)
_MD_RE = re.compile(r"[*_`#>\[\]\(\)]")


def _clean_title(raw: str) -> str:
    t = (raw or "").strip()
    # Remove wrapping quotes
    t = t.strip("“”\"'`")
    # Collapse whitespace
    t = re.sub(r"\s+", " ", t).strip()
    # Hard filters
    t = _URL_RE.sub("", t)
    t = _MD_RE.sub("", t)
    return t.strip()


def _is_default_title(current: str | None, first_text: str) -> bool:
    if current is None:
        return True
    cur = current.strip()
    if not cur:
        return True
    if cur in {"New conversation", "Untitled"}:
        return True
    return cur == _truncate_default_title(first_text)


@router.post("/api/conversations/{id}/title/generate")
def generate_conversation_title(
    id: str = Path(..., min_length=1),
    user: CurrentUser = Depends(get_current_user),
):
    settings = get_settings()
    supabase = get_supabase_client(settings)

    convo = (
        supabase.table("conversations")
        .select("id,title")
        .eq("id", id)
        .eq("user_id", user.user_id)
        .limit(1)
        .execute()
    )
    rows = convo.data or []
    if not rows:
        raise HTTPException(status_code=404, detail="Not found")
    current_title = rows[0].get("title")

    msgs = (
        supabase.table("messages")
        .select("role,content,created_at")
        .eq("conversation_id", id)
        .eq("user_id", user.user_id)
        .order("created_at", desc=False)
        .execute()
    )
    mrows = msgs.data or []
    first_user = next((r.get("content") for r in mrows if r.get("role") == "user" and r.get("content")), "") or ""
    first_assistant = next(
        (r.get("content") for r in mrows if r.get("role") == "assistant" and r.get("content")),
        "",
    ) or ""
    if not first_user or not first_assistant:
        raise HTTPException(status_code=409, detail="First turn not complete")

    if not _is_default_title(current_title if isinstance(current_title, str) else None, first_user):
        # Do not override user custom titles
        return {"data": {"title": current_title}}

    llm = get_deepseek_llm_non_streaming(settings)
    prompt = (
        "You will generate a short conversation title.\n"
        "Requirements:\n"
        "- Chinese: 8-20 chars; English: 3-8 words.\n"
        "- No markdown, no quotes, no emoji, no URLs.\n"
        "- Summarize the topic, do not repeat the full question.\n\n"
        f"User: {first_user.strip()}\n"
        f"Assistant: {first_assistant.strip()}\n\n"
        "Title:"
    )
    try:
        resp = llm.complete(prompt)
        raw = getattr(resp, "text", None) or str(resp)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM error: {e}") from e

    title = _clean_title(raw)
    if not title:
        raise HTTPException(status_code=502, detail="LLM returned empty title")
    # Bound length (keep it user-friendly)
    title = title[:40].strip()
    if not title:
        raise HTTPException(status_code=502, detail="LLM returned invalid title")

    updated = (
        supabase.table("conversations")
        .update({"title": title})
        .eq("id", id)
        .eq("user_id", user.user_id)
        .execute()
    )
    if updated.data is None:
        raise HTTPException(status_code=500, detail="Update failed")

    return {"data": {"title": title}}
```

- [ ] **Step 5: Wire router into app**

Modify `backend/app/main.py`:

```python
from .api.conversations import router as conversations_router

# ...
app.include_router(conversations_router)
```

- [ ] **Step 6: Run tests again**

Run:

```bash
uv run pytest backend/tests/test_conversation_title_generate.py -q
```

Expected: PASS.

- [ ] **Step 7: (Optional) Add a second test for “409 when first turn incomplete”**

Add a case where only user message exists for a conversation and assert 409.

- [ ] **Step 8: Commit**

```bash
git add backend/app/api/conversations.py backend/app/main.py backend/app/infra/llms/deepseek.py backend/tests/test_conversation_title_generate.py
git commit -m "feat: generate conversation titles after first turn"
```

---

### Task 2: Frontend API proxy — `POST /api/conversations/:id/title/generate`

**Files:**
- Create: `frontend/src/app/api/conversations/[id]/title/generate/route.ts`

- [ ] **Step 1: Create the route handler**

`frontend/src/app/api/conversations/[id]/title/generate/route.ts`:

```ts
import { env } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = await createSupabaseServerClient();
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const upstream = await fetch(`${env.backendBaseUrl}/api/conversations/${encodeURIComponent(id)}/title/generate`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
  });

  const contentType = upstream.headers.get("content-type") ?? "application/json";
  const text = await upstream.text();
  return new Response(text, { status: upstream.status, headers: { "content-type": contentType } });
}
```

- [ ] **Step 2: Manual smoke test**

With backend running:

```bash
cd frontend
npm run dev
```

Call from browser console (replace id):

```js
fetch("/api/conversations/<id>/title/generate", { method: "POST" }).then(r => r.json())
```

Expected: `{ data: { title: "..." } }` or an error JSON.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/api/conversations/[id]/title/generate/route.ts
git commit -m "feat: add title generation proxy route"
```

---

### Task 3: Frontend trigger — generate title once after first assistant reply completes

**Files:**
- Modify: `frontend/src/components/chat/chat-thread.tsx`

- [ ] **Step 1: Write a small unit of logic (no UI change)**

Add a `useEffect` that:
- only runs when `conversationId !== "__draft__"`
- only runs once per conversation (use a ref keyed by conversationId)
- detects “first turn completed”: at least 2 messages exist, and there is at least one `assistant` message, and `status === "idle"` (not streaming/submitted)

Pseudo-code to implement:

```ts
const hasGeneratedTitleRef = useRef<string | null>(null);

useEffect(() => {
  if (!props.conversationId || props.conversationId === "__draft__") return;
  if (status !== "idle") return;
  if (hasGeneratedTitleRef.current === props.conversationId) return;

  const firstAssistant = rendered.find((m) => m.role === "assistant" && messageToText(m).trim());
  const firstUser = rendered.find((m) => m.role === "user" && messageToText(m).trim());
  if (!firstAssistant || !firstUser) return;

  // Only after first turn (avoid triggering on later turns):
  // If there are >=1 assistant and >=1 user, but we also require that the assistant we found is the FIRST assistant.
  // Keep it simple: trigger when rendered has exactly 2 messages OR when first assistant exists and there is exactly 1 assistant.
  const assistantCount = rendered.filter((m) => m.role === "assistant").length;
  if (assistantCount !== 1) return;

  hasGeneratedTitleRef.current = props.conversationId;
  void fetch(`/api/conversations/${encodeURIComponent(props.conversationId)}/title/generate`, { method: "POST" })
    .then(async (res) => {
      if (!res.ok) return;
      // refresh sidebar list
      // (useQueryClient + invalidateQueries(["conversations"]))
    })
    .catch(() => {});
}, [props.conversationId, rendered, status]);
```

Implementation detail: import `useQueryClient` and call `invalidateQueries({ queryKey: ["conversations"] })` on success.

- [ ] **Step 2: Manual verification**

Flow:
1. Create new conversation (draft), send first message.
2. Wait for AI to finish.
3. Observe sidebar title updates to the generated one (may require a short delay).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/chat/chat-thread.tsx
git commit -m "feat: auto-generate conversation title after first turn"
```

---

### Task 4: Theme switching (system/light/dark) with quick control next to avatar

**Files:**
- Add dependency: `next-themes`
- Create: `frontend/src/components/providers/theme-provider.tsx`
- Modify: `frontend/src/app/layout.tsx`
- Create: `frontend/src/components/app/theme-switcher.tsx`
- Modify: `frontend/src/app/(app)/layout.tsx`

- [ ] **Step 1: Install dependency**

```bash
cd frontend
npm_config_registry=https://registry.npmmirror.com npm install next-themes
```

- [ ] **Step 2: Create ThemeProvider wrapper**

`frontend/src/components/providers/theme-provider.tsx`:

```tsx
"use client";

import { PropsWithChildren } from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

export function ThemeProvider({ children }: PropsWithChildren) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      storageKey="swiftmind-theme"
    >
      {children}
    </NextThemesProvider>
  );
}
```

- [ ] **Step 3: Wire ThemeProvider in `RootLayout`**

Modify `frontend/src/app/layout.tsx` to wrap app providers:

```tsx
import { ThemeProvider } from "@/components/providers/theme-provider";

// ...
<ThemeProvider>
  <QueryProvider>
    <TooltipProvider>{children}</TooltipProvider>
  </QueryProvider>
</ThemeProvider>
```

- [ ] **Step 4: Create quick theme switcher component**

`frontend/src/components/app/theme-switcher.tsx`:

```tsx
"use client";

import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const icon =
    theme === "dark" ? <MoonIcon className="size-4" /> : theme === "light" ? <SunIcon className="size-4" /> : <MonitorIcon className="size-4" />;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Theme"
        render={<Button variant="ghost" size="icon" className="size-9 rounded-full border border-transparent data-popup-open:border-border data-popup-open:bg-muted" />}
      >
        {icon}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="bottom" sideOffset={8} className="min-w-40">
        <DropdownMenuItem onClick={() => setTheme("system")}>跟随系统</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("light")}>亮色</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>暗色</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

- [ ] **Step 5: Place switcher left of avatar**

Modify `frontend/src/app/(app)/layout.tsx` header content:

```tsx
import { ThemeSwitcher } from "@/components/app/theme-switcher";
import { SidebarTrigger } from "@/components/ui/sidebar";

// ...
<div className="flex h-14 items-center justify-between px-4 sm:px-6">
  <div className="flex items-center gap-2">
    <SidebarTrigger className="md:hidden" />
  </div>
  <div className="flex items-center gap-1">
    <ThemeSwitcher />
    <UserMenu ... />
  </div>
</div>
```

- [ ] **Step 6: Manual verification**

- system theme changes reflect when `theme=system`
- selecting light/dark persists across reload
- login/register pages still use the same theme (RootLayout wraps all)

- [ ] **Step 7: Commit**

```bash
git add frontend/src/app/layout.tsx frontend/src/components/providers/theme-provider.tsx frontend/src/components/app/theme-switcher.tsx frontend/src/app/(app)/layout.tsx
git commit -m "feat: add theme switching with quick toggle"
```

---

### Task 5: Mobile UX improvements (sidebar + chat safe-area/layout)

**Files:**
- Modify: `frontend/src/components/app/app-sidebar.tsx`
- Modify: `frontend/src/components/chat/chat-thread.tsx`

- [ ] **Step 1: Close sidebar on navigation (mobile only)**

In `AppSidebar`, import `useSidebar` and call `setOpenMobile(false)` after `router.push(href)`:

```tsx
import { useSidebar } from "@/components/ui/sidebar";

// inside AppSidebar()
const { isMobile, setOpenMobile } = useSidebar();

const navigateConversation = useCallback((href: string) => {
  setOptimisticHref(href);
  startNavigating(() => {
    router.push(href);
    if (isMobile) setOpenMobile(false);
  });
}, [isMobile, router, setOpenMobile]);
```

- [ ] **Step 2: Chat thread safe-area padding**

In `ChatThread`, adjust the bottom input container and scroll padding:
- add `pb-[calc(env(safe-area-inset-bottom)+1rem)]` (or similar) to the input area wrapper
- reduce hard-coded `pb-40` in messages container in favor of a CSS variable or slightly smaller value on small screens (e.g. `pb-36 sm:pb-40`)

Example change:

```tsx
<div className={cn(containerClass, "flex flex-col gap-4 py-4 pb-36 sm:pb-40")}>
```

and for the absolute bottom container:

```tsx
<div className="pointer-events-none absolute bottom-4 left-0 right-0 z-10 pb-[env(safe-area-inset-bottom)]">
```

- [ ] **Step 3: “scroll to bottom” button placement on mobile**

If overlap is observed, move it up on small screens:

```tsx
<div className="pointer-events-none absolute bottom-32 sm:bottom-28 left-0 right-0 z-10">
```

- [ ] **Step 4: Manual verification**

Test with responsive mode (375×812) and at least one real mobile browser if available:
- open sidebar via trigger; tap a conversation; sidebar closes
- keyboard open: input usable, send works, last message visible

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/app/app-sidebar.tsx frontend/src/components/chat/chat-thread.tsx frontend/src/app/(app)/layout.tsx
git commit -m "fix: improve mobile sidebar and chat safe-area layout"
```

---

### Task 6: Docs update

**Files:**
- Modify: `frontend/README.md`

- [ ] **Step 1: Add the new route handler to “Route handlers (selected)”**

Add a bullet:
- `POST /api/conversations/:id/title/generate` → backend `POST /api/conversations/:id/title/generate`

- [ ] **Step 2: Commit**

```bash
git add frontend/README.md
git commit -m "docs: document conversation title generation route"
```

---

## Verification (before finishing)

- [ ] Backend tests:

```bash
uv run pytest -q
```

- [ ] Frontend typecheck/lint (if configured):

```bash
cd frontend
npm run lint
```

- [ ] Manual end-to-end:
1. login
2. create conversation → send first message → wait for AI → sidebar title updates
3. rename conversation → send more messages → title does not revert
4. toggle theme → reload → persists
5. mobile: open/close sidebar, chat input safe-area ok

