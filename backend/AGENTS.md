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
│   │   ├── auth/        ← sign-up, login, JWT
│   │   ├── chat/        ← conversations, messages, streaming response
│   │   ├── models/      ← AI model management, setting the default model
│   │   ├── users/
│   │   └── ...          ← every new feature = a new, independent module
│   ├── shared/          ← shared guards, pipes, filters, decorators
│   ├── config/          ← env configuration
│   └── main.ts
├── test/                ← e2e tests
├── .env.example
└── package.json
```

Every module should be **self-contained** (controller + service + entity + dto + test in the same folder). Goal: adding a new feature = adding a new module, without touching previous modules' files unless real integration requires it.

## Conventions

- Sensitive config (DB connection, JWT secret) comes only from env — never hardcoded.
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
