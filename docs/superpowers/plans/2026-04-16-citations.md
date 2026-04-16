# Citations (Sources) for KB Chat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add “引用来源” cards under each assistant reply in KB chat, backed by structured citations emitted from the RAG retrieval for that turn.

**Architecture:** Upgrade backend `/api/chat` to AI SDK Data Stream Protocol (token parts + finish part). On each request, capture retrieval `NodeWithScore` results, map them into a `citations[]` payload (doc/chunk/score/snippet), and emit them in the final `d:` part. Frontend switches from text-only streaming to data-stream parsing and renders citations under assistant messages.

**Tech Stack:** FastAPI, LlamaIndex, Supabase, Next.js 16, `ai` / `@ai-sdk/react`.

---

## File map (what changes where)

**Backend**
- Modify: `backend/app/api/chat.py` (content-type / streaming protocol)
- Modify: `backend/app/services/chat_service.py` (emit Data Stream parts; build citations)

**Frontend**
- Modify: `frontend/src/hooks/use-rag-chat.ts` (switch transport/protocol to Data Stream)
- Modify: `frontend/src/components/chat/chat-thread.tsx` (render citations card list for assistant messages)
- (Optional) Modify: `frontend/src/app/api/chat/route.ts` (ensure headers allow streaming; keep passthrough)

**Docs**
- Already created: `docs/superpowers/specs/2026-04-16-citations-design.md`
- Create: `docs/superpowers/plans/2026-04-16-citations.md` (this file)

---

### Task 1: Commit the approved spec + plan

**Files:**
- Add: `docs/superpowers/specs/2026-04-16-citations-design.md`
- Add: `docs/superpowers/plans/2026-04-16-citations.md`

- [ ] **Step 1: Verify git status is clean (except docs)**

Run:

```bash
git status
git diff
```

Expected:
- Only new/untracked docs files (no unrelated changes)

- [ ] **Step 2: Stage docs**

```bash
git add docs/superpowers/specs/2026-04-16-citations-design.md docs/superpowers/plans/2026-04-16-citations.md
```

- [ ] **Step 3: Commit**

```bash
git commit -m "$(cat <<'EOF'
docs: add citations design + plan

EOF
)"
```

---

### Task 2: Backend — emit Data Stream Protocol + citations payload

**Files:**
- Modify: `backend/app/api/chat.py`
- Modify: `backend/app/services/chat_service.py`

- [ ] **Step 1: Add a small encoder for Data Stream “text” parts**

Implement an encoder that produces exactly:
- `0:"<json-escaped token>"\n`

Example (Python):

```python
import json

def _ds_text(token: str) -> bytes:
    return f'0:{json.dumps(token, ensure_ascii=False)}\n'.encode("utf-8")
```

- [ ] **Step 2: Add a finish part encoder**

It must produce:
- `d:<json>\n`

Example:

```python
def _ds_finish(payload: dict) -> bytes:
    return f'd:{json.dumps(payload, ensure_ascii=False)}\n'.encode("utf-8")
```

- [ ] **Step 3: Build `citations[]` from retrieval nodes**

For each `NodeWithScore` in `nodes`:
- `kb_id`, `doc_id` from node metadata
- `chunk_id` from `TextNode.id_` (the `doc_chunks.id`)
- `chunk_index` if available in metadata (or leave absent)
- `score` from `NodeWithScore.score`
- `snippet` from `node.text` truncated to ~300 chars

Also enrich with document title/source:
- Batch query Supabase `documents` table by `{user_id, doc_ids}` and map `doc_id -> {title, source}`
- If no row found, omit title/source and let UI fall back to `doc_id`

Pseudo-code:

```python
def _truncate(s: str, max_len: int = 320) -> str:
    s2 = " ".join((s or "").split())
    return (s2[: max_len - 1] + "…") if len(s2) > max_len else s2
```

- [ ] **Step 4: Change `stream_chat()` to yield DS parts**

Instead of `yield token.encode("utf-8")`, do:
- yield `_ds_text(token)` for each token
- after streaming completes: yield `_ds_finish({"citations": citations})`

Important constraints:
- Keep message persistence behavior: write assistant message once at completion
- Do not include `user_id` in the payload
- If retrieval fails or is empty: citations is `[]`

- [ ] **Step 5: Adjust `/api/chat` route to match protocol**

In `backend/app/api/chat.py`:
- set `media_type="text/plain; charset=utf-8"` (or the repo’s expected stream content type)
- keep `StreamingResponse(gen, ...)`

Note: The backend standards mention Data Stream Protocol parts; the content type can remain plain text as long as the client parses the stream lines.

- [ ] **Step 6: Manual verification (backend only)**

Run (in one terminal):

```bash
uv run uvicorn backend.app.main:app --reload --port 8001
```

Then in another:

```bash
curl -N -X POST "http://localhost:8001/api/chat" \
  -H "content-type: application/json" \
  -H "authorization: Bearer <SUPABASE_JWT>" \
  -d '{"conversation_id":"<id>","kb_ids":["<kb>"],"message":"test","top_k":2}'
```

Expected:
- Stream output lines starting with `0:`
- Final line starting with `d:` containing `{"citations":[...]}`

---

### Task 3: Frontend — parse data stream and render citations cards

**Files:**
- Modify: `frontend/src/hooks/use-rag-chat.ts`
- Modify: `frontend/src/components/chat/chat-thread.tsx`
- (Optional) Modify: `frontend/src/app/api/chat/route.ts`

- [ ] **Step 1: Switch `useChat` to data stream protocol**

Current implementation uses:

```ts
transport: new TextStreamChatTransport({ api: "/api/chat" })
```

Change to the AI SDK data-stream compatible setup. Implementation detail depends on the installed `ai` package API:
- Option A (preferred if supported): remove custom transport and use `api: "/api/chat"` with default transport
- Option B: use a Data Stream transport if exported by `ai`

Verification step:
- Ensure assistant messages still stream incrementally

- [ ] **Step 2: Capture `citations[]` from the finish payload**

When the stream finishes, extract citations and attach them to the assistant message in UI state.

If the AI SDK exposes message “data”/“annotations”/“metadata”:
- store citations in that field

If not:
- maintain a side map: `assistantMessageId -> citations[]`

- [ ] **Step 3: Render citations under assistant messages**

In `chat-thread.tsx`, for each assistant message:
- if `citations.length === 0`, render nothing
- else render a “引用来源” section with cards

Card content:
- title: `title ?? source ?? doc_id`
- score: render with fixed precision
- snippet: clamp lines (2–3) + “展开” button if desired

- [ ] **Step 4: Link behavior**

On click, navigate to the best available document page:
- If there’s a route like `/knowledge-bases/<kb>/documents/<doc>` use it
- Otherwise fall back to `/knowledge-bases/<kb>` and highlight doc in list (future enhancement)

- [ ] **Step 5: Frontend verification**

Run:

```bash
cd frontend
npm run dev
```

Expected:
- Chat works as before
- Assistant replies show “引用来源” cards when KB has matches

---

### Task 4: Quality gates

**Backend**
- [ ] Run:

```bash
uv run ruff check backend
```

Expected: PASS

**Frontend**
- [ ] Run:

```bash
cd frontend
npm run lint
```

Expected: PASS

---

### Task 5: Commit implementation

- [ ] Stage changes:

```bash
git add backend frontend
```

- [ ] Commit:

```bash
git commit -m "$(cat <<'EOF'
feat: show citations under chat answers

EOF
)"
```

---

## Plan self-review (quick)

- Spec coverage: citations model + DS protocol + UI cards are covered by Tasks 2–3
- No placeholders: steps include concrete files, code snippets, and commands
- Type consistency: `citations: Citation[]` naming is consistent with the spec

