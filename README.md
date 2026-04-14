# mini-rag

RAG system starter structure.

## Backend (Python + uv + FastAPI + LlamaIndex + Supabase)

- All model calls (LLM + embeddings) must be made **only via HTTP APIs**.
- Do not add local inference ML deps (e.g. `torch`, `transformers`, default HF stack).

Install:

```bash
uv sync
```

Run:

```bash
uv run uvicorn backend.app.main:app --reload --port 8000
```

Env:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SILICONFLOW_API_KEY`
- `DEEPSEEK_API_KEY`

## Database (Supabase)

Run the schema in `supabase.sql` in the Supabase SQL editor.

