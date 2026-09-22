# ── Stage 1: builder ─────────────────────────────────────────
FROM python:3.13-slim AS builder

WORKDIR /build

# Install build deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev && rm -rf /var/lib/apt/lists/*

# Copy dependency spec and install into a local prefix
COPY pyproject.toml .
RUN pip install --no-cache-dir --prefix=/install .

COPY . .

# ── Stage 2: runtime ──────────────────────────────────────────
FROM python:3.13-slim AS runtime

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 && rm -rf /var/lib/apt/lists/*

# Copy installed packages from builder
COPY --from=builder /install /usr/local

# Copy application source
COPY --from=builder /build/app ./app
COPY --from=builder /build/alembic.ini ./alembic.ini
COPY --from=builder /build/migrations ./migrations
COPY --from=builder /build/scripts ./scripts

# Non-root user
RUN adduser --disabled-password --gecos "" aer
USER aer

EXPOSE 8000

# Keep API availability independent from Gemini/document ingestion. Seeding is
# an explicit deployment step so a provider outage cannot prevent startup.
CMD ["sh", "-c", \
  "python -m alembic upgrade head && \
   python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1"]

