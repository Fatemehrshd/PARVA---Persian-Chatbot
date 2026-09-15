# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

## [0.6.0] - 2026-09-15

### Added
- **Admin Global Token Quota & Dynamic System Prompt (Task 18)**:
  - Added `SystemSetting` entity and `system_settings` table to store platform dynamic configurations.
  - `PUT /admin/settings` allows admins to set a global token consumption cap (`globalTokenLimit`) and a customized platform system prompt (`systemPrompt`).
  - Chat engine automatically validates user token usage against the global limit before generation and returns a localized 400 error (`سقف مجاز مصرف توکن به پایان رسیده است`) when reached.
  - Added `usedTokens` column to `users` table with atomic token consumption calculation upon message completion.
- **Admin User Management & Usage Analytics**:
  - `GET /admin/users` lists all registered users with their created conversations count (`conversationsCount`) and token usage (`usedTokens`).
  - `PATCH /admin/users/:userId` enables admin to update user roles (`user` / `admin`), profile details, and reset or adjust token usage.
  - `DELETE /admin/users/:userId` deletes users and cascades conversations/messages, protected with self-deletion guards.
- **Admin Dashboard KPI Statistics**:
  - `GET /admin/dashboard/stats` aggregates essential platform statistics: `totalUsers`, `totalModels`, `activeModels`, `totalProviders`, `activeProviders`, `totalConversations`, `totalMessages`, `totalTokensUsed`, `globalTokenLimit`, and `systemPrompt`.
- **Model Editing Endpoint**:
  - `PATCH /admin/models/:modelId` enables updating model name, providerId, apiIdentifier, apiKey, baseUrl, and active state.
- **Admin Wiki Documentation**:
  - Added [docs/wiki/admin.md](docs/wiki/admin.md) explaining all admin capabilities in simple Persian language.
- **Test Suite Expansion**:
  - Added comprehensive unit and integration tests in `test/admin-panel.spec.ts` (111 tests passing across 15 suites).

- **Parva Branding & Logo Integration**:
  - Integrated `logo.jpg` into `AppSidebar.vue` (both expanded and collapsed modes), `LoginView.vue` (brand icon and hero split screen), and `EmptyState.vue`.
  - Rebranded the platform name to **«پروا» (Parva)** across `index.html`, headers, login, and disclaimers.
- **Enhanced ChatGPT-style Stop & Retry UX**:
  - `useChatStore.stopStreaming()` guarantees the interrupted message is persisted with `isInterrupted: true` and an explicit notice even if 0 tokens had been streamed.
  - `MessageBubble.vue`: Prominently renders a `⏹ تولید توسط کاربر متوقف شد` (Response stopped by user) badge and a dedicated `تلاش دوباره` (Retry) button with icon.
- **Sidebar Responsiveness & Collapsed Content**:
  - Ensured the hamburger menu button is strictly hidden on desktop (`@media (min-width: 768px) { display: none !important }`).
  - Added recent conversation icons to the collapsed sidebar strip so it is no longer empty in collapsed/mini mode.
  - Fixed mobile drawer slide-in behavior in RTL mode (`transform: translateX(0) !important`).
- **Stream Resilience & Partial Message Recovery**:
- **Stream Resilience, Cancellation & Partial Message Recovery**:
  - `ChatService.generate()`: Guarantees via `try ... finally` that any accumulated assistant tokens are saved to PostgreSQL even when aborted mid-stream or when the client closes the tab/refreshes.
  - `ChatController.sendMessage()`: Implemented safe socket disconnect handling (`req.on('close')` and write-guards).
  - `useChatStore`: Tracks `lastUserPrompt` and adds `retryLastMessage()` and `continueLastMessage()` actions.
  - `useChatStore`: Integrated `AbortController` to abort ongoing HTTP streams when the user clicks stop, or switches/creates conversations.
  - `ChatComposer.vue` & `MessageList.vue`: Added borderless stop buttons (`.btn-stop` and `.stop-stream-btn`) allowing the user to halt AI token generation instantly with one click.
  - `MessageBubble.vue`: Displays compact "تلاش مجدد" (Retry) and "ادامه پاسخ" (Continue) buttons for interrupted or error assistant messages.
- **Online / Offline Network Detection**:
  - `useUiStore`: Added reactive `isOnline` status listening to browser `online` and `offline` events.
  - `NetworkStatusBanner.vue`: Displays an interactive offline warning banner with an on-demand "تلاش مجدد" (Retry) button.
- **Field-level authentication validation errors**: `LoginView.vue` presents targeted error messages directly underneath each input field (`displayName`, `email`, `password`) along with warning icons and red error focus outlines. Input modifications clear the respective error reactively.
- **Minimalist navigation and sidebar styling**:
  - Replaced boxy elements and harsh borders in `AppHeader.vue` and `AppSidebar.vue` with subtle hairline dividers (`rgba(140, 140, 160, 0.12)`).
  - Modernized `AppHeader.vue`: ghost-style navigation icons, borderless admin link, and sleek pill user status.
  - Modernized `AppSidebar.vue`: borderless card-free user profile section, ghost logout button with subtle red hover feedback, borderless action buttons (edit/delete chat title), and low-contrast sleek "New Chat" button.
- **Providers as first-class entities.** New `ai_providers` table (`name` unique, `baseUrl`, `apiKey` — write-only/masked, `isActive`, `defaultModelId`). `AiModel` gains `providerId` (FK, `ON DELETE CASCADE`).
  - `GET/POST /admin/providers`, `PATCH /admin/providers/:id` (metadata + key rotation — an empty `apiKey` leaves the stored key untouched), `PATCH /admin/providers/:id/status`, `PATCH /admin/providers/:id/default` (per-provider default model), `DELETE /admin/providers/:id`.
  - **Cascade delete:** deleting a provider deletes all its models; if the platform-wide default model was among them, the oldest remaining active model (of an active provider) is auto-promoted so the platform is never default-less.
  - **Per-provider default vs. model deletion:** removing a provider's default model never fails; it clears `defaultModelId` (null) and the admin can point it at another model via `PATCH /admin/providers/:id/default`.
  - Backward compatibility: `POST /admin/models` still accepts the free-text `provider` label and auto-upserts the provider row, so the existing admin UI keeps working; an optional `providerId` is honored when provided.
- **Real streaming chat (no more silent mock).** `ChatService.answer()` became `generate()` (async generator): the upstream OpenAI-compatible `/chat/completions` is called with `stream: true` and its SSE deltas are relayed token-by-token (Node 18+ global `fetch`, no new dependency). Credential/baseUrl resolution: `model.* → provider.* → OPENAI_API_KEY / OPENAI_BASE_URL env → openai.com`. The offline `Echo:` path now runs **only when no key exists anywhere** and logs a WARN.
- **Mid-conversation model switching for users.** `PATCH /chat/conversations/:id` now also accepts `{ modelId }` (title became optional; at least one of the two is required). The target must be an active model of an active provider (400 otherwise).
- **User-facing model listing.** `GET /models` (any authenticated user, not admin-only): active models of active providers, credentials masked — powers the chat model switcher.
- **Provider-aware availability:** a disabled provider makes its models invisible in `GET /models` and chat answers with 400 `Provider "x" is disabled`.
- `npm run seed:providers` — idempotent backfill that materializes provider rows from the legacy free-text `provider` labels, links models, copies per-model credentials up to their provider (only when the provider has none), and seeds each provider's `defaultModelId` from the platform default.

### Changed (behavior changes to previously released surfaces)
- **`/v1/models` and `/v1/chat/completions` now require a bearer token** (they were open). Rationale: `/v1/chat/completions` now forwards to real, paid upstream models instead of only echoing. An unknown `model` name returns 404 (previously echoed any name). The undocumented bare `/models` & `/chat/completions` aliases (registered via the `''` base path) were dropped — the compat surface is `/v1/*` only, freeing `GET /models` for the new user-facing listing.
- **Chat provider failures are no longer swallowed into an Echo reply.** Failure before the first token → HTTP 502 error envelope (SSE not started); failure mid-stream → the partial reply is persisted and the stream completes with `event: done` (keeps the released frontend working). `POST /chat/conversations/:id/messages` is buffered/pulled-one-chunk-early accordingly; the `event: token` / `event: done` wire format is unchanged.
- `api-contract.yaml` 0.4.0 → 0.5.0 (provider endpoints, `GET /models`, extended `UpdateConversationRequest`/`CreateModelRequest`/`Model` schemas, bearer required on `/v1/*`).
- **Validation messages are now Persian (fa).** Every `class-validator` decorator on a DTO carries a Persian `message`; all Persian strings are centralized in `src/shared/messages.fa.ts`. Inline DTO classes previously declared inside `chat.controller.ts` and `models-admin.controller.ts` are moved to their own `dto.ts` files. The global `ValidationPipe` now also enables `forbidNonWhitelisted: true` so unknown body fields are rejected with a clear 400 envelope instead of being silently stripped. `PATCH /chat/conversations/{id}` `modelId` is now validated as a UUID v4 (was any string).

---

## [1.0.0] - 2026-09-14

### Added
- **OpenAI-Compatible Inbound API**:
  - `GET /v1/models`: Standard OpenAI format listing all active models.
  - `POST /v1/chat/completions`: Standard OpenAI chat completion endpoint supporting standard JSON response as well as real-time Server-Sent Events (SSE) streaming (`stream: true`).
- **OpenAI-Compatible Outbound LLM Integration**:
  - Enhanced `AiModel` entity with `apiKey` and `baseUrl` columns.
  - `ChatService` dynamically connects to any custom OpenAI-compatible endpoint (Ollama, vLLM, OpenRouter, Azure, OpenAI) when configured.
  - API keys are securely stored and masked in admin API responses (`sk-...${last4}`).
- **Conversation Deletion Endpoint**:
  - Added `DELETE /chat/conversations/:id` to remove conversations and related messages with user ownership enforcement.
- **Conversation Rename Endpoint**:
  - Added `PATCH /chat/conversations/:id` to update conversation title with user ownership enforcement and non-empty title validation.
- **Conversation Action Modals**:
  - Added `DeleteConversationModal.vue`: Dedicated confirmation dialog preventing accidental deletion.
  - Added `EditConversationModal.vue`: Dedicated structured component modal with autofocus and save actions for renaming conversation titles.
- **Right-Aligned & Theme-Adaptive Toasts**:
  - Positioned toast alerts firmly to the right edge (`top-4 right-4 items-end`).
  - Adapted toast styling dynamically to the active theme (light background in light theme, obsidian dark in dark theme).
- **Model Status Toggle**:
  - Added `PATCH /admin/models/:modelId/status` to activate or deactivate models.
  - Inactive models are prevented from chat execution with 400 Bad Request.
- **Light / Dark Theme Engine**:
  - Added centralized theme switcher in `SettingsModal.vue` with visual selection cards.
  - State managed reactively in `uiStore` and persisted across sessions in `localStorage`.
- **Grok Cosmic Fluid Aurora Background**:
  - Built `<GrokAurora />` featuring fluid animated color blobs with GPU-accelerated keyframe transforms.
  - Active ambient animation on `/login` with pulse effect during login.
  - Entrance animation in `ChatView.vue` for both dark and light modes.

- **Logout Confirmation Modal**:
  - Added `LogoutModal.vue`: Dedicated confirmation modal dialog with warning illustration, cancel, and destructive confirm action with loading spinner.
- **RTL/LTR Left-Right Modal Button Standard**:
  - Arranged action buttons across all modals (`LogoutModal.vue`, `DeleteConversationModal.vue`, `EditConversationModal.vue`, `ModelsModal.vue`) to occupy both the left and right edges (`justify-between`), automatically aligning primary/confirm action to the right and cancel to the left in RTL, and cancel to the left and primary/confirm action to the right in LTR.

### Changed
- **Admin Panel Redesign & Decluttering**:
  - Replaced bulky cards in `/admin/models` with sleek, compact status badges.
  - Simplified registration form with collapsible/optional endpoint configuration (`baseUrl`, `apiKey`).
  - Added instant toggle switch for active/inactive status in the data table.
  - Removed Admin Panel section from the navigation sidebar (`AppSidebar.vue`) to keep the interface clean; accessible via the role-gated Header button and Settings modal.
- **Sidebar Logout Action Relocation**:
  - Removed direct logout button from `AppHeader.vue` and separated it from the user card in `AppSidebar.vue`.
  - Positioned a dedicated logout button sticking to the bottom of the sidebar footer with clear icon and text label.

---

## [0.3.0] - 2026-09-14

### Added
- **Universal Form Composable (`useFormSubmit`)**: Centralized composable for managing form submission, double-submit prevention, loading state, error banners, granular `class-validator` field error mapping, and toast integration.
- **Global Network & Auth Interceptors**: Auto-handling of 401 session expiry (clears tokens, displays warning toast, redirects to `/login`) and 500 server error notifications in `api.ts`.
- **Navigation Route Guards (`router.beforeEach`)**: Protection for `/` and `/chat/:id` (`requiresAuth`), `/admin/models` (`requiresAuth` and `requiresAdmin`), and `/login` / `/signup` (`guestOnly`).
- **Reactive Toast Notification System**: Floating, animated notifications (`ToastContainer.vue`) managed via `uiStore.toasts`.
- **Admin UI Gating**: Admin button in `AppHeader.vue` guarded by `v-if="authStore.isAdmin"`.
- **Unit Test Suite**: Added `tests/useFormSubmit.spec.ts` (6 new unit tests), bringing total frontend tests to 45.

### Changed
- **Model Registration Security**: Removed silent offline fallbacks from `models.ts` and `auth.ts` that previously swallowed 403 Forbidden responses. Real backend errors are now truthfully propagated and displayed in the UI.

---

## [0.2.0] - 2026-09-14

### Changed (Architectural Breaking Change)
- **Standardized API Response Envelope**: Updated `api-contract.yaml` and the NestJS backend to return all HTTP JSON responses within a standardized contract envelope:
  ```json
  {
    "success": true,
    "message": "Operation successful",
    "data": { ... }
  }
  ```
  And for error responses:
  ```json
  {
    "success": false,
    "message": "Error description",
    "data": null,
    "statusCode": 400,
    "error": "Bad Request"
  }
  ```
- **Backend Response Transformation**: Implemented `ResponseEnvelopeInterceptor` globally in NestJS to wrap controller returns into `{ success, message, data }` while bypassing SSE streaming (`text/event-stream`) and 204 No Content responses.
- **Backend Error Handling**: Updated `HttpExceptionFilter` to format exceptions with `success: false` and `data: null` alongside HTTP status codes and error messages.
- **Frontend Base Client**: Enhanced `request<T>` in `frontend/src/services/api.ts` to unwrap the `data` payload when an enveloped response is received, providing transparent backward and forward compatibility without requiring changes in Pinia stores or Vue views.

---

## [0.1.0] - 2026-09-14

### Added
- Multi-tier API connection connecting Vue 3 frontend to NestJS backend.
- Dedicated domain services (`authService`, `chatService`, `modelsService`).
- Server-Sent Events (SSE) streaming consumer for chat message generation.
- Admin dashboard for AI model management.
- Dual-column responsive authentication page.
- Onboarding documentation and wiki under `docs/wiki/` and `docs/frontend/`.

