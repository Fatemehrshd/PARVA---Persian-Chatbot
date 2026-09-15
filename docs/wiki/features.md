# Features

## Task 1: Full-Stack Project Initialization
- Initialized Vue 3 + Vite + TypeScript frontend with Vue Router 4 and Pinia state management.
- Initialized NestJS + TypeScript backend with Express platform adapter and CORS enabled.
- Added environment variable support (`.env` and `.env.example`) for both frontend and backend.
- Added `.gitignore` to prevent secret and build artifact leakage.

## Task 2: UI Overhaul & Responsiveness
- Installed and configured **Tailwind CSS** and **shadcn-vue** for the frontend.
- Added **Vazirmatn** font face to the project, ensuring proper Persian (RTL) typography.
- Made the frontend fully responsive.

## Task 3: Auth Page & Shadcn UI Integration
- Replaced modal authentication with dedicated `/login` and `/signup` routes using shadcn-vue components (`Card`, `Button`, `Input`, `Label`).
- Fixed ESM compatibility for `tailwind.config.js` and PostCSS bundling in `vite.config.ts`.
- Configured CSS variables and opacity tokens for shadcn-vue.
- Added comprehensive unit tests for `LoginView.vue`.

## Task 4: In-Form Model Picker & Admin Panel Access
- Relocated model selection dropdown from `AppHeader` to the chat composer input form (`ChatComposer.vue`), allowing users to switch models directly where they compose messages.
- Added popover dropdown with upward orientation in composer footer.
- Added direct access links to the Admin Panel (`/admin/models`) in Header, Sidebar, and inside the Models Modal.
- Added unit tests for in-form model selection in `ChatComposer.spec.ts`.

## Task 5: Admin Dashboard Overhaul & Global App Scrolling
- Transformed `/admin/models` into a full-featured Admin Dashboard with KPI metric cards (Total Models, Active Status, Connected Providers, Total Sessions).
- Added interactive toolbar with search filter and provider tabs (All, OpenAI, Anthropic, Google, Meta, Local).
- Built structured data table with status badges and quick actions (Set Default, Delete).
- Fixed root layout in `main.css` (`overflow-y: auto`, `#app min-height: 100vh`) so any page overflowing viewport height scrolls naturally.
- Added unit tests for Admin Dashboard in `AdminModelsView.spec.ts`.

## Task 6: Browser Autocomplete / Autofill Dark Theme Preservation
- Configured `-webkit-autofill` and `:autofill` CSS rules with inset box-shadow and text fill overrides to prevent browsers (Chrome, Edge, Safari, Firefox) from replacing input background and text colors with light yellow/white during autocomplete.

## Task 7: Global Async Loading & Form Control Disabling
- Created global composables `useAsyncAction` and `useLoadingState` (`src/composables/useAsyncAction.ts`) to orchestrate asynchronous execution with automatic `isLoading`, `error` handling, cancellation guards, and cleanup.
- Enhanced `<Button>` with `:loading` and `:disabled` props, rendering an inline SVG spinner and disabling pointer events during loading.
- Enhanced `<Input>` with explicit `disabled` and `loading` props and visual opacity transitions.
- Integrated `useAsyncAction` into AI model registration (both in `AdminModelsView.vue` and `ModelsModal.vue`), automatically disabling all form inputs (`name`, `provider`, `apiIdentifier`), secondary buttons (`cancel`), and the submission button while rendering an active loading spinner until completion.
- Integrated `useAsyncAction` into `LoginView.vue` for sign-in and sign-up flows.
- Added comprehensive unit test suite in `tests/useAsyncAction.spec.ts` and updated `AdminModelsView.spec.ts` and `LoginView.spec.ts`.

## Task 8: Frontend-Backend API Connection & Dedicated Service Layer
- Connected frontend to backend in accordance with OpenAPI specification (`api-contract.yaml`).
- Established clear separation of concerns: Presentation (`views/`, `components/`) -> State/Business Logic (`stores/`) -> Domain API Clients (`services/`) -> Base HTTP Client (`api.ts`).
- Created dedicated, strongly-typed services: `authService`, `chatService` (with SSE token streaming reader and JSON fallback), and `modelsService`.
- Standardized error handling, automatic JWT Bearer injection, and response parsing in `api.ts`.
- Added unit test suites for all API services in `tests/services/` (total 38 tests passing across 10 test suites).
- Created dedicated frontend documentation in `docs/frontend/README.md` and `docs/frontend/services-architecture.md`.

## Task 9: Standardized API Response Envelope `{ success, message, data }`
- Updated OpenAPI contract (`api-contract.yaml`) to standardize all endpoint responses inside an envelope: `{ success: boolean, message: string, data: any }`.
- Built `ResponseEnvelopeInterceptor` in NestJS backend (`backend/src/shared/response-envelope.interceptor.ts`) registered globally and in `AppModule`.
- Updated `HttpExceptionFilter` to format errors with `success: false` and `data: null`.
- Enhanced frontend `api.ts` base client to unwrap `data` automatically when an envelope is detected.
- Verified test suite: 100% passing tests (38 backend tests across 8 suites, 39 frontend tests across 10 suites).
- Both frontend and backend production builds compile with 0 errors.

## Task 10: Hybrid Form Handling, Auth Route Guards & Model Admin Security
- **Universal Form Composable (`useFormSubmit`)**: Built a reusable composable (`frontend/src/composables/useFormSubmit.ts`) managing submission lifecycle (`isSubmitting`), form errors, field-specific validation mappings from NestJS `class-validator` arrays, and toast integration.
- **Global Network & Auth Interceptor (`api.ts`)**: Implemented automatic 401 session expiry handling (clears localStorage, notifies with toast, redirects to `/login`) and 500 server error notifications.
- **Root-Cause Resolution for Model Registration**: Eliminated silent offline fallbacks from `models.ts` and `auth.ts` that previously masked backend 403 Forbidden responses.
- **Route Navigation Guards (`router.beforeEach`)**: Protected `/` and `/chat/:id` with `requiresAuth`, `/admin/models` with `requiresAuth` and `requiresAdmin`, and `/login` & `/signup` with `guestOnly`.
- **Role-Based UI Gating**: Hidden admin entry points (e.g. Admin Panel button in `AppHeader.vue`) behind `v-if="authStore.isAdmin"`.
- **Reactive Toast Notification System**: Added floating, animated toast alerts in `ToastContainer.vue` powered by `uiStore.toasts`.
- **Test Coverage**: Added `tests/useFormSubmit.spec.ts`, bringing frontend unit tests to 45 passing tests across 11 test suites. Backend tests remain at 38/38 passing. Production builds for both frontend and backend compile cleanly with 0 errors.

## Task 11: OpenAI-Compatible Engine, Admin Decluttering, Light/Dark Modes & Grok Gradient
- **OpenAI-Compatible Endpoints & Outbound LLM Forwarding**:
  - Enhanced `AiModel` entity with `apiKey` and `baseUrl` columns.
  - `ChatService` dynamically connects to custom OpenAI-compatible endpoints (`${baseUrl}/chat/completions`) using provided API keys, passing conversation history and handling streamed/non-streamed generation with mock/offline fallbacks.
  - Exposes standard inbound OpenAI-compatible endpoints `GET /v1/models` and `POST /v1/chat/completions` supporting standard format and Server-Sent Events (SSE).
  - Masked API key storage and delivery (`sk-...last4`) preventing credential exposure.
  - Added model active/inactive status control (`isActive`) with `PATCH /admin/models/:modelId/status`, preventing chat interaction with deactivated models.
- **Decluttered Admin Dashboard (`AdminModelsView.vue`)**:
  - Replaced oversized KPI metric cards with sleek, minimalist stat badges, preserving required test selectors while eliminating visual bloat.
  - Streamlined table with instant interactive active/inactive toggle switches and quick actions.
  - Added optional `baseUrl` and `apiKey` fields to model creation forms.
- **Light & Dark Theme Engine (`SettingsModal.vue`, `uiStore`)**:
  - Centralized theme state in `useUiStore` (`'dark' | 'light'`) with auto-persistence in `localStorage` and `html.dark` class sync.
  - Interactive theme selection cards in the Settings modal with real-time visual feedback.
  - Refined theme CSS variables in `main.css` for both Obsidian Dark mode and clean Light mode.
- **Grok-Style Animated Aurora Background (`GrokAurora.vue`)**:
  - Hardware-accelerated fluid multi-color cosmic gradient background.
  - Ambient fluid animation on `/login` with loading pulse during sign-in.
  - Smooth entrance animation on `/chat` across both light and dark themes.
- **Conversation Management & Navigation Refinements**:
  - Added `DELETE /chat/conversations/:id` endpoint in backend with strict ownership verification (returns 404 for other users' conversations, 204 on success).
  - Wired frontend `chatService.deleteConversation` and `chatStore.deleteConversation` to sync deletion with backend.
  - Cleaned up `AppSidebar.vue` by removing the redundant Admin Panel section, keeping the sidebar focused solely on chat history.
  - Admin access is role-gated and accessible via the Header button (`v-if="authStore.isAdmin"`) and Settings modal.
- **Verification**:
  - 100% test pass rate: 41 backend tests and 45 frontend tests passing cleanly.

## Task 12: Conversation Rename & Delete Modals, Toast Right-Alignment & Theme Adaptivity
- **Conversation Rename & Deletion Modals**:
  - `EditConversationModal.vue`: Dedicated component dialog for renaming conversation titles with autofocus, trim validation, cancel, and save actions.
  - `DeleteConversationModal.vue`: Dedicated confirmation modal dialog requiring explicit user confirmation before conversation deletion, with warning icon and danger button styling.
  - Quick Action Buttons in `AppSidebar.vue`: Edit (pencil) and Delete (trash) action buttons appear seamlessly on conversation item hover.
  - Backend integration: `PATCH /chat/conversations/:id` renames conversation with ownership enforcement (404 for unauthorized) and title validation. `DELETE /chat/conversations/:id` removes conversation and its messages.
- **Right-Aligned & Theme-Adaptive Toasts**:
  - `ToastContainer.vue`: Anchored to the top-right screen edge (`right-4 items-end`), ensuring toast alerts are consistently displayed on the right.
  - Dynamic theme styling: Crisp light backgrounds (`bg-white/95 text-slate-900 border-slate-200/80 shadow-md`) in light mode and dark obsidian backgrounds (`bg-slate-900/95 text-slate-100 border-slate-700/60`) in dark mode.
## Task 13: Sidebar Bottom Logout & RTL/LTR Modal Button Layout
- **Sidebar Bottom Logout Flow**:
  - Removed direct logout trigger button from navbar (`AppHeader.vue`) and decoupled it from the user card in the sidebar.
  - Positioned a dedicated full-width logout button (`.logout-footer-btn`) sticking to the very bottom of the sidebar (`AppSidebar.vue`), clearly separated from user profile information.
- **RTL/LTR Left-Right Modal Button Layout**:
  - Standardized action buttons across all modals (`LogoutModal.vue`, `DeleteConversationModal.vue`, `EditConversationModal.vue`, and `ModelsModal.vue`) to occupy both the left and right edges (`justify-between`).
  - Buttons adapt dynamically to layout direction:
    - **RTL (Persian)**: Primary action button (e.g. `تأیید و خروج`, `حذف قطعی گفتگو`, `ذخیره عنوان`, `ثبت مدل`) positioned on the **Right** (start), and `انصراف` (Cancel) positioned on the **Left** (end).
    - **LTR (English)**: `Cancel` positioned on the **Left** (start), and Primary action button positioned on the **Right** (end).
- **Verification**:
  - 100% test pass rate: 44 backend tests and 47 frontend unit tests passing cleanly (91/91 total).

## Task 14: Provider Registry, Real Model Streaming & User Model Switching (backend only)
- **Provider entities**: `GET/POST /admin/providers`, `PATCH /admin/providers/:id` (rename, baseUrl, key rotation), `PATCH /:id/status` (enable/disable), `PATCH /:id/default` (per-provider default model), `DELETE /:id` (cascade-deletes its models; platform default auto-repromoted if swallowed). Keys stored in DB, write-only over the API, masked `sk-...last4` everywhere. `npm run seed:providers` backfills provider rows from legacy free-text labels.
- **Real streaming chat**: replies are streamed token-by-token from any OpenAI-compatible upstream (`stream:true`, global `fetch`, no new dependency). Resolution order model → provider → env fallback; offline `Echo` remains ONLY when no key exists anywhere (with WARN). Provider failure: 502 envelope before the first token; partial reply persisted + normal `event: done` mid-stream.
- **User model switching**: `PATCH /chat/conversations/:id` now accepts `{ modelId }` (and `{ title }` — both optional, at least one required). `GET /models` returns chat-usable (active model of active provider) models to every authenticated user.
- **Hardening**: `/v1/models` + `/v1/chat/completions` now require a bearer token (they can spend real credits) and forward to real models (unknown model → 404).
- **Contract**: `api-contract.yaml` → 0.5.0. **Tests**: 74 backend tests passing (44 pre-existing kept green + 30 new).

## Task 15: User Profile, MinIO Avatars, Credentials & Preferences (backend only)
- **Profile endpoints**: `GET/PATCH /users/me` — `displayName`, unique lowercased `username` (409 on conflict), `bio`. The `User` entity gained `username, bio, avatarUrl, avatarKey, language, theme, timezone, defaultModelId`, shipped via a dedicated TypeORM migration (`src/migrations/…AddUserProfileAndPreferences.ts`, run with `npm run migration:run`; local dev still auto-syncs with `DB_SYNC=true`).
- **Avatars on MinIO** (new `StorageModule` + `minio` dependency): `POST /users/me/avatar` (multipart field `file`; only `image/png|jpeg|webp`; ≤ 2 MB; replaces + deletes the previous object), `DELETE /users/me/avatar`. Files are served publicly at `GET /static/avatars/{userId}/{file}` (opaque random keys, streamed from MinIO). Without `MINIO_*` env, upload endpoints return **503** — no silent disk fallback.
- **Credential changes with re-auth**: `POST /users/me/email` (requires the current password → 401 if wrong; 409 if the email exists; applies immediately) and `POST /users/me/password` (requires current password; bcrypt re-hash). No forgot-password/reset flow (product decision).
- **Preferences**: `GET/PUT /users/me/preferences` — `language` (fa/en), `theme` (light|dark), IANA `timezone` (validated via `Intl`), and `defaultModelId` (must be an active model). Chat now resolves the model as **explicit → user default → platform default → echo sentinel**.
- **Contract**: new `Users` tag + 7 paths in `api-contract.yaml`. **Tests**: 95 backend tests passing (11 new in `profile.spec.ts`; all previous green). Frontend untouched.

## Task 16: Search Modal, Parva Branding, Stream Interruption & Spacing
- **ChatGPT-Style Search Modal (Full-Stack)**:
  - Backend: `GET /chat/conversations/search?q=...` searches conversation titles and message contents with snippet extraction.
  - Frontend: `SearchModal.vue` with live debounced search, `Ctrl+K` / `Cmd+K` keyboard shortcut, keycap badges, and conversation selection.
- **Backend Empty Conversation Prevention**:
  - `ChatService.create` checks the user's latest conversation: if it has 0 messages, it reuses and returns that empty conversation instead of creating a blank duplicate.
- **Personalized Animated Greeting**:
  - `EmptyState.vue` displays a typewriter animation greeting the user by name with smooth cursor blinking.
- **Chat Spacing & UX Refinements**:
  - `MessageList.vue` added top clearance (`58px` on mobile, `24px` on desktop) preventing overlap with floating hamburger button.
  - `MessageBubble.vue` displays single retry button on last message when interrupted or failed.
  - Rebranded platform to **«پروا» (Parva)** with `logo.jpg` integration and dark mode logo variant support.

  ## Task 17: Chat Resilience Audit
  - Added [Chat Resilience documentation](chat-resilience.md) covering the current handling of Offline/Online state, retry, URL-based conversation restoration, persisted history, and partial Streaming replies.
  - Recorded the remaining gap explicitly: the current implementation persists partial text but does not yet support a durable generation state or true resume from a cursor after reconnect.

## Task 18: Admin Panel Backend - Global Token Quota, Dynamic System Prompt, User Management, Model Lifecycle & Dashboard Analytics
- **Global Token Quota per User**: Admin can configure a global token consumption cap (`PUT /admin/settings` with `globalTokenLimit`). When `globalTokenLimit > 0`, any user who reaches or exceeds this limit is blocked from sending chat messages with an explicit, localized error: `سقف مجاز مصرف توکن به پایان رسیده است`.
- **Dynamic Platform System Prompt**: Admin can update the platform system prompt (`PUT /admin/settings` with `systemPrompt`). The chat generation engine automatically prepends this custom prompt to message histories sent to upstream AI forwarders.
- **Token Accounting**: Track total tokens used by each user (`usedTokens` column on `User` entity, initialized via TypeORM migration `1760100000000-AddAdminSettingsAndTokenUsage.ts`). Token consumption is calculated after streaming or mock reply (`Math.ceil((content.length + full.length) / 4)`) and atomically incremented.
- **Admin User Management & Analytics**: `GET /admin/users` lists all registered users with their conversation count (`conversationsCount`) and consumed tokens (`usedTokens`). `PATCH /admin/users/:userId` updates user details (role `user` or `admin`, `displayName`, `email`, resets/sets `usedTokens`). `DELETE /admin/users/:userId` deletes the user and cascades their conversations and messages (with self-deletion guard preventing admin accidental lockout).
- **Admin Dashboard KPI Metrics**: `GET /admin/dashboard/stats` aggregates essential platform statistics: `totalUsers`, `totalModels`, `activeModels`, `totalProviders`, `activeProviders`, `totalConversations`, `totalMessages`, `totalTokensUsed`, `globalTokenLimit`, and `systemPrompt`.
- **Full Model Lifecycle (Edit / Update)**: `PATCH /admin/models/:modelId` enables updating model properties (`name`, `provider`, `providerId`, `apiIdentifier`, `apiKey`, `baseUrl`, `isActive`).
- **Contract & Tests**: OpenAPI contract updated to `0.6.0` with new tags `Admin - Dashboard & Settings` and `Admin - Users`. 100% test pass rate: **111 backend tests passing across 15 test suites** (15 new tests in `admin-panel.spec.ts`).


