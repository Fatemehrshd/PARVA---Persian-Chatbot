# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Changed
- **All deletions are now soft-delete (production-ready)**: `users`, `ai_models`, and `ai_providers` gained an `isDeleted` flag; `DELETE /admin/users/:id`, `DELETE /admin/models/:id`, and `DELETE /admin/providers/:id` now flag rows instead of physically removing them (provider deletion soft-cascades to its models). Soft-deleted rows are hidden from every listing/lookup, and a soft-deleted user can no longer log in or use existing tokens (auth lookups filter `isDeleted: false`). Migration `1761600000000-SoftDeleteUsersModelsProviders` also converts the physical FK cascades `conversations.userId` and `file_attachments.userId` from `ON DELETE CASCADE` to `ON DELETE SET NULL` so a future hard purge can never destroy historical conversations or files. Deleting a model still nulls any provider `defaultModelId` pointing at it. Conversations, messages, and file attachments were already soft-deleted and are unchanged.

### Fixed
- **Streaming auto-scroll freeze after scrolling back down**: While a model response was streaming, if the user scrolled up and then back down, the follow mode locked and the page no longer scrolled with the stream (manual scrolling required). Root cause: the `isUserScrolling` flag was cleared by an 80ms debounce timer armed during the *upward* gesture, which could fire *after* the user had already returned to the bottom — canceling follow at exactly the wrong moment.
- **Streaming auto-scroll resistance on slow upward scrolls**: Scrolling up slowly during a stream used to snap back and fight the user inside the 120px bottom threshold. Follow state is now driven purely by scroll direction observed in the single `scroll` listener: any upward movement is user intent (programmatic scrolls only go down) and disengages follow instantly and smoothly, while landing near the bottom (120px) re-engages it. The `wheel`/`touchstart` listeners and the debounced user-scrolling flag were removed entirely. Regression coverage updated in `frontend/tests/MessageList.spec.ts` (slow upward scroll inside threshold releases follow; returning to the bottom resumes it).

## [1.4.0] - 2026-09-18

### Added
- Periodic token/message quotas with lazy hourly reset, role/user precedence, structured `QUOTA_EXCEEDED` errors, and `GET /chat/quota`.
- Per-task usage buckets and admin-configurable task multipliers with recomputable `usedCostUsd`.
- Quota snapshot synchronization via `X-User-Quota`, profile remaining percentage, and chat composer/new-chat blocking.

## [1.3.3] - 2026-09-18

### Added
- **Per-Role Global Token Limits (Admin Panel)**: Admins can now define a token consumption limit per user role. A new card in the admin "System Policies" section shows a dynamic table of all roles (auto-includes future roles via distinct roles from the users table) with their limit and an edit button. Clicking edit opens a responsive modal (`RoleTokenLimitModal`) with dual dollar/token inputs following the existing `UserEditorModal` pattern. Limits are stored in `system_settings` (`role_token_limits` JSON, merged per-role updates). Enforcement priority in `ChatService.generate`: user-specific limit → role limit → global limit. Role limit `0` or absent falls through to the global limit.
- **Live Effective Limit on Users Table**: `GET /admin/users` now resolves and returns `effectiveTokenLimit` per user (personal → role → global, via the pure `resolveEffectiveTokenLimit` helper). The admin users table (usage percentage, progress bar, quota-exhausted badge) is computed from this effective limit, tagging inherited limits with «سقف نقش» or «سقف سراسری». Changing a role's limit in the settings section applies to all members of that role on the next users-table load — no per-user edits needed.

### Fixed
- **Sources hidden for user-stopped messages**: When a user stops a streaming answer mid-generation (via the stop button), the `SourcesBlock` is no longer shown for that interrupted message. Backend now correctly sets `isInterrupted=true` and `stoppedByUser=true` on user-aborted messages and stores `sources=null`. Frontend gates `SourcesBlock` rendering on `!isInterrupted && !stoppedByUser`. Existing test `chat-stop-sources.spec.ts` validates this behavior.

## [1.3.2] - 2026-09-18

### Added
- **Show-Once Error Messages**: Error banners in the chat interface now display only once per occurrence. Dismissing an error (clicking ✕) registers its unique key in `sessionStorage` so that the error banner never reappears, even after page refresh or reconnect attempts. A new message send automatically clears previous dismissal history for that conversation.
- **Composer Text Draft Persistence**: User-typed text in the chat input is saved in real-time to `sessionStorage` keyed by conversation ID (`chat_draft_<convId>`). Switching conversations or refreshing the browser restores the draft text seamlessly. Sending a message clears the draft.
- **Uploaded File Persistence**: Files uploaded and processed to `ready` status are stored with full metadata in `sessionStorage` per conversation (`chat_files_<convId>`). Switching conversations or refreshing the browser preserves the uploaded files in ready state, eliminating duplicate uploads.
- **Model Connectivity Testing (Admin Panel)**: Added "تست اتصال مدل" (Test Model Connection) in `ModelEditorModal.vue` and backend endpoint `POST /admin/models/test`. Admins can verify model credentials and responsiveness with a lightweight ping before saving, viewing immediate latency (ms) and sample response.
- **Message Likes & Dislikes (User Feedback)**: Added interactive thumbs-up (👍) and thumbs-down (👎) action buttons under assistant messages in `MessageBubble.vue`. User feedback is immediately reflected in the UI and persisted to the database via `PATCH /chat/conversations/:id/messages/:messageId/feedback`.
- **User Experience & Satisfaction Dashboard (Admin Panel)**: Integrated a dedicated User Satisfaction KPI card and an aggregate "ارزیابی تجربه کاربری و شاخص کلی رضایت" section in `AdminDashboardSection.vue`, displaying total likes, total dislikes, and satisfaction percentage in aggregate without exposing individual user chats or message records.

## [1.3.1] - 2026-09-18

### Added
- **Strict Server-Side DataGrid Queries Across All Admin Tables**: Enabled `:serverSide="true"` for all admin sections (`AdminUsersSection`, `AdminChatsSection`, `AdminFilesSection`, `AdminModelsSection`, `AdminProvidersSection`). All search typing, inline column filtering, page changes, page-size adjustments, and column sorting send direct API query requests to `ApiFeatures` on the backend.
- **Debounced Search & Instant Clear Emits in AdminTable**: Added 250ms debounce for text input and column filters to optimize backend query load, while ensuring instant event dispatch on clear actions.
- **Permanently Fixed Admin Sidebar**: Updated `.admin-shell` to `height: 100vh; width: 100vw; overflow: hidden;` and `.admin-sidebar` to `position: fixed; top: 0; bottom: 0; right: 0; width: 250px; height: 100vh; overflow-y: auto;`. All scrolling is isolated to `.admin-main` (`margin-right: 250px; height: 100vh; overflow-y: auto;`), ensuring the sidebar remains 100% fixed and never scrolls away.
- **New Chat Gating During Model Response**: Completely disabled the "New Chat" button (in both expanded and collapsed sidebar modes) whenever a model is thinking or streaming a response. Added defensive checks in `useChatStore.createNewConversation` and contextual Persian tooltip explaining that a new chat cannot be initiated while receiving a reply.

## [1.3.0] - 2026-09-18

### Added
- **Full Modular Admin Refactoring**: Split monolithic 4,387-line admin panel into 8 standalone section pages under `frontend/src/views/admin/` and 5 dedicated modal components under `frontend/src/components/admin/modals/`.
- **Dedicated Vue Sub-routes per Admin Section**: Added `/admin/dashboard`, `/admin/providers`, `/admin/models`, `/admin/users`, `/admin/prompts`, `/admin/chats`, `/admin/files`, `/admin/file-settings` in `router/index.ts` with code splitting and lazy loading.
- **Lazy Per-Page Data Fetching**: Dashboard loads only KPI metrics and recent models without bulk-fetching all system entities.
- **Server-Side Pagination & Sorting**: Connected all 5 admin controllers (`models`, `providers`, `users`, `conversations`, `files`) to `ApiFeatures`.
- **Sticky Viewport Admin Sidebar**: Sidebar remains fixed (`position: sticky; top: 0; height: 100vh; overflow-y: auto;`) while tables scroll smoothly.
- **Server-Side Logout & Token Revocation**: Added token blacklist set in `AuthService` and revocation check in `JwtAuthGuard` on `POST /auth/logout`.
- **Proactive Auto-Logout & Session Expiration**: Added JWT expiration validation (`isTokenExpired`), 401 interception, and window focus monitors ensuring users are immediately logged out if their token expires or is missing.
- **Dedicated Documentation Artifacts**: Added `docs/admin-dashboard-frontend.md`, `docs/admin-dashboard-backend.md`, and `docs/auth-architecture.md`.

## [1.2.4] - 2026-09-18

### Added
- **Global `ApiFeatures` Backend Class (`backend/src/shared/api-features.ts`)**:
  - Implemented modular, chainable `ApiFeatures` class handling multi-field text search (`ILIKE %...%`), field-based filtering, dynamic sorting (`sortBy`, `sortOrder`), and database pagination (`skip`, `take`).
  - Integrated across admin controllers (`/admin/users`, `/admin/files`, `/admin/conversations`).
- **DataGrid Component Upgrade (`frontend/src/components/admin/AdminTable.vue`)**:
  - Built-in Inline Column Filter Row (`showColumnFilters`) under table headers enabling per-column search on any field.
  - Column sorting with toggleable ASC/DESC order indicators.
  - Configurable page size selector (`10`, `25`, `50`, `100` items per page) with Persian numeral formatting.
  - Quick filter toolbar with target field selector ("همه فیلدها" or specific field).
  - Enforced true tabular layout with horizontal scrolling (`overflow-x: auto; min-width: 720px`) on mobile devices.
- **Explicit Topbar Search Fields (`frontend/src/views/AdminPanelView.vue`)**:
  - Clear dynamic placeholders and scope badges indicating exact searchable fields for each active tab.
- **Circular Token Limit Progress Ring (`frontend/src/views/AdminPanelView.vue`)**:
  - SVG progress ring displaying the percentage of credit/quota filled (`usedPercent`), color-coded (green <70%, yellow 70-90%, red >90%), with exact dollar and token metrics.
- **Quick Credit Top-Up Buttons (`frontend`)**:
  - Added one-click recharge buttons (`+10$`, `+25$`, `+50$`, `+100$`) in user editor modal.
- **Attachment-Only Messaging Support (`frontend` & `backend`)**:
  - Enabled message submission when files or images are attached without requiring any text input (`hasText || hasFiles`).
  - Added fallback conversation naming based on the first attached filename.
  - Permanent retention for message-bound attachments, exempting them from the 48-hour orphaned file cleanup cron.
- **Immediate Token Exhaustion Feedback (`frontend`)**:
  - Added persistent warning banner above chat composer when a user has depleted their token balance.
  - Immediate send-blocking with descriptive error toast preventing stalled requests.
- **In-Chat Search in Admin Panel (`frontend`)**:
  - Added in-modal search toolbar in `AdminPanelView.vue` with next/previous navigation, match counter, visual match highlighting, and smooth auto-scrolling (`scrollIntoView`) to target messages.
- **Multimodal Image Token Calculation (`backend`)**:
  - Added `calculateAttachmentTokens` in `backend/src/modules/chat/chat.service.ts`:
    - 512x512 tile formula: 85 base + 170 tokens per tile for dimensional images.
    - Size-based formula: 85 base + 65 tokens per 128KB when dimensions are missing.
    - Added automated unit test suite `backend/test/image-tokens.spec.ts` (4/4 passed).
- **Admin File Management Panel (`مدیریت فایل‌ها`) (`backend` & `frontend`)**:
  - Implemented `AdminFilesController` with full administrative controls (stats, paginated list, inspection, retry, delete).
  - Dedicated "مدیریت فایل‌ها" section in `AdminPanelView.vue` with KPI summary strip and status filter chips.
- **OpenTelemetry & SigNoz APM Integration (`backend` & `frontend`)**:
  - Integrated native OpenTelemetry OTLP HTTP trace exporter sending trace spans to SigNoz collector on port `4318`.
  - Added direct quick-launch action button in Admin Panel to open the standalone SigNoz APM dashboard (`http://localhost:3301`).
- **Standard Iran Timezone & Date (`frontend`)**:
  - Implemented `formatIranDate`, `formatIranTime`, and `formatIranDateTime` with Persian digits and `Asia/Tehran` timezone in `frontend/src/lib/date.ts`.

### Changed & Fixed
- **User Consumed Tokens Immutability (`backend` & `frontend`)**:
  - Made user historical token consumption (`usedTokens`) strictly read-only in the admin panel and omitted it from update payloads to ensure ledger integrity.
- **Credit Recharge Input Reactivity Bug (`frontend`)**:
  - Fixed numeric input reactivity in user edit modal, enabling seamless two-way dollar and token calculations.
- **Mojibake Character Fix (`frontend`)**:
  - Replaced corrupted character strings in `AdminTable.vue` and `DeleteConfirmModal.vue` with proper Persian text.
- **Display Name and Email Separation (`frontend`)**:
  - Separated combined user column into distinct "نام کاربر" and "ایمیل" columns in both Users and Conversations tables.
- **Removal of Default Model Star Icon (`frontend`)**:
  - Completely removed star icon (`*` / `★` / `☆`) and default toggles from models and providers tables per client requirement.
- **Uniform Vazirmatn Typography (`frontend`)**:
  - Enforced `'Vazirmatn'` as primary font across entire application in `main.css`.
- **Chat Title ID Cleanup (`frontend`)**:
  - Removed truncated technical conversation IDs (`conv.id.slice(0, 8)...`) from chat title cell in admin panel.
- **BullMQ Worker Redis Connection Hanging Bug (`backend`)**:
  - Resolved issue where BullMQ Worker blocked the shared Redis client connection via `redisClient.duplicate()`.

---

## [1.2.3] - 2026-09-17

### Changed
- **Responsive Admin Console Tables & Modals (`frontend`)**:
  - Admin tables (`AdminTable.vue`) switch below 768px to a stacked card layout: the header row hides and every cell is labeled from its column label via a new `data-label` contract.
  - Filled the 768–1080px layout gap: KPI grid collapses to 2 columns; forms and dashboard grids collapse to one column below 1080px.
  - Modal hardening: `DeleteConfirmModal` action buttons stack full-width on narrow screens; `ModelsModal` card is viewport-bounded (`calc(100svh - 32px)`) with internal scrolling.
  - Mobile layout fix: removed leftover offset below 768px and compacted topbar/content spacing.

### Added
- **Paced Streaming & Auto-Scroll (`backend` & `frontend`)**:
  - Implemented token pacing delay (~25ms cadence) in `chat.service.ts` for natural real-time streaming visualization, guarded by `process.env.NODE_ENV !== 'test'` to ensure automated tests run at maximum speed (0ms).
  - Enhanced `MessageList.vue` with seamless auto-scroll tracking during active streaming responses while preserving user manual scroll position when navigating upwards.
- **Branded Logo Loading State on Chat Switch / Open (`frontend`)**:
  - Added `.chat-branded-loader` in `MessageList.vue` displaying the site's dynamic hummingbird logo (`useThemeLogo().activeLogo`) with a pulsating ambient glow and Persian subtitle ("در حال بارگذاری گفتگو...") while message history is loading (`chatStore.isLoadingMessages`).
  - Enforced a minimum 500ms smooth display duration (`MIN_CHAT_LOAD_DELAY_MS = 500ms`, 0ms in test) so the loading state and logo pulse render beautifully without abrupt micro-flickers.
  - Completely prevented the EmptyState welcome message from flashing during chat loading by keeping `isLoadingMessages = true` on view entrance and immediately clearing stale messages when switching conversations.
- **Skeleton Placeholder in Sidebar (`frontend`)**:
  - Added `.sb-skeleton-wrap` with 5 pulsing placeholder skeleton rows in `AppSidebar.vue` displayed when loading conversations (`chatStore.isLoadingConversations`).
- **50-Item Pagination for Conversations (`backend` & `frontend`)**:
  - Backend: Added `page` and `limit` pagination parameters to `GET /chat/conversations` (defaulting to 50 items per page with `skip: (page - 1) * take`) and `GET /admin/conversations`.
  - Frontend User Sidebar: Added "بارگذاری گفتگوهای بیشتر..." button in `AppSidebar.vue` and `loadMoreConversations()` in `chat.ts` to seamlessly load and append older conversations.
  - Frontend Admin Panel: Added `.table-pagination-bar` beneath the conversations table in `AdminPanelView.vue` with previous/next page navigation, active page badge, and 50-item indicator.
- **User Token Limit Exceeded Feedback & Lockdown (`frontend`)**:
  - Detected quota exhaustion (`سقف مجاز مصرف توکن`) in `chat.ts` to set `isTokenLimitExceeded`.
  - Displayed a dedicated amber/red alert banner (`.stream-error-banner--limit`) above the composer without a futile retry button, informing the user to contact the administrator.
  - Added red error badge ("خطا در ارسال پیام") beneath the failed message bubble in `MessageBubble.vue`.
  - Locked composer textarea and disabled send button when token limit is exceeded.
- **Provider / Model Configuration Separation**:
  - Centralized API token and Base URL configuration at the Provider level, ensuring Model definitions only require the model identifier/name.

## [1.1.0] - 2026-09-16

### Added
- **Admin Chat Viewer & Inspection (`backend` & `frontend`)**:
  - Added `AdminConversationsController` (`GET /admin/conversations`, `GET /admin/conversations/:id`, `DELETE /admin/conversations/:id`) secured with AdminGuard.
  - Added dedicated "گفتگوها" (Chats) section in `AdminPanelView.vue` displaying total conversations, user details, message count, creation dates, and full message history viewer modal with individual timestamps and message bubbles.
- **Dedicated System Prompt Section (`AdminPanelView.vue`)**:
  - Added a dedicated "پرامپت سیستم" (System Prompt) section in the admin sidebar with ready-to-use presets, real-time character/word/line count metrics, reset button, and direct backend persistence.
- **Fixed & Rigid Admin Sidebar**:
  - Sidebar is permanently pinned (`position: fixed; inset-inline-start: 0; height: 100vh; overflow: hidden;`) with zero page-scroll interference, while main content scrolls independently.
- **Strictly Uniform Provider Cards & Connected Models Badge**:
  - Standardized provider cards with identical height (`min-height: 250px`), flex distribution, and pinned footer action buttons.
  - Removed "سیستمی" badge from provider cards as requested.
  - Added connected models list chips underneath each provider card displaying associated models.
- **3-Second Debounce on Search Operations**:
  - Applied 3000ms delay to both sidebar chat search (`SearchModal.vue`) and admin panel search (`AdminPanelView.vue`) to prevent aggressive API requests on every keystroke.
- **Mixed Persian & English RTL Text Direction Rule**:
  - Updated `getActiveTypingDirection` in `utils/textDirection.ts` so that whenever text contains Persian characters (even when mixed with English), the text direction strictly evaluates to `rtl`. Pure English remains `ltr`.
- **RTL Search Input & Modal Styling Cleanups**:
  - Removed all `box-shadow` across modals (`AdminModal.vue`, `ModelsModal.vue`, `SearchModal.vue`).
  - Switched search input padding to logical CSS properties (`padding-inline-start: 38px; padding-inline-end: 36px;`), completely resolving placeholder overlap with the search icon.
  - Removed search bar from the Dashboard tab (`v-if="activeSection !== 'dashboard' && activeSection !== 'prompts'"`).
- **Admin Panel Overhaul, Custom AdminTable, Edit/Delete Modals, & Two-Tier Token Quota System (`frontend` & `backend`)**:
  - **Minimal & Standardized Cards Layout**: Refined KPI metric cards with sleek borders, soft background contrast, subtle hover elevations, and standard `gap-5` (20px) spacing in `AdminPanelView.vue`.
  - **Fixed & Sticky Admin Sidebar**: Set `.admin-sidebar` to `position: sticky; top: 0; height: 100vh; overflow-y: auto;` so navigation remains permanently pinned and accessible while scrolling through lengthy tables and cards.
  - **Dedicated Reusable Table Component (`AdminTable.vue`)**: Built a modular, clean table component with custom headers, row slots, smooth hover rows, and localized empty states with Vazirmatn typography.
  - **Pre-filled Edit & Delete Modals**:
    - Replaced browser `window.confirm` with `DeleteConfirmModal.vue` featuring loading spinner and disabled state during deletion.
    - Model and Provider creation/editing transitioned into pre-filled modal forms (`AdminModal.vue`).
    - Added user editing modal (`UserEditModal`) with pre-filled display name, email, role, token limits, and token usage reset.
    - In users table, completely removed user deletion button, retaining solely the deactivation/activation toggle (`BaseToggle`) and edit modal button.
  - **100% Pure Persian Typography with Vazirmatn**:
    - Completely removed all English uppercase eyebrows (`CATALOG`, `REGISTRY`, `ACCESS & USAGE`, `SYSTEM STATUS`, `USAGE`, `PARVA / ADMIN`, `ADMIN CONSOLE`).
    - Standardized all titles, descriptions, buttons, tooltips, and badges strictly to Persian RTL with Vazirmatn font.
  - **Universal Search**: Integrated live reactive search filtering across all sections (models by name/provider/apiId, providers by name/url, users by name/email/username/role) with one-click clear button.
  - **Two-Tier Token Quota System & Real-Streaming Accounting Fix (`backend`)**:
    - Added `tokenLimit` column to `users` table via migration `1761200000000-AddUserTokenLimit.ts` and updated `User` entity and `UpdateUserAdminDto`.
    - Enhanced `chat.service.ts` to enforce user-specific token limits first (with `0` representing explicitly unlimited), falling back to `globalTokenLimit` when no user limit is set.
    - Fixed a critical backend bug where token consumption was never recorded during real LLM streaming (now reliably persisted in `finally` block).
    - Added global system settings modal in the Admin Panel to configure `globalTokenLimit` and `systemPrompt` on demand.
  - **Comprehensive Test Coverage**: 100% green on all 23 frontend test suites (124/124 tests passing) including new `AdminTable.spec.ts`, and all 18 backend test suites (127/127 tests passing).
- **Hybrid & Dynamic Bidirectional Text Direction (`frontend`)**:
  - Implemented `getActiveTypingDirection` and `getLineDirection` in `utils/textDirection.ts` to detect text direction character-by-character and line-by-line.
  - `ChatComposer.vue`: The message input now responds dynamically in real-time as the user types; typing English characters immediately aligns left (`ltr`), typing Persian characters immediately switches to right (`rtl`), and typing English again switches back to left (`ltr`), with immediate reset to default RTL on message clear/submit.
  - `MessageBubble.vue`: User messages with multi-line or mixed content are rendered line-by-line with independent directional alignment (`.user-msg-line.rtl` for Persian lines and `.user-msg-line.ltr` for English lines).
  - `MarkdownContent.vue`: Assistant responses handle hybrid Markdown content with per-block and per-line directional styling, including list items (`<li>`), blockquotes (`<blockquote>`), paragraphs with breaks (`<br>`), and table cells (`<th>`/`<td>`).
  - Added new unit tests in `textDirection.spec.ts`, `ChatComposer.spec.ts`, and `MessageBubble.spec.ts` (all 22 frontend suites / 120 tests passing).
- **Per-Conversation Streaming State (`frontend`)**:
  - Refactored `chat.ts` to use a `Map<convId, ConvStreamState>` instead of global `isStreaming`/`isThinking`/`streamError`/`currentStreamingText`/`lastUserPrompt`/`abortController` refs.
  - Each conversation now has fully independent streaming state — switching conversations no longer aborts background streams.
  - `isStreaming`, `isThinking`, `streamError`, `currentStreamingText`, `lastUserPrompt` are now computed from the Map for the currently active conversation, providing full backward compatibility with all existing components.
  - Added `getConvIsStreaming(convId)` public helper for reading any conversation's streaming state (used by sidebar).
  - `AppSidebar.vue`: Added animated pulsing dot (`sb-conv-streaming-dot`) next to any conversation that is streaming in the background (both expanded and collapsed sidebar states).
  - Updated `MessageList.spec.ts`, `ChatComposer.spec.ts`, `NetworkAndRetry.spec.ts` to use `convStreamStates` Map for test state setup (all 22 suites / 114 tests passing).

### Removed
- **English Language & LTR Capability Removed (`frontend`)**:
  - Completely removed English language selection, LTR toggling, and bilingual conditionals throughout the application.
  - Hardcoded document and store direction strictly to Persian RTL (`dir="rtl"`, `lang="fa"`), removing direction overrides from `localStorage`.
  - Removed the "Language & Direction" (`زبان و جهت چیدمان`) configuration section and LTR buttons from `SettingsModal.vue`.
  - Replaced all bilingual ternary expressions (`isRtl ? ... : ...`, `uiStore.direction === 'rtl' ? ... : ...`) across all components (`AppHeader`, `AppSidebar`, `ProfileModal`, `ProfileMenu`, `SearchModal`, `LogoutModal`, `EditConversationModal`, `DeleteConversationModal`, `ModelsModal`, `ChatComposer`, `MessageBubble`, `EmptyState`, `LoginView`, and `AdminModelsView`) with clean, purely Persian text, placeholders, labels, and tooltips.
  - Updated frontend test suites (`SettingsModal.spec.ts`, `Stores.spec.ts`, `AdminModelsView.spec.ts`) to verify that English/LTR options are absent and the application operates exclusively in Persian RTL (all 22 suites / 114 tests passing).

### Fixed
- **Large Message List Auto-Scrolling & State Preservation (`MessageList.vue`)**:
  - Fixed an issue where conversations with high message volume failed to auto-scroll to the bottom upon receiving or sending new messages due to asynchronous DOM layout recalculation and smooth-scroll animation clamping.
  - Replaced single microtask scrolling with multi-pass synchronization (`nextTick` + `requestAnimationFrame` + post-layout micro-delays).
  - Integrated `ResizeObserver` on the message container to dynamically track height adjustments caused by Markdown parsing, syntax highlighting, and KaTeX rendering, locking to the absolute bottom when auto-scroll is active.
  - Implemented strict state protection: manual scroll-up is respected so users can read chat history uninterrupted without being pulled down by incoming stream tokens or stream completion.
  - Force auto-scrolls to the absolute bottom whenever the user sends a new message or switches conversations.
  - Added a floating, glassmorphic "Scroll to bottom" button with a real-time pulse badge when new streaming content arrives while scrolled up, smoothly returning the viewport to the bottom when clicked.
  - Expanded `tests/MessageList.spec.ts` with 6 comprehensive unit tests covering auto-scroll, position preservation, and jump button interactions.

### Added
- **Visual Theme Switcher & Sidebar Settings Overhaul**:
  - Replaced the two plain text theme buttons in `SettingsModal.vue` with rich visual theme preview cards featuring realistic miniature UI mockups for Dark (Slate Obsidian) and Light (Warm Cream) themes.
  - Added active check indicators, radio pills, smooth hover animations, and auto-save indicators in `SettingsModal.vue`.
  - Added direct quick "تنظیمات" (Settings) row in `AppSidebar.vue` footer (in both expanded and collapsed icon-only states) with live theme indicator badge (Moon / Sun icon).
  - Fixed dead "شخصی‌سازی" button in `ProfileMenu.vue` to properly open Appearance & Theme settings, and enhanced profile popup menu with floating glassmorphism styling and theme indicator badge.
  - Added comprehensive test suite `tests/SettingsModal.spec.ts` covering modal visibility, theme toggling, direction switching, and close actions.

### Fixed
- **Chat Error Handling, Timeouts & Message Delivery Status**:
  - Implemented upstream LLM connection timeout (35s) and idle read stall timeout (25s) with `AbortSignal` in `OpenAiCompatForwarder`.
  - Added 35-second `thinkingTimer` in `ActiveStreamService` to automatically fail stalled upstream sessions before first token emission.
  - Added `@Get(['health', 'api/v1/health'])` endpoint to test server health without requiring authentication.
  - Implemented client-side pre-flight health check (`checkBackendHealth`) in `frontend/src/services/api.ts` before streaming messages.
  - Resolved alert banner retry functionality: `retryLastMessage` now accurately recovers the last user prompt even when `lastUserPrompt` was cleared (e.g., following a page refresh), aborts any lingering controllers/watchdogs, cleans trailing failed messages, and cleanly re-triggers `sendMessage()`.
  - In backend `generate()`, existing stalled/thinking sessions are automatically aborted when starting a new send or retry, and duplicate user message entities are prevented from accumulating in PostgreSQL.
  - Replaced persistent fake assistant error messages (`msg-err-...`) with transient Pinia `streamError` ref and composer alert banner in `ChatComposer.vue`, ensuring error messages are completely cleared on page refresh or conversation switch.
    - Single Error Alert Enforcement: Removed redundant error boxes inside user message bubbles and assistant timeline so that only the single, persistent alert banner above the composer (`stream-error-banner`) is displayed when an error occurs, keeping the conversation stream clean and distraction-free.
  - Normalized all offline and network errors to user-friendly Persian: «خطا در برقراری ارتباط».
- **MinIO Object Storage & Avatar Upload**:
  - Resolved 503 error (`Object storage (MinIO) is not configured; avatar upload is disabled`) by adding the missing MinIO configuration to `backend/.env`.
  - Started MinIO container (`codeless_minio`) on ports `9000` (API) and `9001` (Console).
  - Enhanced `StorageService` to implement `OnModuleInit` for automatic bucket creation on startup, with automatic recovery in `put()` on `NoSuchBucket`.
  - Added project-level `docker-compose.yml` defining PostgreSQL and MinIO for repeatable local development.
  - Corrected `tests/services/profile.service.spec.ts` to dynamically resolve base origin from `getApiBaseUrl()`.

### Removed (backend)
- **User profile slimmed down (product decision).** The `users` table columns `language`, `theme`, `timezone`, `defaultModelId` and `bio` are dropped (migration `1761000000000-DropUserProfileAndPreferences`), and `GET/PUT /users/me/preferences` is removed. `GET/PATCH /users/me` now cover only `displayName` + `username`; avatars on MinIO, email/password change with current-password re-auth, and the unique-lowercase username logic are unchanged. Chat model resolution reverts to **explicit → platform default** (no per-user default). `api-contract.yaml` updated accordingly (Users tag without preferences paths).

### Added
- **ChatGPT-Style Chat Layout Refactoring**:
  - Refactored message layout to a linear turn-based format: user prompt anchored cleanly at the top of each turn with user avatar; assistant response positioned directly underneath the user prompt across the full reading width (`max-w-3xl` / `max-w-4xl`).
  - Assistant model response box is completely borderless with 100% transparent background, seamlessly blending with the interface.
  - Removed sender and chatbot name text for a distraction-free, modern reading experience.
  - Replaced "در حال نوشتن..." text label with a minimal 3-dot bouncing pulse loader.
  - Formatted timestamps in Persian digits with explicit «قبل‌ازظهر» / «بعدازظهر» time-of-day indicators.
  - Added copy button to user messages in addition to assistant messages, enabling full prompt copying.
  - Active streaming bubble positioned directly under the last user message with real-time markdown parsing.
  - Full Tailwind CSS utility class styling with smooth responsive spacing on mobile and desktop, matching the Obsidian Dark and Warm Cream Light themes.
  - Preserved full backward compatibility for all test hooks (`.message-row`, `.row-user`, `.row-assistant`, `.bubble`, `.copy-button`, `.timestamp`, `.recovery-bar`, `.retry-btn`).
- **Rich Markdown Engine (`MarkdownContent.vue`)**:
  - **Fenced Code Blocks**: Syntax styling, language badge header (e.g. `TYPESCRIPT`, `PYTHON`, `SQL`), interactive copy button with feedback («کپی» -> «کپی شد ✓»), strict `dir="ltr"` formatting, and horizontal scroll.
  - **Responsive Tables (GFM)**: Multi-column tables with `table-responsive` overflow container, zebra row striping, and themed borders.
  - **README & Rich Typography**: Headings `h1`-`h6`, ordered/unordered lists (`ul`, `ol`), blockquotes with accent borders, inline code pills (`code`), and safe links (`target="_blank" rel="noopener noreferrer"`).
  - **BiDi (Bidirectional) Text**: Seamless RTL flow for Persian text alongside strict LTR preservation for code blocks and tables.
  - **Streaming Resilience**: Auto-closes unclosed code fences during active stream generation.
- **Login Page Two-Column Layout**:
  - Arranged the login view with the logo/artwork pane strictly on the left side and the authentication form pane on the right side on desktop screens, with border separation and mobile responsiveness.
- **Resumable & Persistent Streaming Across Refreshes & Network Drops**:
  - **Decoupled Backend Generation (`ActiveStreamService`)**: Active LLM generation sessions run independently of HTTP sockets, preventing upstream cancellation on page reload or network glitches.
  - **Stream Status & Reconnection (`GET /active-stream` & `GET /stream`)**: Endpoints providing instantaneous state recovery (`event: sync`) and live token streaming for reconnecting clients.
  - **Context-Aware Message Resumption (`POST /resume`)**: Resumes interrupted assistant responses from the exact point of interruption with prior conversation history and continuation prompt.
  - **Explicit Stream Cancellation (`POST /stop`)**: Halts active background generation on user demand and saves partial tokens with `isInterrupted: false, stoppedByUser: true`.
  - **Frontend Resilient Reconnection (`chat.service.ts` & `chat.ts`)**: On refresh or network drop, the UI maintains the typing/streaming state, attaches to the active stream without disappearing or jumping, and smoothly finishes generation.
- **AI-Powered Automatic Conversation Titling (Auto-Title)**:
  - Generates concise 3-5 word titles on the first user prompt using lightweight non-streaming forwarder completions (`OpenAiCompatForwarder.complete`).
  - Persists title to PostgreSQL and emits `event: title` via SSE to update the sidebar in real time without refreshing.
  - Includes offline keyword boundary fallback for unconfigured/offline environments.
- **Theme-Aware Logo Variants**:
  - New `useThemeLogo` composable in `src/composables/useThemeLogo.ts` centralizes theme-aware branding logo selection.
  - Dark theme now uses `logo-white.png` (preferred) over the legacy `logo-dark.jpg` fallback; light theme uses the new `logo-blue.png`.
  - The sidebar, login page, and empty chat state all reactively swap logos when the theme is toggled.
  - File-based detection via Vite's `import.meta.glob` — drop a new `logo-<variant>.<ext>` into `src/assets/` to register a new variant with no extra wiring.
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

