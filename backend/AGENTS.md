# AGENTS.md — Backend

This file is specific to working inside `backend/`. Project-wide rules live in [`../AGENTS.md`](../AGENTS.md) and are not repeated here — always consider both files together.

## Stack

- **NestJS** (TypeScript)
- **PostgreSQL + TypeORM**

## Suggested Folder Structure

```
backend/
├── src/
│   ├── modules/
│   │   ├── auth/          ← sign-up, login, JWT
│   │   ├── chat/          ← conversations, messages, streaming response (+ /v1 OpenAI-compat facade)
│   │   ├── ai/            ← OpenAI-compatible forwarder (real provider streaming)
│   │   ├── models-admin/  ← AI providers + models CRUD, defaults, public GET /models
│   │   ├── users/         ← profile, preferences, credentials, avatar endpoints
│   │   ├── storage/       ← MinIO object storage (avatars; MINIO_* env)
│   │   └── ...            ← every new feature = a new, independent module
│   ├── migrations/        ← TypeORM migrations (production schema path; dev uses DB_SYNC)
│   ├── data-source.ts     ← DataSource for the typeorm CLI (migration:run/generate)
│   ├── shared/            ← shared guards, pipes, filters, decorators, FA messages
│   └── main.ts
├── test/                  ← jest specs (fakes at repo/service boundaries)
├── .env.example
└── package.json
```

Every module should be **self-contained** (controller + service + entity + dto + test in the same folder). Goal: adding a new feature = adding a new module, without touching previous modules' files unless real integration requires it.

## Conventions

- Sensitive config (DB connection, JWT secret, MinIO credentials) comes only from env — never hardcoded. Provider **API keys for chat** are stored in the database (masked on every read); the only env-level AI fallback is `OPENAI_API_KEY`/`OPENAI_BASE_URL`.
- User-uploaded files go to **MinIO** via `StorageService` (`MINIO_*` env). No disk fallback: unconfigured storage must answer **503** honestly. Enforce type/size limits before touching storage; delete replaced/removed objects.
- All DTO validation errors use the centralized Persian messages in `src/shared/messages.fa.ts`.
- Schema changes: update the entity AND add a file under `src/migrations/` (`npm run migration:generate -d src/data-source.ts`, or hand-write SQL like the existing ones so dev `DB_SYNC=true` and prod migrations stay in sync).
- The chat response must be designed for **streaming** (SSE or chunked HTTP) from the start, not patched onto a synchronous response later.

## Testing

- Framework: **Jest** (NestJS default).
- After every feature, write at least one integration/e2e test for that endpoint's main path (per the testing philosophy in the root AGENTS.md) — not full mocking of every layer with a separate test per method.
- Commands:
  - `npm run test` — unit/integration tests
  - `npm run test:e2e` — end-to-end tests

## Checklist Before Closing a Task

- [ ] `npm run lint` passes with no errors
- [ ] `npm run test` and `npm run test:e2e` are green
- [ ] New endpoints are documented (Swagger or at least a short README)
- [ ] `docs/wiki/features.md` (and `architecture.md`/`getting-started.md` if needed) has been updated
