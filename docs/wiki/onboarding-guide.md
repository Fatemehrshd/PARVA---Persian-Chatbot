# Onboarding Guide — Backend Architecture & Conventions

> A complete onboarding document for new team members joining this project.
> Read this together with the wiki: [README](./README.md) · [Getting Started](./getting-started.md) · [Architecture](./architecture.md) · [Features](./features.md) · [Decisions](./decisions.md)

---

## 1. Project Overview

**Parva** is a multi-model AI chat platform. Users chat with AI models from multiple providers (OpenAI-compatible), with optional live web search, deep thinking, file/document uploads, subscription plans, and an admin panel for full system control.

- **Golden rule:** a new feature must never break a previous one. Any behavior change to an existing feature must be explicitly documented in the commit message and `CHANGELOG.md`.
- **Monorepo:** `backend/` and `frontend/` are two fully independent projects (each with its own `package.json`, tests, and build). The only connection point is the **API** (REST + streaming via SSE/chunked HTTP).

| Layer | Technology |
|---|---|
| Backend | NestJS (TypeScript) |
| Frontend | Vue 3 (Composition API) + Vite |
| Database | PostgreSQL + TypeORM |
| Object storage | MinIO (avatars, uploads) |
| Payments | Zarinpal gateway + sandbox gateway |
| Observability | SigNoz APM (OpenTelemetry) |

---

## 2. Repository Layout

```
/
├── AGENTS.md                  ← project-wide rules (READ THIS FIRST)
├── backend/AGENTS.md          ← backend-specific rules
├── frontend/AGENTS.md         ← frontend-specific rules
├── CHANGELOG.md               ← version history (mandatory per task)
├── api-contract.yaml          ← OpenAPI contract (source of truth for shapes)
├── docs/wiki/                 ← onboarding wiki
├── backend/                   ← NestJS service
│   ├── src/main.ts            ← bootstrap: prefix, envelope, CORS
│   ├── src/app.module.ts      ← root module: TypeORM + all feature modules
│   ├── src/modules/           ← one folder per feature (self-contained)
│   ├── src/shared/            ← guards, interceptors, filters, decorators
│   ├── src/migrations/        ← production schema path
│   └── test/                  ← Jest specs (fakes at repo/service boundaries)
└── frontend/                  ← Vue 3 SPA
    ├── src/views/             ← pages (Login, Chat, AdminPanelView, ...)
    ├── src/components/        ← reusable components (chat/, admin/, ui/, layout/)
    ├── src/stores/            ← Pinia stores (auth, chat, models, ui, quota)
    ├── src/services/          ← API clients (fetch wrapper)
    └── tests/                 ← Vitest + Vue Test Utils
```

---

## 3. Architecture Overview

### 3.1 Request lifecycle

```
Client (Vue 3 SPA)
   │  fetch → Authorization: Bearer <JWT>
   ▼
main.ts bootstrap
   • global prefix: /api/v1 (excludes /, /v1/*, /static/*, /health)
   • ValidationPipe (whitelist + forbidNonWhitelisted + transform)
   • ResponseEnvelopeInterceptor  → { success, message, data }
   • HttpExceptionFilter          → { statusCode, message, error } (Persian messages)
   ▼
Guards: JwtAuthGuard → AdminGuard (admin routes)
Interceptors: QuotaInterceptor (stamps X-User-Quota on chat/profile responses)
   ▼
Controller → Service → TypeORM Repository → PostgreSQL
                                    └→ MinIO (files/avatars) / AI provider (streaming)
```

### 3.2 Response envelopes (contract-critical)

- **Success:** every response is wrapped `{ success: true, message, data }` by `ResponseEnvelopeInterceptor`.
- **Errors:** `HttpExceptionFilter` produces `{ statusCode, message, error }` with **Persian messages** from `shared/messages.fa.ts`.
- The frontend `request()` wrapper unwraps `data` automatically and throws `ApiError` otherwise.

### 3.3 Module map (all under `backend/src/modules/`)

| Module | Responsibility |
|---|---|
| `auth` | signup / login / logout, JWT issuing, token revocation registry |
| `users` | profile, credentials, avatars, admin user management, quota counters |
| `chat` | conversations, messages, SSE streaming, active-stream resume/stop, sharing, pins, feedback, quota enforcement, `/v1` OpenAI-compatible facade |
| `models-admin` | AI providers + models CRUD, default model, model access levels |
| `admin` | system settings (key/value), dashboard stats, server-side DataGrid queries |
| `files` | uploads → MinIO, malware scanning, processing queue, cleanup |
| `storage` | MinIO wrapper (honest 503 when unconfigured) |
| `web-search` | Serper.dev live search + quota accounting |
| `subscriptions` | plans, plan↔model grants, user subscriptions, **entitlement resolution** |
| `payments` | checkout, Zarinpal/sandbox gateways, coupons, verification, audit logging |
| `audit` | tamper-evident activity log with secret redaction |

**Rule:** every feature is a self-contained module (controller + service + entity + dto + test in one folder). Adding a feature = adding a module, not editing old ones — unless real integration requires it.

---

## 4. Authentication & Authorization (deep dive)

### 4.1 Endpoints (`modules/auth/`)

| Endpoint | Auth | Behavior |
|---|---|---|
| `POST /auth/signup` | public | email+password (min 8, bcrypt cost 10) + optional displayName; creates `role: 'user'`; returns `{ user, accessToken, refreshToken }`; 409 if email exists |
| `POST /auth/login` | public | bcrypt compare; 401 on bad credentials or inactive account (`isActive === false`); returns both tokens |
| `POST /auth/logout` | **JwtAuthGuard** | 204; revokes the **Bearer access token** taken from the guard (`req.token`), never from the request body |

### 4.2 JWT structure

`AuthService.tokens()` (`auth.service.ts:14-20`) signs with `JwtModule` secret from `process.env.JWT_SECRET`:

```ts
payload = { sub: user.id, email, role }
accessToken:  jwt.sign(payload, { expiresIn: '1h' })                    // auth header token
refreshToken: jwt.sign({ ...payload, type: 'refresh' }, { expiresIn: '7d' })
```

- Access token TTL **1 hour**; refresh token TTL **7 days** with a `type: 'refresh'` claim.
- Tokens are issued at signup and login; the refresh token exists in the contract/store but there is **no `/auth/refresh` endpoint yet** — a new login re-issues both. (Known roadmap item.)
- The JWT secret falls back to `'dev-secret'` in development — production must always set `JWT_SECRET` env.

### 4.3 Guard chain — where JWT verification happens

All of JWT verification is centralized in **`shared/jwt-auth.guard.ts`** (no Passport strategy — a deliberate simplification):

1. Extract token: `Authorization: Bearer <token>` header, falling back to `?token=` query param (needed for SSE `EventSource` endpoints that cannot set headers).
2. Reject if missing → `401 Missing or invalid access token`.
3. Reject if the token is in the **revocation registry** (`AuthService.isTokenRevoked`, static in-memory `Set`).
4. `jwt.verify(token)` (signature + expiry) → on success sets `req.user` (the decoded payload: `sub`, `email`, `role`) and `req.token`; on failure → 401.
5. `shared/current-user.decorator.ts` exposes the verified payload to controllers as `@CurrentUser()`.

### 4.4 Authorization — two guard layers

- **`JwtAuthGuard`** — authentication ("who are you?"). Applied per-controller: chat, users/me, files, models, admin, `/auth/logout`.
- **`AdminGuard`** — authorization ("are you admin?"). Stacked after `JwtAuthGuard` on every `/admin/*` controller. Key security decision: it **never trusts the JWT `role` claim** — it re-reads the role from the database on every admin request (`users.findById(user.sub)`), falling back to the token claim only if the DB lookup is unavailable (unit-test fakes). Consequence: demoting a user takes effect within one request, not when the token expires.
- **Ownership** — resource-level checks live in services, not guards: `ChatService.assertOwned()` ensures a user only touches their own conversations/messages; `AdminGuard` routes bypass ownership to grant admins full visibility.

### 4.5 Known limitations (documented, deliberate)

- Revocation registry is **in-memory** (`static Set`) — logout does not survive a server restart; fine for single-instance deployments, a DB/Redis store is the roadmap fix.
- No refresh-token rotation endpoint yet (see 4.2).
- `?token=` query fallback exists solely for `EventSource` (SSE) — browsers cannot set headers there; tokens in URLs must stay short-lived.

---

## 5. Chat & Streaming (the core flow)

1. `POST /chat/conversations/:id/messages` with `{ content, fileIds?, useWebSearch? }`.
2. `ChatService.generate()` (async generator):
   - **Quota enforcement** (see §6): blocks with a structured `QUOTA_EXCEEDED` error when token/message caps are hit.
   - Optional **web search** (Serper) before the LLM call → numbered `[n]` sources injected into the system prompt; `sources`/`sources-error` SSE events.
   - **Provider resolution** via `models-admin` (provider apiKey/baseUrl stored in DB, masked on read; env `OPENAI_API_KEY`/`OPENAI_BASE_URL` is the only fallback). Echo-fallback when no key is configured (dev/tests only).
   - Streams token chunks; persists `isInterrupted`/`stoppedByUser`/`sources` on the final message.
3. Two transports: `POST` chunked streaming (first send) and `GET /chat/conversations/:id/stream` (SSE reconnect/replay via `ActiveStreamService` — 35s thinking watchdog, late-subscriber source replay, `stop`/`resume` endpoints).
4. **Usage accounting:** `UsersService.incrementUsage(userId, tokens, taskType, 1)` updates lifetime `usedTokens` **and** periodic counters (`periodUsedTokens`, `periodUsedMessages`) **and** per-task buckets (`usageByType` jsonb: normal/image/document/thinking).
5. OpenAI-compatible facade: `POST /v1/chat/completions` + `GET /v1/models` (own auth, excludes the `/api/v1` prefix).

---

## 6. Quotas, Entitlements & Billing

Three layers compose a user's effective limits (resolved server-side on every request):

```
EntitlementService.getUserEntitlements(userId)
  admin              → unlimited (short-circuit)
  plan (active sub)  → plan.tokenLimit / plan.messageLimit / plan features + allowedModelIds
  role quotas        → role_quotas[role] in system_settings  (tokenLimit, messageLimit, resetHours)
  personal           → users.tokenLimit / users.messageLimit  (per-user override)
  global fallback    → global_token_limit setting
limitSource: 'personal' | 'plan' | 'role' | 'global' | 'admin'
```

- **Periodic reset (lazy, no cron):** `resetHours` (default 6, `0` = never) on role quotas; `UsersService.syncPeriod()` zeroes `periodUsedTokens/periodUsedMessages` when the window has passed, checked at each send/quota read.
- **Blocking:** when exhausted, `ChatService` throws a structured 400 (`error: 'QUOTA_EXCEEDED'`, `reason: 'tokens'|'messages'`, `resetAt`); the frontend disables the composer/new-chat and shows "تا ساعت HH:mm امکان ارسال پیام ندارید".
- **Cost model:** admins configure a base rate (`tokenRatePer1000`) and **multipliers per task type** (`task_multipliers`: image/document/thinking) — effective rate = base × multiplier; `usageByType` buckets make past costs recompute when rates change. Admin users list exposes computed `usedCostUsd`.
- **Subscriptions & payments (phase 5):** plans (`subscription_plans` + `plan_models` grants), Zarinpal/sandbox gateways, coupon validation/usage tracking, payment verification → subscription activation; every mutation writes an **audit log** with secret redaction.

---

## 7. Database Schema

TypeORM entities (all registered in `app.module.ts`):

| Entity | Table | Notes |
|---|---|---|
| `User` | users | email (unique), passwordHash, role, isActive, **soft delete** (`isDeleted`), usedTokens, tokenLimit/messageLimit, periodStart/periodUsed*, usageByType |
| `Conversation` / `Message` | conversations / messages | messages carry role, content, isInterrupted, stoppedByUser, sources (jsonb), feedback |
| `AiProvider` / `AiModel` | providers / models | secrets masked on read; model accessLevel (`public/commercial/private`) + allowedUserIds whitelist |
| `SystemSetting` | system_settings | generic key/value — global limits, role quotas, task multipliers, web-search quota, feature flags |
| `FileAttachment` | file_attachments | MinIO keys, status, hasExtractedText |
| `SubscriptionPlan` / `PlanModel` / `Subscription` | subscriptions domain | plans grant model sets; subscriptions link user↔plan with status |
| `Payment` / `Coupon` / `CouponUsage` | payments domain | gateway authority/verify flow |
| `AuditLog` | audit_logs | actor, action, sanitized payload |
| `ChatShare` | chat_shares | shareCode (unique 32ch), fork support |

**Schema policy:** dev runs with `DB_SYNC=true`; production runs `npm run migration:run`. Every schema change = update the entity **and** hand-write a migration under `src/migrations/` (matching the existing `ALTER TABLE ... IF NOT EXISTS` style) so both paths stay identical.

---

## 8. Key Technical Decisions & Rationale

| # | Decision | Why |
|---|---|---|
| 1 | NestJS + TypeORM + PostgreSQL | Contract in `api-contract.yaml` assumes Nest-style envelopes; TypeORM migrations give prod-safe schema evolution with `DB_SYNC` for fast dev |
| 2 | Streaming-first chat (SSE + chunked POST) | Requirement: token-by-token rendering; `ActiveStreamService` enables reconnect/resume/stop across page refreshes |
| 3 | Custom `JwtAuthGuard` (no Passport) | One file, zero magic, full control over token extraction (header **and** query for SSE); revocation check stays in one place |
| 4 | `AdminGuard` re-reads role from DB | JWT claims are stale by design (1h TTL); instant demotion beats token-based trust |
| 5 | In-memory revocation set | Simplest logout semantics for a single instance; restart clears it — acceptable trade-off, roadmap: persistent store |
| 6 | Settings as key/value JSON in `system_settings` | No migration for every new knob (role quotas, multipliers, web-search quota); merges are per-key to avoid clobbering |
| 7 | Usage buckets (`usageByType` jsonb) | Cost = Σ(bucket × rate × multiplier) recomputed at read time → changing rates never corrupts historical costs |
| 8 | Lazy period reset (no cron) | One less moving part; correctness holds because the check runs before every send and quota read |
| 9 | Secrets masked at the service boundary | Provider API keys never leave the backend unmasked; frontend receives `••••` placeholders |
| 10 | Soft deletes everywhere (`isDeleted`) | Auditability + accidental-delete recovery; every query filters `isDeleted: false` |
| 11 | MinIO with honest 503 | Unconfigured storage fails loudly (503) instead of silently writing to disk |
| 12 | `forwardRef` between auth↔users↔chat modules | Circular domain dependencies resolved explicitly rather than merged mega-modules |
| 13 | Per-feature module isolation | Golden rule: new feature = new module; regression risk to existing features stays minimal |

---

## 9. Frontend Conventions — Vue 3, shadcn-vue, Tailwind

### 9.1 Vue 3 principles in this repo

- **Composition API + `<script setup>`** everywhere; no Options API.
- **Pinia** — one store per domain: `auth` (session/tokens), `chat` (conversations, streaming states per conversation in `convStreamStates`), `models`, `ui` (toasts/modals/theme), `quota` (remaining % synced from responses).
- **Services own HTTP**: views/stores never call `fetch` directly — they call `services/*.ts` which use the `request()` wrapper in `services/api.ts` (reads `VITE_API_BASE_URL` from env, **never** hardcoded; unwraps the `{success,message,data}` envelope; throws `ApiError`; global 401 → auto-logout + redirect to `/login`).
- **Streaming render:** chat tokens append into the store and render incrementally (`MessageList.vue` shows the in-flight bubble; auto-scroll with user-scroll override).
- **RTL/Persian first:** UI language is Persian, `dir="rtl"`, Persian digits in tables; every new component must be RTL-compatible.

### 9.2 shadcn-vue + Tailwind rules (enforced in review)

- **Tailwind utility classes only** for styling; dark mode via CSS variables (`--background`, `--foreground`, `--primary`, `--border`, ...) — no hardcoded hex in components.
- **shadcn-vue primitives** live in `src/components/ui/` (`Button`, `Input`, `Label`, ...). Import from the folder index: `import { Button } from '@/components/ui/button'`.
- **No new one-off CSS classes in `<style>` blocks** when utilities suffice; scoped styles are allowed only for layout glue the existing pattern already has (e.g., `.mono` for LTR digits).
- **Reusable admin building blocks** (do not re-invent):
  - `AdminTable.vue` — DataGrid (server-side pagination/search/sort/column filters; `columns` + `#row` slot; `align: 'center'` per column; first column stays start-aligned).
  - `AdminModal.vue` — modal shell (`eyebrow`, `title`, `@close`); responsive by default.
  - `BaseButton.vue` (`variant`: primary/ghost, `size`, `loading`) and `BaseToggle.vue`.
- **Modals compose the same pattern:** e.g. `UserEditorModal`, `RoleTokenLimitModal`, `TaskMultiplierModal` — props in (`open`, entity, `isSaving`), events out (`close`, `save`), dual $/token inputs synced via `tokenRatePer1000`.
- **Admin panels are server-side:** search/filter/sort/pagination hit the API (`ApiFeatures` on the backend); the frontend never filters large arrays locally.

### 9.3 Frontend testing

- **Vitest + Vue Test Utils** — tests are written from the user's point of view (mount, click, assert visible text), at least one happy path + one error case per feature.
- Commands: `npm run build` (includes `vue-tsc` type check), `npm run test:unit`.

---

## 10. Testing & Verification (backend)

- **Jest**: unit/integration specs in `backend/test/` using **fakes at repository/service boundaries** (no DB) — e.g. quota tests construct `new ChatService(fakeConvRepo, fakeMsgRepo, ...)` directly.
- Test at behavior level, not per-method: "user over quota gets `QUOTA_EXCEEDED`", "stopped messages carry no sources".
- **Before closing any task:** `npm run lint` (tsc), `npm run test`, `npm run test:e2e`, frontend `npm run build` + `npm run test` — all green; wiki + CHANGELOG updated.

---

## 11. First Week Checklist

1. Read `AGENTS.md` (root) + `backend/AGENTS.md` + `frontend/AGENTS.md`.
2. Run locally: `docker-compose up` (Postgres + MinIO), backend `npm run dev`, frontend `npm run dev` — see [Getting Started](./getting-started.md).
3. Trace one request end-to-end: login → `GET /models` → send a chat message → watch SSE chunks in DevTools.
4. Skim `api-contract.yaml` for the envelope shapes; read `shared/jwt-auth.guard.ts` and `shared/response-envelope.interceptor.ts` — they explain most of the "magic".
5. Read the admin panel flow: `AdminPanelView.vue` → any section → its backend controller (naming mirrors 1:1).
6. Skim `CHANGELOG.md` and `docs/wiki/features.md` to know what exists — then follow the golden rule when you add the next thing.
