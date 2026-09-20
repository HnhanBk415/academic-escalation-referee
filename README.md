# Academic Escalation Referee

Backend-first Sprint 1 implementation of an academic question referee. It answers grounded routine
questions, asks for missing facts, and escalates authority-sensitive or unsafe requests. Human
decisions can create tightly scoped, expiring policy exceptions; all actions are audited.

## Current scope

- FastAPI, SQLAlchemy, Alembic, PostgreSQL and pgvector.
- Gemini chat and 768-dimensional Gemini embeddings.
- Deterministic `FakeProvider` for tests and local development.
- Markdown, TXT and text-based PDF ingestion.
- RAG with course/version/date filters, citations and keyword fallback.
- Student questions, lecturer cases, decisions, scoped exceptions, cancel and revoke.
- 20-case evaluation dataset and five-case black-box HTTP Verify runner.
- React UI for student questions, lecturer review, audit and browser Verify.
- Synthetic CO3001 policy and rubric. No real personal information.

## Requirements

- Python 3.11 or newer. The PowerShell scripts use the Windows `py -3.13` launcher.
- Docker Desktop.
- A Gemini API key only when running `AI_MODE=gemini`.

## Setup

```powershell
Copy-Item .env.example .env
# Edit .env. Keep AI_MODE=fake initially, or set AI_MODE=gemini and GEMINI_API_KEY.
./scripts/setup.ps1
./scripts/dev.ps1
```

Without Docker, set `DATABASE_URL=sqlite+aiosqlite:///./aer-local.db` in `.env` and run:

```powershell
./scripts/setup.ps1 -SkipDocker
./scripts/dev.ps1
```

Open the application at <http://localhost:8000>. Swagger is available at
<http://localhost:8000/docs>. Health endpoints are `/health` and `/health/ai`.

Never commit `.env` or a Gemini key.

## Useful commands

```powershell
./scripts/seed.ps1
./scripts/reindex.ps1 # rebuild demo vectors after switching AI providers
./scripts/build.ps1
./scripts/verify.ps1 -BaseUrl http://localhost:8000

# Run all 20 evaluation cases
py -3.13 -m harness.runner `
  --base-url http://localhost:8000 `
  --dataset harness/datasets/evaluation.jsonl `
  --report harness/reports/evaluation.json
```

The Verify runner is black-box: it communicates only through HTTP and does not import application
code or query the database.

## Demo actors

| Actor | Role | Scope |
|---|---|---|
| `student-a1` | Student | Group A |
| `student-b1` | Student | Group B |
| `lecturer-01` | Lecturer | CO3001 reviewer |

The central acceptance test approves a six-member exception for Group A, confirms it does not apply
to Group B, revokes it, and confirms the general policy applies again.

## Documents

Synthetic source documents live in `data/sample-documents`. Register a document with
`POST /api/v1/documents`, then call `POST /api/v1/documents/{id}/ingest`. Source paths are restricted
to that directory. Scanned PDFs return `UNSUPPORTED_SCAN`; OCR is intentionally out of scope.

## Provider behavior

- `AI_MODE=fake`: deterministic keyword retrieval and decisions for repeatable tests.
- `AI_MODE=gemini`: Gemini embeddings, pgvector retrieval and structured Gemini decisions.
- Missing key, timeout, invalid schema or invented citations fail safely to escalation.

Policy exceptions are queried by exact actor/group/course scope and active date range. They are never
retrieved using vector similarity.
