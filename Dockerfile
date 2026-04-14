FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim AS builder

WORKDIR /app

# Install dependencies first (best layer cache)
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

# Copy app code
COPY backend ./backend

FROM python:3.12-slim AS runtime

WORKDIR /app

# Copy the virtualenv created by uv
COPY --from=builder /app/.venv /app/.venv
COPY --from=builder /app/backend /app/backend

ENV PATH="/app/.venv/bin:$PATH"
ENV PYTHONPATH="/app"

EXPOSE 8000

CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000"]

