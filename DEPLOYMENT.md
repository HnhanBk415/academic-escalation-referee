# Deployment guide

The production deployment has two independent services:

- **API:** Render, built from `backend/Dockerfile`.
- **Web:** Vercel, built from the `frontend/` directory.

The API needs PostgreSQL with the `vector` extension available. A standard database without
pgvector will fail the first Alembic migration, which is intentional because RAG retrieval needs
that extension.

## 1. Deploy the API on Render

Create the service from this repository's `render.yaml` Blueprint or configure an equivalent
Docker web service using `backend/Dockerfile` with repository root as the build context.

Set these secret/environment values in Render; do not commit them to the repository.

| Variable | Value |
|---|---|
| `DATABASE_URL` | PostgreSQL URL using the `postgresql+asyncpg://` driver form |
| `GEMINI_API_KEY` | Gemini API key |
| `CORS_ORIGINS` | Comma-separated allowed origins, including the final Vercel URL |
| `PUBLIC_BASE_URL` | Final Render API origin, for example `https://your-api.onrender.com` |
| `AUTH_SECRET_KEY` | Random secret of at least 32 characters, used to sign browser sessions |
| `AUTH_USERS_JSON` | JSON map of provisioned `actor_id` to PBKDF2 password record |

The Blueprint supplies non-secret values such as `AI_MODE=gemini`, the Gemini models, RAG
defaults, `PROMPT_VERSION=referee-v3-structured-exceptions` and
`AUTH_MODE=password`.

In production, the browser first calls `POST /api/v1/auth/login`; the API stores neither the
password nor a long-lived API key in the frontend. It returns a time-limited Bearer token and
derives the actor and role server-side on subsequent requests. Do **not** set `AUTH_MODE=demo`
on a public deployment. Add every account referenced in `AUTH_USERS_JSON` to `data/demo-config.json`
or your own seed source so that its actor exists in the database.

Create one password record per account locally (the password input is hidden), then place the
result in the Render secret. Do not put a raw password in `AUTH_USERS_JSON` for production:

```bash
.venv/bin/python backend/scripts/hash_password.py
```

For example, the final secret is shaped like:

```json
{"student-a1":"pbkdf2_sha256$600000$...$...","lecturer-01":"pbkdf2_sha256$600000$...$..."}
```

On boot, the container runs migrations and the idempotent demo seed before starting Uvicorn.
This is deliberately fail-fast: a failed migration or seed leaves the deploy unhealthy instead of
serving without policy documents.

The application serves the academic question and escalation workflow (Flow 1).
Questions, decisions, exceptions, source documents and the append-only audit trail are fully tracked.
Database schema migrations are managed via Alembic under `migrations/`.

Validate the API after Render reports the deploy healthy:

```bash
curl -fsS https://your-api.onrender.com/health
curl -fsS https://your-api.onrender.com/health/ai
```

## 2. Deploy the web on Vercel

Import the same repository and set **Root Directory** to `frontend`.

Add the following Vercel environment variable for Production and Preview:

```text
VITE_API_BASE_URL=https://your-api.onrender.com
```

Vite injects this variable at build time, so redeploy the Vercel site whenever its value changes.
`frontend/vercel.json` rewrites client-side SPA paths to `index.html`.

Add the final Vercel production origin to Render's `CORS_ORIGINS`, for example:

```text
https://your-app.vercel.app
```

The backend already accepts `https://*.vercel.app` for preview deployments. Explicitly listing
the production origin remains recommended.

## 3. Release checklist

1. Ensure the database has pgvector and the application database user can create the extension.
2. Confirm `/health` reports `database: ok` and `/health/ai` reports the intended provider.
3. Sign in with a provisioned account, then submit one query and verify its citations. Use **Reset
   Data Demo** only with an Academic Affairs account when migrating an existing demo volume.
4. Submit a request requiring approval, decide it from the reviewer inbox, then verify the
   student history and Audit Trail reflect the decision.
5. Check the Render logs for migrations, seed completion and request errors before sharing the URL.

## Local production-like verification

```bash
docker compose up -d --build
docker compose ps
curl -fsS http://localhost:8000/health
curl -fsS http://localhost:8000/health/ai
```

For a configuration-only check, run `docker compose config --quiet`.
