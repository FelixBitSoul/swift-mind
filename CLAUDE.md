# SwiftMind (mini-rag) — Project Instructions

## Overview

SwiftMind is a personal knowledge assistant: upload PDF/Markdown docs into knowledge bases, then chat with them via RAG. Full-stack: Next.js frontend + FastAPI backend, both backed by Supabase (Auth, DB, Storage).

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend language | Python 3.11+ |
| Backend framework | FastAPI + LlamaIndex |
| LLM | DeepSeek (OpenAI-compatible HTTP API) |
| Embeddings | SiliconFlow BAAI/bge-m3 (OpenAI-compatible HTTP API) |
| Database / Auth / Storage | Supabase |
| Frontend framework | Next.js 15 App Router |
| Frontend language | TypeScript |
| UI components | shadcn/ui + Radix UI |
| Data fetching | TanStack Query |
| Package manager (backend) | uv |
| Linter (backend) | ruff |

## Critical Constraints

- **No local inference.** All LLM and embedding calls must go through HTTP APIs. Never add `torch`, `transformers`, or any local HF stack.
- **All backend endpoints require** `Authorization: Bearer <Supabase JWT>` — validated server-side via Supabase Auth API.
- **Multi-tenant isolation** — always filter by `user_id` (from `CurrentUser`) in every DB/storage operation.

## Build & Run

### Backend

```bash
# Install deps
uv sync

# Dev server
uv run uvicorn backend.app.main:app --reload --port 8000

# Lint
uv run ruff check .
uv run ruff format .

# Tests
uv run pytest backend/tests/
```

### Frontend

```bash
cd frontend

# Install deps
npm install

# Dev server (run manually in your terminal)
npm run dev

# Build
npm run build

# Lint
npm run lint
```

## Environment Setup

Copy `.env.example` → `.env` and fill:

```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
DEEPSEEK_API_KEY=
SILICONFLOW_API_KEY=
KB_DOCUMENTS_BUCKET=kb-documents
KB_DOCUMENT_MAX_BYTES=20971520
```

Frontend: copy `frontend/.env.example` → `frontend/.env`.

## Project Structure

```
backend/
  app/
    api/          # FastAPI routers (kb, documents, chat, conversations, ingest)
    core/         # config.py (Settings dataclass), auth.py (JWT validation)
    infra/        # supabase client, llms/deepseek, embeddings/siliconflow
    services/     # business logic (kb_service, chat_service, ingestion_service, ...)
    utils/        # data_stream, etc.
  tests/          # pytest unit tests
frontend/
  src/
    app/          # Next.js App Router pages
    components/   # UI components (ui/, chat/, auth/, providers/)
    hooks/        # React Query hooks
    lib/          # shared utilities
```

## Code Style

### Backend (Python)

- `from __future__ import annotations` at top of every file
- Frozen dataclasses for value objects (`@dataclass(frozen=True)`)
- `Settings` loaded via `get_settings()` — never instantiate directly
- snake_case for files/functions/variables; PascalCase for classes
- ruff line length: 100; target: py311; rules: E, F, I
- Validate all env vars at startup via `_must_getenv()` — fail fast with clear messages
- No mutation — return new objects

### Frontend (TypeScript)

- Next.js App Router conventions — server components by default, `"use client"` only when needed
- TanStack Query for all server state; no raw `fetch` in components
- shadcn/ui + Tailwind for styling — no inline styles
- camelCase for variables/functions, PascalCase for components/types
- Hooks in `src/hooks/`, shared utils in `src/lib/`

## Testing

- Backend: pytest, files in `backend/tests/`, named `test_*.py`
- Run from repo root: `uv run pytest backend/tests/`
- AAA pattern (Arrange / Act / Assert)
- 80% coverage minimum

## Git Conventions

Commit format: `<type>: <description>` (lowercase, imperative)

Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `ci`, `ui`
