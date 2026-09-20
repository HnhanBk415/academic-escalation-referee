# Sprint 1 technical decisions

- The deployed AI provider is Gemini; `FakeProvider` exists only for deterministic development and tests.
- Embeddings use `gemini-embedding-001` with exactly 768 dimensions.
- `AI_MODE=fake|gemini` selects the provider without changing workflow code.
- Missing or failed Gemini calls produce a safe `ESCALATE / AI_UNAVAILABLE` outcome.
- PostgreSQL with pgvector is the production database. SQLite is a test-only portability layer.
- Policy exceptions are selected with exact SQL scope filters and never by vector similarity.
- The Sprint 1 demo policy and rubric are synthetic and contain no real personal information.
- Frontend delivery is deferred until the backend, HTTP harness, and exception isolation pass.

