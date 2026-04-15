# mini-rag

RAG system starter structure.

## Frontend UX

- After sign-in, the app now shows a global user avatar menu at the top-right of all `/(app)` pages.
- Click the avatar to open the user menu and use **退出登录** to sign out and return to `/login`.

## Backend (Python + uv + FastAPI + LlamaIndex + Supabase)

- All model calls (LLM + embeddings) must be made **only via HTTP APIs**.
- Do not add local inference ML deps (e.g. `torch`, `transformers`, default HF stack).
- All backend endpoints require `Authorization: Bearer <Supabase JWT>` (validated server-side via Supabase Auth API).

Install:

```bash
uv sync
```

Run:

```bash
uv run uvicorn backend.app.main:app --reload --port 8000
```

### Backend API (selected)

All endpoints require `Authorization: Bearer <Supabase JWT>`.

- **Knowledge bases**
  - `GET /api/kb`: list current user's KBs (ordered by `created_at desc`)
  - `POST /api/kb`: create KB `{ "name": "...", "description": "..." }`
  - `PATCH /api/kb/{id}`: update KB `{ "name"?: "...", "description"?: "..." }`
  - `DELETE /api/kb/{id}`: delete KB + associated `documents` + `doc_chunks` (best-effort storage cleanup)
  - `GET /api/kb/{id}/documents`: list documents under KB
  - `POST /api/kb/{id}/documents`: upload one or more **PDF** or **Markdown** files (`.pdf`, `.md`, `.markdown`; `multipart/form-data`, form field name `files`, repeated per file). Creates a `documents` row, uploads bytes to Supabase Storage, then runs ingestion (embed + `doc_chunks`). Markdown is interpreted as **UTF-8** text. Requires the `python-multipart` dependency (declared in `pyproject.toml` / `uv.lock`).

- **Documents**
  - `DELETE /api/documents/{id}`: delete one document + its `doc_chunks` (best-effort storage cleanup)

Env:

- Copy `.env.example` to `.env` and fill:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY` (server-side only)
  - `DEEPSEEK_API_KEY` (LLM; DeepSeek OpenAI-compatible)
  - `SILICONFLOW_API_KEY` (Embeddings; SiliconFlow OpenAI-compatible, `BAAI/bge-m3`)
  - `KB_DOCUMENTS_BUCKET` (Supabase Storage bucket name for uploads; default `kb-documents`)
  - `KB_DOCUMENT_MAX_BYTES` (per-file size limit; default `20971520`)

**Supabase setup for uploads**

- In the Supabase dashboard, create a **public or private** Storage bucket whose name matches `KB_DOCUMENTS_BUCKET` (default `kb-documents`). The backend uses the **service role** key to upload and download objects for ingestion.
- Apply `supabase.sql` (or run the `alter table` comments inside it) so `public.documents` includes `bucket` and `path` columns used for storage cleanup.

Docker (uv-optimized):

```bash
docker build -t mini-rag-backend .
docker run --rm -p 8000:8000 --env-file .env mini-rag-backend
```

## Database (Supabase)

Run the schema in `supabase.sql` in the Supabase SQL editor.

