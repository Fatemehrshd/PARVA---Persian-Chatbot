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

## Task 15: Dynamic Text Direction & Language Detection (RTL/LTR)
- **Dedicated Text Direction Utility (`getTextDirection`)**:
  - Implemented in `src/utils/textDirection.ts` and re-exported in `src/lib/utils.ts`.
  - Automatically identifies Persian/Arabic unicode ranges (`\u0600-\u06FF`, `\u0750-\u077F`, `\u08A0-\u08FF`, `\uFB50-\uFDFF`, `\uFE70-\uFEFF`, including specific Persian glyphs `گ`, `چ`, `پ`, `ژ`, `ک`, `ی`).
  - Filters out punctuation, numbers, emojis, and Markdown prefixes (`-`, `*`, `1.`, `>`, backticks) to inspect the primary character stream.
  - Returns `'rtl'` for Persian messages and `'ltr'` for English/Latin messages.
- **Message Bubble Dynamic Direction**:
  - `MessageBubble.vue`: Evaluates `textDirection` and binds `:dir="textDirection"` and `:class="textDirection"` to the message bubble, applying `text-align: right; direction: rtl;` for Persian and `text-align: left; direction: ltr;` for English.
  - `MessageList.vue`: The live streaming bubble evaluates `streamingDirection` based on incoming tokens, ensuring real-time alignment according to the response language.
  - `ChatComposer.vue`: The message input textarea adapts direction on the fly as the user types in Persian or English.
- **Verification**:
  - 100% test pass rate: 61 frontend unit tests passing across 13 test suites (`npm run test:unit`).
  - Production build verified with zero errors (`npm run build`).

## Task 16: Field-Level Validation Feedback & Minimalist Navigation & Sidebar UI
- **Field-Level Form Validation Errors**:
  - `LoginView.vue`: Displays field-specific error messages directly beneath the corresponding input fields (`displayName`, `email`, `password`) with alert icons, red borders, and error focus rings.
  - Errors clear dynamically as the user modifies the respective input field (`@input`), and reset upon switching authentication tabs (Sign In / Register).
  - Maintained global toast notifications and top error banners for overall submission feedback.
- **Minimalist UI Refinement for Header & Sidebar**:
  - **AppHeader.vue**: Softened bottom border to a subtle hairline divider (`1px solid rgba(140, 140, 160, 0.12)`), converted admin panel link and icon buttons to sleek ghost buttons, and upgraded user profile display to a clean pill badge.
  - **AppSidebar.vue**: Reduced visual clutter and nested boxes:
    - Softened sidebar border to hairline divider.
    - Updated `.new-chat-btn` and `.chat-item` to clean, modern rounded elements with smooth hover effects.
    - Removed heavy boxes and borders from `.action-chat-btn` (edit/delete) and `.user-card`.
    - Transformed `.logout-footer-btn` into a sleek ghost button with soft destructive hover highlights.
- **Verification**:
  - 100% test pass rate: 84 backend tests and 62 frontend tests passing (146 total).

## Task 17: Pragmatic Connection Resilience, Online/Offline Monitoring, and Stream Recovery
- **Backend Mid-Stream & Disconnect Persistence**:
  - `chat.service.ts`: Implemented a `try ... finally` persistence guarantee in `generate()`, ensuring that any accumulated assistant reply is saved to PostgreSQL even if the stream is aborted or the browser client closes/refreshes the tab.
  - `chat.controller.ts`: Added safe socket disconnect handling (`req.on('close')` and write-guarding) so client drops do not crash the stream process and allow partial persistence.
- **Click-to-Stop & Network Abort**:
  - `useChatStore`: Integrated browser-native `AbortController` to immediately terminate the ongoing `fetch` stream upon user cancellation, conversation switching, or new conversation creation.
  - `ChatComposer.vue` & `MessageList.vue`: Added borderless, sleek stop controls (`.btn-stop` and `.stop-stream-btn`) with smooth hover states, halting AI token generation instantly without wasting bandwidth or tokens.
- **Frontend Network Resilience**:
  - `uiStore`: Added reactive `isOnline` state and `initNetworkListeners()` for browser `online`/`offline` events.
  - `NetworkStatusBanner.vue`: Clean, minimal warning banner rendered at the top of the chat during internet disconnects, featuring an interactive "تلاش مجدد" (Retry) button that reconnects and refreshes the active conversation.
- **Stream Interruption Recovery**:
  - `chatStore`: Added `lastUserPrompt` tracking, `retryLastMessage()`, and `continueLastMessage()`.
  - `MessageBubble.vue`: Renders compact "تلاش مجدد" (Retry) and "ادامه پاسخ" (Continue) action buttons underneath interrupted or error assistant messages.
- **Verification**:
  - 100% test pass rate: 84 backend tests and 64 frontend tests passing cleanly (148/148 total).
  - 100% test pass rate: 84 backend tests and 65 frontend tests passing cleanly (149/149 total).


