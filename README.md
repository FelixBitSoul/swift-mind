# mini-rag

RAG system starter structure.

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

Env:

- Copy `.env.example` to `.env` and fill:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY` (server-side only)
  - `DEEPSEEK_API_KEY` (LLM; DeepSeek OpenAI-compatible)
  - `SILICONFLOW_API_KEY` (Embeddings; SiliconFlow OpenAI-compatible, `BAAI/bge-m3`)

Docker (uv-optimized):

```bash
docker build -t mini-rag-backend .
docker run --rm -p 8000:8000 --env-file .env mini-rag-backend
```

## Database (Supabase)

Run the schema in `supabase.sql` in the Supabase SQL editor.

