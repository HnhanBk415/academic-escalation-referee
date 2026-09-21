FROM python:3.11-slim

# Prevent Python from writing .pyc files and enable unbuffered output
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy pyproject.toml first for layer caching
COPY apps/api/pyproject.toml ./apps/api/
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -e ./apps/api

# Copy API source and migrations
COPY apps/api/alembic.ini ./apps/api/
COPY apps/api/migrations ./apps/api/migrations/
COPY apps/api/app ./apps/api/app/

# Copy sample data for RAG ingestion/seeding (needed for seed.py & document ingest)
COPY data ./data/

# Switch working directory to apps/api so relative paths and alembic.ini resolve
WORKDIR /app/apps/api

EXPOSE 8000

# Run migrations then launch Uvicorn with dynamic port
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
