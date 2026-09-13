# Architecture Overview

## Monorepo Layout
- `frontend/`: Vue 3 + Vite + TypeScript application with Vue Router 4 and Pinia.
- `backend/`: NestJS + Express + TypeScript application.
- `api-contract.yaml` (project root): single source of truth for the API surface. The backend controllers and the frontend API client both follow this contract.
- Each service maintains its own dependencies, `package.json`, and `.env` configuration.

## Environment Variables
- **Frontend**: Vite-based variables prefixed with `VITE_` (e.g. `VITE_API_BASE_URL`). Types declared in `src/env.d.ts`.
- **Backend**: Loaded via `dotenv` from `.env` (e.g. `PORT`, `FRONTEND_URL`). CORS is configured in `main.ts` to allow requests from `FRONTEND_URL`.

## Backend Modules

The backend is organized as a NestJS application where each business capability is a self-contained module (controller + service + entity + dto + tests). Adding a new feature = adding a new module.

```
backend/src/
├── main.ts                          ← bootstraps Nest, registers global filter + validation pipe
├── app.module.ts                    ← TypeORM wiring + module composition
├── shared/
│   ├── http-exception.filter.ts     ← every error becomes {statusCode, message, error}
│   ├── jwt-auth.guard.ts            ← Bearer token validation (401 on missing/invalid)
│   ├── admin.guard.ts               ← role === 'admin' check (403 otherwise)
│   └── current-user.decorator.ts    ← @CurrentUser() request-scoped accessor
└── modules/
    ├── auth/                        ← signup, login, logout (JWT access + refresh)
    ├── users/                       ← User entity + UsersService
    ├── chat/                        ← Conversation + Message + streaming SSE
    └── models-admin/                ← AiModel entity + admin-only CRUD + default toggle
```

### Data flow: chat streaming
The chat endpoint (`POST /chat/conversations/{id}/messages`) is the only streaming endpoint today. It:
1. Validates the bearer token (JwtAuthGuard).
2. Persists the user's message.
3. Inspects `Accept` on the request:
   - `application/json` → returns the full saved assistant `Message` as JSON.
   - otherwise (default) → streams Server-Sent Events: `event: token` per generated chunk, `event: done` with the saved message id.

## Error Envelope

Every error response — whether from validation, a guard, the DB, or a thrown HttpException — is formatted by `HttpExceptionFilter` into:

```json
{ "statusCode": 401, "message": "Missing or invalid access token", "error": "Unauthorized" }
```

This shape matches the `Error` schema in `api-contract.yaml` and is the contract's single source of truth for error responses.

## Database

- PostgreSQL via TypeORM. Entities live alongside their owning module (`User`, `Conversation`, `Message`, `AiModel`).
- Schema is auto-created on boot when `DB_SYNC=true` (development default). For production, switch to migrations.
- The very first admin is seeded by `npm run seed:admin`, which is idempotent.
