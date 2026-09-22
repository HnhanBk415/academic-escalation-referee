# ── Stage 1: builder ─────────────────────────────────────────
FROM python:3.13-slim AS builder

WORKDIR /build

# Install build deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev && rm -rf /var/lib/apt/lists/*

# Copy dependency spec and install into a local prefix
COPY backend/pyproject.toml ./backend/
RUN pip install --no-cache-dir --prefix=/install ./backend

COPY backend/ ./backend/

# ── Stage 2: runtime ──────────────────────────────────────────
FROM python:3.13-slim AS runtime

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 curl && rm -rf /var/lib/apt/lists/*

# Copy installed packages from builder
COPY --from=builder /install /usr/local

# Copy application source
COPY --from=builder /build/backend/app ./app
COPY --from=builder /build/backend/alembic.ini ./alembic.ini
COPY --from=builder /build/backend/migrations ./migrations
COPY --from=builder /build/backend/scripts ./scripts

# Copy sample data for RAG ingestion/seeding
COPY data ./data

# Non-root user
RUN adduser --disabled-password --gecos "" aer && chown -R aer:aer /app
USER aer

EXPOSE 8000

# Automatically run migrations and seed initial documents/users,
# dynamically listening on $PORT for Render cloud deployment.
CMD ["sh", "-c", \
  "python -m alembic upgrade head && \
   (python -m app.db.seed || true) && \
   python -m uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1"]
