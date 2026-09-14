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
