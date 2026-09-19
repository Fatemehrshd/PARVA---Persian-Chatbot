# Architectural Decisions

## ADR-001: Independent Vue 3 + Vite Frontend & NestJS Backend
- **Status**: Accepted
- **Context**: Project initialization requiring Vue 3 + Vite on the frontend and NestJS on the backend.
- **Decision**:
  - Independent `frontend/` and `backend/` folders, each with dedicated `package.json`, TypeScript configuration, and dependency management.
  - TypeScript used across both frontend and backend.
  - Environment variables defined in `.env` with `.env.example` templates provided.
  - CORS configured on the backend dynamically referencing `FRONTEND_URL`.

## ADR-002: Standardized API Response Envelope `{ success, message, data }`
- **Status**: Accepted
- **Context**: The API contract originally returned raw entity objects directly (e.g. `User`, `Conversation`, `Model[]`). To establish uniform client-side parsing, error feedback, and predictable metadata, all responses need a consistent wrapper.
- **Decision**:
  - All JSON responses defined in `api-contract.yaml` now wrap payloads in `{ success: boolean, message: string, data: any }`.
  - On the backend, a global `ResponseEnvelopeInterceptor` intercepts responses and wraps them in `{ success: true, message: 'Operation successful', data: ... }`.
  - The interceptor explicitly skips Server-Sent Events (SSE `text/event-stream`) used for real-time chat streaming to prevent breaking event chunking.
  - `HttpExceptionFilter` formats all exceptions as `{ success: false, message: '...', data: null, statusCode, error }`.
  - On the frontend, `request<T>()` in `api.ts` transparently unwraps `data` when present, ensuring caller code (stores, views) remains clean and decoupled from transport metadata.

## ADR-003: Hybrid Form Handling & Auth Route Protection Architecture
- **Status**: Accepted
- **Context**:
  1. Previously, `frontend/src/stores/models.ts` and `auth.ts` contained offline mock fallback blocks that swallowed HTTP errors (such as `403 Forbidden` or `401 Unauthorized`) and created fake entities in memory. This gave the illusion that non-admin users could register models, when in fact the backend correctly blocked them with 403.
  2. Form submissions (login, signup, model registration) lacked a unified abstraction for loading states, double-submission prevention, and backend validation mapping (`class-validator` arrays).
  3. Route protection and role-based UI visibility were missing, allowing unauthenticated or non-admin users to directly access protected views or buttons.
- **Decision (Option 3 - Hybrid Architecture)**:
  - **Universal Form Composable (`useFormSubmit`)**:
    - Centralizes loading (`isSubmitting`), form-level error message (`error`), granular field errors (`fieldErrors`), double-submit locking, and success/error callbacks.
    - Automatically maps NestJS `class-validator` error arrays directly to field error bindings.
    - Provides a clean `reset()` and field error clearing mechanism.
  - **Global HTTP Client Interceptor (`api.ts`)**:
    - System-level errors (`401 Unauthorized` outside of auth routes) immediately clear invalid tokens from `localStorage`, notify the user via a global toast, and route to `/login`.
    - Server-level errors (`500+ Internal Server Error`) trigger a global toast notification.
  - **Elimination of Mock Fallbacks in Production Stores**:
    - Removed offline mock item generation in `models.ts` and fake login sessions in `auth.ts`. Real backend responses and errors are propagated honestly to the UI.
  - **Route Navigation Guards (`router.beforeEach`) & Role Gating**:
    - Routes annotated with `meta: { requiresAuth: true }` redirect unauthenticated visitors to `/login`.
    - Routes annotated with `meta: { requiresAdmin: true }` (e.g. `/admin/models`) redirect non-admin users to `/`.
    - Routes annotated with `meta: { guestOnly: true }` (e.g. `/login`, `/signup`) redirect authenticated users to `/`.
    - Admin UI action triggers (e.g. "Admin Panel" button in `AppHeader.vue`) are conditionally rendered with `v-if="authStore.isAdmin"`.
  - **Reactive Toast Notification System**:
    - Lightweight, reactive toast manager in `useUiStore` and `ToastContainer.vue` providing non-blocking visual feedback for both system events and successful mutations.
- **Consequences & Benefits**:
  - Clear separation of concerns: form UI logic handles user-facing validation errors locally, while network-level auth expiry and 500 crashes are handled globally.
  - Zero mock state leaks: users receive immediate, accurate feedback when unauthorized or when operations fail.
  - High testability: composable and stores are isolated and thoroughly covered by unit tests.

## ADR-004: OpenAI Compatibility, Admin Decluttering, Theme Engine & Grok Gradient
- **Status**: Accepted
- **Context**:
  1. The platform needs to support arbitrary OpenAI-compatible LLM endpoints (e.g. self-hosted vLLM, Ollama, OpenRouter, Azure OpenAI, or official OpenAI) with custom base URLs and API keys, and allow admins to toggle active/inactive status.
  2. The Admin Panel had become visually cluttered with oversized cards.
  3. A robust Light and Dark mode toggle was needed via user settings.
  4. An animated, modern Grok-style cosmic fluid gradient was requested for login flow and chat entrance.
- **Decision**:
  - **OpenAI-Compatible Architecture**:

### Amendment: provider enable/disable removed from product rules
- This product decision was later tightened by requirement: the provider-level active/inactive toggle is intentionally removed from the product, because it created stale UI/API behavior and unnecessary cascading rules.
- Final rule: only model-level default protection remains. A default model cannot be disabled until another default is chosen, and exactly one platform default must exist at any time.
- Provider status is retained only as a legacy data flag for compatibility, but it no longer controls model availability, chat routing, or admin actions.

    - `AiModel` entity now persists optional `baseUrl` and `apiKey`.
    - Sensitive API keys are never leaked to the client; `ModelsAdminService` masks them (`sk-...${last4}`) when serving the admin panel.
    - Outbound: `ChatService` routes LLM calls to `${baseUrl}/chat/completions` using the provided bearer token if configured.
    - Inbound: Standard `/v1/models` and `/v1/chat/completions` controllers are exposed to allow third-party OpenAI-compatible tools to interact with CODELESS.
    - Model activation: `PATCH /admin/models/:modelId/status` toggles `isActive`. `ChatService` validates active status prior to dispatching prompts.
  - **Admin Panel UI Simplification**:
    - Retained `.metric-card` semantics for unit test compatibility while streamlining the presentation into compact, elegant status pills.
    - Single unified creation modal/form with optional endpoint settings.
  - **Theme Management**:
    - Centralized reactive state in `useUiStore` managing `'dark' | 'light'` theme class on `document.documentElement` and persisting in `localStorage`.
    - Dedicated visual selector cards in `SettingsModal.vue`.
  - **Cosmic Grok Aurora**:
    - Created `<GrokAurora />` utilizing radial blur gradients and CSS `@keyframes grokAuroraFlow` for 60fps GPU acceleration without heavy canvas libraries.
    - Embedded in `LoginView.vue` with pulse during auth, and in `ChatView.vue` with entrance fade/scale animation in both light and dark modes.

## ADR-005: Providers as First-Class Entities + Real Streaming + Credentialed `/v1`
- **Status**: Accepted
- **Context**: Requirements: (1) the admin must manage *providers* (create, delete, enable/disable, and a per-provider default model) and manage models under each; (2) provider API keys must live in the DB table (not env) so chat uses real models; (3) chat must actually stream real replies rather than mock echo. The previous model had `provider` only as a free-text label on `AiModel`, chat used `stream:false` (buffered) with a *silent* fallback to `Echo`, and `/v1/*` was unauthenticated.
- **Decision**:
  - New `AiProvider` entity (`ai_providers`): `name` (unique), `baseUrl`, `apiKey` (write-only; masked `sk-...last4` on every read), `isActive`, `defaultModelId`. `AiModel.providerId` is a FK with `ON DELETE CASCADE`; the legacy free-text `provider` column is retained for display and backward compatibility.
  - `ProvidersAdminService` owns provider CRUD: duplicate names → 409; empty `apiKey` on update means "keep existing"; deleting a provider cascades to its models and, if the platform-wide default was inside, re-promotes the oldest remaining active model of an active provider. `PATCH /admin/providers/:id/default` sets the per-provider default (model must belong to the provider and be active). Deleting a model that is some provider's default nulls that `defaultModelId` (never blocks the delete) so the admin re-points it.
  - **Backward compatibility for the existing admin UI**: `POST /admin/models` still accepts a free-text `provider` label and auto-upserts the provider row; it also honors an explicit `providerId`. A model may override the provider's `apiKey`/`baseUrl`.
  - **Credential resolution order** (`OpenAiCompatForwarder.resolveTarget`): key `model.apiKey → provider.apiKey → OPENAI_API_KEY` (env, optional global fallback only); baseUrl `model.baseUrl → provider.baseUrl → OPENAI_BASE_URL → https://api.openai.com/v1`.
  - **Real streaming**: `ChatService.answer()` → `generate()` async generator; upstream is called with `stream:true` and its SSE deltas are relayed token-by-token using Node 18+ global `fetch` (no new npm dependency). The offline `Echo` path now runs *only* when no credential resolves anywhere, and logs a WARN.
  - **Truthful failures**: before the first token → HTTP 502 envelope (SSE not yet started, so the exception filter still applies); mid-stream failure → the partial reply is persisted and the stream still ends with `event: done` (keeps the released frontend's `sendMessageStream` working — it does not understand a new `event: error`).
  - **`/v1/*` is now behind `JwtAuthGuard`** and forwards to real upstreams (unknown model → 404). Rationale: it can consume paid credits, so it must not be open.
- **Consequences**:
  - Adding a provider is a DB insert with a masked key — no server restart needed (unlike the earlier env-only proposal, superseded here).
  - Two "default" concepts coexist: platform-wide (`AiModel.isDefault`, used by the released frontend) and per-provider (`AiProvider.defaultModelId`). The platform default drives the chat fallback chain.
  - The SSE success wire format (`event: token` / `event: done`) is unchanged; only the failure path and internal chunking differ from v1.0.0.

## ADR-006: User Profile on MinIO, Re-auth Credential Changes, Preference Model (Task 15)
- **Status**: Accepted
- **Context**: The product spec asked for a full profile (username/bio/avatar on MinIO), email change with re-verification, password change, a forgot/reset flow, per-user preferences (language/theme/timezone/default model) and a per-user personalization system-prompt layer. During planning the owner decided: **forgot-password/reset is out of scope** (no email infrastructure exists), and **the personalization/prompt-builder layer is deferred** (explicitly "no changes" for now). Personalization endpoints therefore do NOT exist yet; profile/preferences/credentials do.
- **Decision**:
  - One `User` row carries profile + preference fields (`username, bio, avatarUrl, avatarKey, language, theme, timezone, defaultModelId`) — no separate entity until personalization lands. Shipped as a hand-written TypeORM **migration** (first one in the repo; `src/data-source.ts` + `migration:run/generate/revert` scripts), while dev continues with `DB_SYNC=true`.
  - Avatars go **only** to MinIO through a global `StorageService` (`MINIO_*` env). Deliberately **no disk fallback**: if storage is unconfigured, avatar endpoints return 503 — silent disk writes would diverge dev/prod behavior. Replacements/deletes remove the old object (`avatarKey`).
  - Upload validation before touching storage: mimetype allowlist (png/jpeg/webp) + 2 MB cap (multer limit AND service-level re-check).
  - Avatar bytes are served by `GET /static/avatars/{userId}/{file}` (public, streamed from MinIO, path-segment regex guard).
  - Email change: current-password re-auth inside the request + 409 on conflict; applies immediately (no verification link — no mailer exists). Password change: current-password re-auth, bcrypt re-hash. Wrong re-auth → 401.
  - Preferences: `language∈{fa,en}`, `theme∈{light,dark}`, IANA `timezone` validated via `Intl.DateTimeFormat`, `defaultModelId` must exist AND be active. Chat model resolution becomes **explicit → user default → platform default → echo sentinel**.
- **Consequences**:
  - Profile endpoints are JWT-gated by the existing `JwtAuthGuard` via `@CurrentUser()`; the frontend gained nothing yet (all new routes are additive).
  - When forgot/reset or personalization is later approved, they land as new modules/migrations — nothing here blocks them.
- **Amendment (follow-up, same task branch)**: the owner later decided to slim the schema — `bio`, `language`, `theme`, `timezone` and `defaultModelId` columns and the whole `/users/me/preferences` surface were **removed** (drop migration `1761000000000-DropUserProfileAndPreferences`); chat model resolution reverted to **explicit → platform default → echo sentinel**. Retained from this ADR: `username` (unique/lowercase), avatar-on-MinIO with 503-honesty, and current-password re-auth for email/password changes.
