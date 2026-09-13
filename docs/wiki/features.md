# Features

## Task 1: Full-Stack Project Initialization
- Initialized Vue 3 + Vite + TypeScript frontend with Vue Router 4 and Pinia state management.
- Initialized NestJS + TypeScript backend with Express platform adapter and CORS enabled.
- Added environment variable support (`.env` and `.env.example`) for both frontend and backend.
- Added `.gitignore` to prevent secret and build artifact leakage.

## Task 2: Backend MVP — Auth, Chat, Admin Models

Implements every endpoint defined in [`api-contract.yaml`](../../api-contract.yaml) at the project root.

### Auth (`POST /auth/*`)
- **`POST /auth/signup`** — create a new user with email + password (≥8 chars). Returns `{user, accessToken, refreshToken}` (201). 409 on duplicate email.
- **`POST /auth/login`** — exchange email + password for a JWT access + refresh pair (200). 401 on invalid credentials.
- **`POST /auth/logout`** — invalidate the caller's session. Requires a bearer token (401 without one).

### Chat (`/chat/conversations/*`)
- **`GET /chat/conversations`** — list the authenticated user's conversations.
- **`POST /chat/conversations`** — start a new conversation, optionally pinned to a specific `modelId` (otherwise falls back to the platform's default model).
- **`GET /chat/conversations/{id}/messages`** — full message history for one conversation (oldest first).
- **`POST /chat/conversations/{id}/messages`** — send a message. Streams the model reply as Server-Sent Events:
  - one `event: token` per token (`{"content": "..."}`)
  - a final `event: done` carrying `{"messageId": "<uuid>"}`
  - with `Accept: application/json`, returns the full saved `Message` instead of streaming.

### Admin (`/admin/models/*`)
- **`GET /admin/models`** — list configured AI models. Admin role required (403 otherwise).
- **`POST /admin/models`** — add a new model (`name`, `provider`, `apiIdentifier`, optional `isActive`).
- **`DELETE /admin/models/{id}`** — remove a model (204).
- **`PATCH /admin/models/{id}/default`** — promote a model to platform-wide default.

### Cross-cutting
- **Error envelope** — every error response matches the `Error` schema: `{statusCode, message, error}`. Enforced by a single `HttpExceptionFilter` in `src/shared/`.
- **CORS** — the backend allows the origin configured in `FRONTEND_URL` (default `http://localhost:5173`).
- **Routing** — controllers expose routes at their natural paths. No `/api/v1` versioning prefix.
- **Admin bootstrap** — `npm run seed:admin` (idempotent) creates the first admin user from `ADMIN_EMAIL` / `ADMIN_PASSWORD` env vars.

## Task 3: Build & docs hygiene
- Downgraded `@nestjs/jwt` to v10.2 for Jest / CommonJS compatibility.
- Enabled `esModuleInterop` in `tsconfig.json` so `bcryptjs` (ESM) imports correctly.
- Wiki + `CHANGELOG.md` updated to match the implementation.
