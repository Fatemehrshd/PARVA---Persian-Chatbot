# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Fixed
- **Inline Persian validation for a missing `@` in the email field (نمایش inline خطای نبودِ @ در ایمیل)**: the browser's native English bubble ("Please include an '@' in the email address…") no longer appears — the login/signup form and the profile email-change form use `novalidate`, and a shared client-side validator (`frontend/src/utils/validators.ts`, mirroring the backend `@IsEmail` rule) shows the same inline Persian message for a missing `@`, a missing domain dot, or any other invalid email **before** any request is sent. Covered by new tests in `frontend/tests/LoginView.spec.ts`.
- **Global Persian error handling (هندل سراسری و فارسی خطاها)**: a centralized localization layer (`frontend/src/utils/errorMessages.ts`) now runs in `services/api.ts` — the single funnel for every HTTP error:
  - Known English backend messages (`Resource not found`, `Admin only`, `Email is already registered`, model/provider errors, MinIO storage errors, …) are translated to Persian.
  - **No raw server/framework error can leak to the user anymore**: any unrecognized non-Persian message (DB errors, stack fragments, future endpoints) is replaced with a generic Persian fallback before any caller renders `err.message`.
  - Network-level failures (`Failed to fetch`, offline, DNS, server down) now surface as a Persian offline message (`statusCode 0`) instead of the raw browser text.
  - Array (class-validator) messages are translated per-element and preserved on `ApiError.rawMessage` so `useFormSubmit` field-level error mapping keeps working.
  - English frontend fallbacks (`Failed to fetch models`, `An error occurred during submission`) localized.
- **Dark theme no longer reset to light on page refresh (رفع بازگشت تم تیره به روشن بعد از رفرش)**: `GET /users/me/theme` returned the raw value (e.g. `"dark"`) while the client read `.preference` from it, so every refresh silently resolved the preference to `null` (→ light default). The backend now returns the documented `{ preference }` envelope, and the frontend parser tolerates both the envelope and the legacy bare-string shape. Covered by new tests in `backend/test/profile.spec.ts` and `frontend/tests/ThemePerUser.spec.ts`.
- Theme behavior hardened (رفع مشکلات تم):
  - The login page (`/login`) now **always renders in the light theme** via a view-local `authPageLightMode` override in the `ui` store — never persisted to `localStorage` or the backend, and a signed-in user's theme is restored as soon as they leave the page.
  - Per-user theme is now guaranteed to be **independent per user and stable across page refreshes**: the backend preference (`GET /users/me/theme`) re-syncs on every refresh, and login/logout reset the session theme to the global default (light) so one user's preference never leaks to another.
  - The default theme for any user without an explicit preference is **light**, even when stale `localStorage` state says otherwise. Covered by new behavioral tests in `frontend/tests/ThemePerUser.spec.ts`.
- Admin table search and filtering now support selected fields, nested values, column-filter controls, and server-side field mapping across users, models, providers, chats, files, subscriptions, payments, and coupons.
- Payment admin search now accepts nested fields such as `user.email`, `plan.name`, `refId`, and `authority`, and sends the correct `searchField` parameter to the backend.
- Coupon admin search remains aligned with the server-side `search` and `isActive` filters, preserving the status filter while searching by code or description.
- User-facing model visibility now follows explicit `plan_models` assignments. Free users no longer see or use public models outside the free plan, while admins retain full access.
- Selecting a platform default model automatically links it to the free plan, including a migration backfill for the existing default model.

#### Added
- **Per-User Theme Preference (تم اختصاصی به ازای هر کاربر)**:
  - Backend: `themePreference` column on `users`, `GET /users/me/theme` and `PATCH /users/me/theme` endpoints, migration `1762400000000-AddUserThemePreference.ts`.
  - Frontend: `ui` store gains `userThemePreference` and computed `effectiveTheme`; theme selection in `SettingsModal.vue` and `ProfileMenu.vue` now persists per-user on the backend and takes priority over the local `localStorage` setting. Default theme for all users is Light.
  - Tests: `SettingsModal.spec.ts` updated to assert per-user preference persistence.
- **Database Transactions & ACID Guarantees (پیاده‌سازی تراکنش‌های دیتابیس و تضمین‌های اتمیک)**:
  - Wrapped plan supersede and active subscription creation in atomic `dataSource.transaction` in [subscriptions.service.ts](file:///d:/codeless_final/backend/src/modules/subscriptions/subscriptions.service.ts), eliminating partial failure states and concurrent subscription conflicts.
  - Wrapped refresh token rotation (revoking previous token and persisting new hashed token) in atomic `dataSource.transaction` in [auth.service.ts](file:///d:/codeless_final/backend/src/modules/auth/auth.service.ts), preventing token replay vulnerabilities and token loss during network latency.
  - Documented complete transaction locations, ACID guarantees, and race conditions in dedicated wiki guide [docs/wiki/transactions.md](file:///d:/codeless_final/docs/wiki/transactions.md).
- **System Logging to Daily Rotating Files & SigNoz Live Stream (لاگ‌گذاری در فایل‌های چرخشی و استریم به سیگنوز)**:
  - Implemented custom NestJS logger [AppLoggerService](file:///d:/codeless_final/backend/src/shared/logger/app-logger.service.ts) writing structured daily logs to `backend/logs/app-YYYY-MM-DD.log` and critical errors with stack traces to `backend/logs/error-YYYY-MM-DD.log`.
  - Added recursive data sanitization (`[REDACTED]`) for sensitive keys (`password`, `token`, `authorization`, `cookie`, `secret`, `apiKey`).
  - Streamed 100% of application logs via OpenTelemetry OTLP (`/v1/logs`) into SigNoz (ClickHouse) for high-speed retention and analytics without bloating PostgreSQL.
  - Added dedicated **«لاگ‌های زنده در SigNoz»** button with pulsing live indicator in [AdminAuditLogsSection.vue](file:///d:/codeless_final/frontend/src/views/admin/AdminAuditLogsSection.vue) linking directly to `${signozBaseUrl}/logs?liveTail=true`.
- **Audit Log Decoupling & PostgreSQL Bloat Prevention (تفکیک لاگ‌های ممیزی از ترافیک عمومی)**:
  - Filtered ordinary read-only `GET` requests (< 400) out of the PostgreSQL `audit_logs` table in [http-logging.interceptor.ts](file:///d:/codeless_final/backend/src/shared/http-logging.interceptor.ts), reserving PostgreSQL strictly for state-changing operations (`POST`, `PUT`, `PATCH`, `DELETE`), auth, payments, and errors (`statusCode >= 400`).
  - Guaranteed autonomous, async, non-blocking execution for audit logging, ensuring business transactions are never rolled back or delayed if an audit log write encounters issues.
- **Login & Register Image Alignment, Centering & Confirm Password (هم‌ترازی با تصویر، مرکزیت فرم لاگین/ثبت‌نام و فیلد تکرار رمز عبور)**:
  - Ensured both the artwork image and the authentication form are vertically and horizontally centered and perfectly aligned along the same horizontal midline (`50vh`) in [LoginView.vue](file:///d:/codeless_final/frontend/src/views/LoginView.vue).
  - Removed artificial fixed container heights and aligned `.form-wrapper` with `justify-content: center` and smooth bezier transition (`transition: all 250ms cubic-bezier(0.4, 0, 0.2, 1)`).
  - Locked heights on the logo header (`h-11`), tab switcher (`h-11`), and title block (`min-h-[36px]`).
  - Added smooth `field-expand` transition for the `displayName`, `confirmPassword` input, and password requirements helper text.
  - Added dedicated **تکرار رمز عبور** (Confirm Password) input (`#confirmPassword`) with lock icon, show/hide eye toggle (`showConfirmPassword`), empty validation (`لطفاً تکرار رمز عبور را وارد کنید.`), and mismatch validation (`رمز عبور و تکرار آن یکسان نیستند.`).
  - Added automated unit tests covering confirm password validation and match behavior in `tests/LoginView.spec.ts`.
- **Composer Model Selector Max Length & Ellipsis Truncation (محدودسازی حداکثر طول عنوان مدل در اینپوت)**:
  - Added strict max-width (`140px` desktop / `105px` mobile) and CSS text truncation (`overflow: hidden; text-overflow: ellipsis; white-space: nowrap;`) to `.model-badge-btn` and `.model-name` in [ChatComposer.vue](file:///d:/codeless_final/frontend/src/components/chat/ChatComposer.vue).
  - Preserves layout symmetry so long model names never push out action buttons (web search, thinking, mic, send).
  - Added native tooltip `:title` on both the button and model name span, showing the full model identifier on hover.
  - Added bounded width and ellipsis to `.model-option-name` inside the model selection popup.
- **Scrollable & Collapsible Queued Messages Dropdown (دراپ‌داون و اسکرول‌شونده شدن صف پیام‌ها)**:
  - Transformed queued messages into a sleek collapsible header bar (`.queued-summary-bar`) with rotary chevron toggle button, message count pill badge, and preview of the next queued message.
  - Scrollable message card panel (`.queued-dropdown-scrollable`) with `max-height: 180px` and subtle custom scrollbar, ensuring the composer textarea is never pushed off-screen regardless of queue size.

### Removed
- **Text-to-Speech (TTS) Complete UI Removal (حذف کامل قابلیت متن به صدا)**:
  - Per explicit user request, completely removed all speaker buttons (`.tts-button`) and audio readout UI from [MessageBubble.vue](file:///d:/codeless_final/frontend/src/components/chat/MessageBubble.vue) and [MessageList.vue](file:///d:/codeless_final/frontend/src/components/chat/MessageList.vue).
- **Minimal Admin Audit Logs & Persian Date Range Filtering (بازطراحی مینیمال ممیزی ادمین و فیلتر بازه تاریخ شمسی)**:
  - **Sleek Minimal Redesign (`AdminAuditLogsSection.vue`)**:
    - Compact, unified toolbar replacing bulky cards with a minimal metrics strip (کل لاگ‌ها، خطاها، فراخوانی‌های خروجی و میانگین زمان پاسخ).
    - Added dedicated **«همه لاگ‌ها»** tab for viewing aggregated telemetry, request logs, external fetches, and security events in one place.
  - **Jalali Date Range Filtering (`PersianDatePicker.vue`)**:
    - Interactive "از تاریخ" (`startDate`) and "تا تاریخ" (`endDate`) controls using the app's native Jalali Persian datepicker.
    - Full backend date range filtering in `AuditService` and `AdminAuditController` with query parameters and indexed `createdAt` comparisons.
    - Quick "حذف فیلترها" button to clear all filters with a single click.
  - **High-Volume Telemetry & Logging Architecture Strategy (معماری تفکیک بار با SigNoz و ClickHouse)**:
    - Decoupled two-tier logging architecture: High-throughput HTTP requests, stream spans, and telemetry are ingested via OpenTelemetry into SigNoz and ClickHouse with automated TTL retention policies to avoid PostgreSQL database bloat.
    - Business-critical audit logs (auth, payments, settings, security anomalies) remain immutably preserved in PostgreSQL (`audit_logs`) and are correlated to SigNoz traces via 1-click `traceId` deep links.
- **Message Queue Persistence & Error Preservation (پایداری صف پیام در رفرش و ماندگاری در وضعیت خطا)**:
  - **Browser Refresh Persistence (`localStorage`)**:
    - Message queue state is automatically persisted in `localStorage` under `chat_queued_messages`, restoring prompts and attachments if the user reloads the browser (`F5`).
  - **Error Preservation & Retry Trigger**:
    - Queued messages are preserved if the active stream encounters an error or network abort, showing a prominent "ارسال پیام صف‌بندی‌شده" button for instant dispatch.
- **Message Queue Feature (قابلیت پیام در صف و صف‌بندی ارسال حین استریم و تفکر مدل)**:
  - **Non-blocking Prompt Submission (`ChatComposer.vue` & `useChatStore`)**:
    - Users can now seamlessly type and submit follow-up prompts while an AI assistant response is actively streaming or thinking (`isStreaming || isThinking`).
    - Submitting via Enter key or the new "افزودن به صف" button immediately places the prompt into the conversation's FIFO message queue (`queuedMessages`), resets textarea height, and clears sessionStorage drafts.
  - **Interactive Queued Message Banner & Card (`ChatComposer.vue`)**:
    - Displays a theme-adaptive, animated card right above the composer with pulsating queue indicator dot, status badge ("پیام در صف ارسال"), sequence counter for multiple items (`(۱ از ۲)`), text snippet with RTL/LTR autodetection, file badges, and capability badges (🌐 جستجوی وب, 🧠 تفکر عمیق).
    - **1-Click Edit Action (`editQueuedMessage`)**: Pulls the queued message and its attachments back into the composer textarea for editing without losing any content.
    - **1-Click Cancel Action (`cancelQueuedMessage`)**: Immediately removes the item from the queue with toast notification.
  - **Automatic Stream Chaining & Dequeue Execution (`chat.ts`)**:
    - Automatic dequeue triggers on normal stream completion (`finishStream`), manual user abort (`stopStreaming`), and recoverable stream errors.
    - Safe execution checks ensure no prompts are dropped, and prevents doomed requests if token limits or quota blocks occur.
  - **Per-Conversation Queue Isolation & ID Migration**:
    - Each conversation maintains its own independent message queue (`Map<string, QueuedMessage[]>`).
    - Automatically migrates queued messages when a local placeholder conversation (`c-...`) is converted to a permanent backend ID.
  - **PostgreSQL Persistence & Token Hashing (`refresh_tokens` table)**:
    - Dedicated entity (`RefreshToken`) storing SHA-256 hashed refresh tokens (`tokenHash`), expiration timestamp (`expiresAt`), revocation status (`isRevoked`), user ID (`userId`), IP address, and User-Agent.
    - Eliminates plain-text refresh token storage in the database, preventing credential leakage in the event of database dumps.
  - **Refresh Token Rotation (RTR) & Reuse Detection**:
    - Each call to `POST /auth/refresh` revokes the incoming token and issues a new pair of access and refresh tokens.
    - If a revoked token is presented again (indicating token theft or replay attack), the system revokes all refresh tokens belonging to the user family.
  - **Silent Refresh Interceptor (`frontend/src/services/api.ts`)**:
    - Automatically catches 401 Unauthorized responses, acquires a fresh access token via `silentRefreshToken()`, and transparently replays the failed request with queue deduplication (`refreshPromise`).
  - **Comprehensive Session Revocation (`/auth/logout`)**:
    - Invalidates the active JWT in the in-memory blacklist and marks the refresh token revoked in PostgreSQL.
- **Strong Password Complexity Validation (اعتبارسنجی پیشرفته و استاندارد رمز عبور قوی)**:
  - **Backend Regex Enforcement (`SignupDto`)**:
    - Password must be at least 8 characters and contain at least one uppercase letter (A-Z), one lowercase letter (a-z), one digit (0-9), and one special symbol (`!@#$%^&*()_+-=[]{};':"|,.<>/?~\``).
    - Localized Persian error messages added to `backend/src/shared/messages.fa.ts`.
    - Preserves existing accounts by only enforcing complexity on new registrations and password updates.
  - **Frontend Signup Guidance (`LoginView.vue`)**:
    - Real-time client-side validation and clear Persian criteria hints informing the user of the required password format.

### Fixed
- **Payment Cancellation Transition & Lifecycle Resolution (اصلاح چرخه پرداخت: تبدیل وضعیت تراکنش‌های انصرافی از «در انتظار» به «لغو شده» و تعیین تکلیف سشن‌های منقضی)**:
  - **Fixed Stuck PENDING Status on User Cancellation (`PaymentResultView.vue` & `PaymentsService`)**:
    - Previously, when a user cancelled payment on Zarinpal or sandbox gateway (returning with `Status=NOK`), `PaymentResultView` skipped verification, leaving the payment record stuck in `PENDING` (`در انتظار`) indefinitely.
    - Updated `PaymentResultView.vue` to dispatch `paymentService.verify({ authority, status: 'NOK', payload: { cancel: true } })`, allowing the backend to register the cancellation.
    - Updated `PaymentsService.verifyPayment` to record cancellations as `PaymentStatus.CANCELLED` (`لغو شده`) with cancellation timestamp and reason, rather than leaving them `PENDING` or misclassifying them as `FAILED`.
  - **Auto-Expiration for Abandoned Gateway Sessions (`PaymentsService.expireStalePendingPayments`)**:
    - When users navigate to the bank gateway and close the browser without returning, the gateway session expires after 20 minutes.
    - Added `expireStalePendingPayments` which automatically transitions `PENDING` payments older than 20 minutes to `PaymentStatus.CANCELLED` with failure reason `'انقضای مهلت پرداخت در درگاه بانکی'`, preventing stale records from cluttering the reports.
  - **Admin Payments Table & Result Page UX (`AdminPaymentsSection.vue` & `PaymentResultView.vue`)**:
    - Added dedicated visual badge for `لغو شده` (`bg-slate-500/10 text-slate-400`) in `AdminPaymentsSection.vue`.
    - Differentiated cancellation UX in `PaymentResultView.vue` with reassuring Persian messaging: "شما از انجام پرداخت در درگاه بانکی انصراف دادید و تراکنش لغو گردید. هیچ مبلغی از حساب شما کسر نشده است."
- **Payment Result & Zarinpal Return Page Redesign & Theme Harmony (هماهنگ‌سازی کامل تم و اصلاح رنگ‌های صفحه بازگشت از درگاه زرین‌پال)**:
  - **Fixed Broken Contrast & Illegible Receipt Box (`PaymentResultView.vue` & `SandboxGatewayMockView.vue`)**:
    - Removed `background-color: var(--accent)` which caused dark navy text on dark navy background in Light Mode and glaring bright blue contrast issues in Dark Mode.
    - Replaced with theme-adaptive surface tokens (`var(--surface-alt)` and `var(--border)`), providing high-contrast, legible typography in both Light Mode (Warm Cream) and Dark Mode (Cool Slate).
  - **Brand Header & Interactive Theme Toggle**:
    - Added top navigation bar featuring the reactive brand logo (`useThemeLogo()`), "پروا" platform name, and an interactive Theme Switcher (Light/Dark mode toggle button) for instant theme verification.
  - **Modern Digital Invoice Card & Badges**:
    - Designed a clean receipt card showing activated plan name, paid amount formatted in Tomans and Rials (`.toLocaleString('fa-IR')`), Shaparak verified status pill badge, and 1-click clipboard copy for the bank tracking code (`refId`).
    - Harmonized success/failure icon wrappers using theme-based tokens (`--success`, `--destructive`) with subtle glowing backdrops.

### Added
- **Minimalist Speech-to-Text (STT) & Text-to-Speech (TTS) (قابلیت صوتی مینیمال: تبدیل گفتار به متن و متن به گفتار)**:
  - **Speech-to-Text (`frontend/src/composables/useSpeechRecognition.ts`)**:
    - Implemented Web Speech API recognition composable supporting Persian (`fa-IR`) with real-time interim results and silence handling.
    - Integrated with `ChatComposer.vue` via a minimalist microphone icon button (`.btn-mic`) in the action toolbar with zero text labels.
    - Features pulsating recording indicator, instant text appending, auto-growing textarea, and auto-stop on message send or unmount.
  - **Multi-Engine Neural Persian Text-to-Speech (`backend/src/modules/tts` & `frontend/src/composables/useTextToSpeech.ts`)**:
    - Built a robust, multi-engine backend TTS service (`TtsService`) providing `POST /api/v1/tts/synthesize`, `GET /api/v1/tts/synthesize`, and `GET /api/v1/tts/voices`.
    - **Engine 1: Microsoft Edge Neural TTS**: Uses state-of-the-art neural models `fa-IR-DilaraNeural` (female) and `fa-IR-FaridNeural` (male) producing studio-quality Persian speech with correct phonetics, accents, and vowels with zero API costs.
    - **Engine 2: OpenAI / Compatible Audio Speech API**: Supports OpenAI standard `/v1/audio/speech` with models `tts-1` / `tts-1-hd` and voices (`nova`, `alloy`, `echo`, `shimmer`).
    - **Auto-Failover Architecture**: Transparently routes requests to Edge Neural first, falls back to OpenAI TTS if available, and finally falls back to browser client-side Web Speech Synthesis.
    - **Streaming Audio**: Directly streams binary `audio/mpeg` chunks from the synthesis process to the HTTP response stream without creating intermediate disk files.
    - **Frontend Experience (`MessageBubble.vue`)**: Minimal icon button showing loading spinner during synthesis, pulsing square during playback, and volume icon when idle (zero text labels). Instant cancellation on message toggle or conversation switch.
- **Comprehensive System & Audit Logging, Outbound Fetch Tracing & SigNoz Deep-Link Integration (سیستم جامع لاگ، ردیابی فراخوانی‌ها و اتصال به SigNoz)**:
  - **W3C Trace Context Propagation (`backend/src/shared/trace-context.service.ts`)**:
    - Generates and propagates W3C-compliant 32-hex `traceId` and 16-hex `spanId` using `AsyncLocalStorage` (`node:async_hooks`).
    - Global middleware `TraceContextMiddleware` extracts incoming `traceparent` (format `00-<trace_id>-<span_id>-01`) or `x-trace-id`, generating new IDs when omitted, and binds `x-trace-id` / `traceparent` to HTTP response headers.
  - **Inbound HTTP Request Interceptor (`backend/src/shared/http-logging.interceptor.ts`)**:
    - Automatically captures and logs all business-critical API requests (`/api/v1/auth`, `/api/v1/chat`, `/api/v1/payments`, `/api/v1/subscriptions`, `/api/v1/coupons`, `/api/v1/files`, `/api/v1/admin`).
    - Records method, path, HTTP status code, execution duration (`durationMs`), client IP, User-Agent, actor (user/admin/system), and error message if any.
    - Emits standard OpenTelemetry OTLP spans for SigNoz APM.
  - **Outbound HTTP Fetch Tracing Wrapper (`backend/src/shared/traced-fetch.ts`)**:
    - Transparently wraps `fetch` to inject `x-trace-id` and `traceparent` downstream, establishing end-to-end distributed trace continuity.
    - Automatically records outbound calls in `audit_logs` and sends OTLP spans to SigNoz collector (`SIGNOZ_OTLP_URL` or `http://localhost:4318/v1/traces`).
    - Integrated across all external HTTP operations including `OpenAiCompatForwarder` (AI stream, completions, ping) and `ZarinpalPaymentGateway` (request and verify payment).
  - **AuditLog Entity & Service Enhancements (`backend/src/modules/audit`)**:
    - Added columns `traceId` (indexed), `spanId`, `method`, `path`, `statusCode`, `durationMs`, and `errorMessage` to `audit_logs` table.
    - Updated `AuditService.findAll` and `AdminAuditController` with multi-field search, trace ID filtering, status filters (success vs error), and real-time aggregate KPI metrics (total logs, error count, fetch count, average duration).
  - **Enhanced Audit Log Architecture, Server-Side Pagination, Multi-ID Search & Actor Identity (ارتقای معماری سیستم لاگ، پیجینیشن سرورساید، جستجوی چندگانه بر اساس ID و هویت عامل)**:
    - **Dual Storage Architecture Clarification & Implementation (معماری دوگانه ذخیره‌سازی داده‌ها)**:
      - **PostgreSQL (`audit_logs` table)**: Structured, immutable relational persistence with B-tree and partial indexes. Completely eliminates plain-text log files for audit queries, transactional reliability, and administrative safety.
      - **ClickHouse (via SigNoz APM `signoz-telemetrystore-clickhouse`)**: High-throughput distributed tracing engine holding spans, flame graphs, and network telemetry, seamlessly cross-referenced with PostgreSQL via W3C `traceId`.
      - Prominently visualized via dual storage status badges in the admin audit header.
    - **Server-Side Pagination & Performance (`AdminTable.vue` & `AdminAuditLogsSection.vue`)**:
      - Integrated server-side pagination with dynamic page sizes (`10`, `20`, `50`, `100`), total count indicators, and page navigation controls, avoiding heavy in-memory loads.
    - **Multi-ID & Multi-Field Search (جستجوی پیشرفته بر اساس انواع شناسه‌ها)**:
      - Direct ID filter input (`idFilter`) supporting partial or exact UUID search for Log UUID, SigNoz Trace ID, User UUID, and Entity ID using safe PostgreSQL `CAST(... AS TEXT)` expressions.
      - Actor email and user name search filter (`actorFilter`).
      - Dedicated SigNoz Trace ID filter (`traceFilter`).
    - **Rich Actor Identity Tracking (هویت و مشخصات کامل عامل انجام‌دهنده)**:
      - Added `actorEmail` and `actorName` columns to `audit_logs` entity and migrations.
      - Fixed NestJS interceptor user extraction bug by dynamically resolving `req.user` in the stream `tap()` phase (after route authentication guards execute) with fallback to `req.body.email` for unauthenticated endpoints.
      - Rich table column: user initials avatar, display name, email, role badge (`مدیر`, `کاربر`, `سیستم`), and 1-click user log filter button.
      - Detail Modal Actor Card: comprehensive identity profile containing Name, Email with copy button, User UUID with copy button, Role, Client IP, and User-Agent.
  - **Admin Panel Sidebar & Logs Dashboard (`frontend/src/views/admin/AdminAuditLogsSection.vue` & `AdminPanelView.vue`)**:
    - Added «لاگ‌های امنیتی» to the admin sidebar with Lucide `Activity` icon.
    - Top summary KPI cards for quick inspection of system health, failure counts, outbound fetch calls, and latency.
    - Filter toolbar with type tabs (All, Inbound HTTP, Outbound Fetch, Security), status selector, and Trace ID search.
    - Dedicated Trace ID badge with instant 1-click clipboard copy and **direct SigNoz deep link** (`${SIGNOZ_URL}/trace/${traceId}`) opening the trace flame graph in a new tab.
    - Detailed request/event inspection modal with sanitized payload viewers, error stack banners, and timing breakdown.
- **Zarinpal Sandbox Payment Gateway & Discount Code System (درگاه پرداخت زرین‌پال سندباکس و سیستم کدهای تخفیف)**:
  - **Payment Verification & Locking Fix (`backend/src/modules/payments/payments.service.ts`)**:
    - Fixed PostgreSQL `QueryFailedError: FOR UPDATE cannot be applied to the nullable side of an outer join` by switching from `paymentRepo.findOne` to `paymentRepo.createQueryBuilder('p').where('p.authority = :authority').setLock('pessimistic_write').getOne()`.
    - Added resilient network timeouts (`AbortSignal.timeout(3000)`) and sandbox fallback to `/sandbox-gateway?gateway=zarinpal` when external `sandbox.zarinpal.com` is unreachable.
  - **Payment Result Auto-Verification (`frontend/src/views/PaymentResultView.vue`)**:
    - Implemented automatic payment verification on return from gateway callbacks when status is `PENDING` and `status === 'OK'`.
    - Added support for case-insensitive gateway query parameters (`authority` / `Authority` and `status` / `Status`).
    - Added a clean loading spinner state while verification is in progress.
  - **Zarinpal Sandbox Simulator UI (`frontend/src/views/SandboxGatewayMockView.vue`)**:
    - Branded simulator interface with official amber Zarinpal badges and status feedback.
  - **Chat Header Cleanup (`frontend/src/views/ChatView.vue` & `AppSidebar.vue`)**:
    - Completely removed the top header bar in `ChatView.vue` per user requirement.
    - Restricted conversation sharing strictly to the 3-dots action dropdown menu in `AppSidebar.vue`.
  - **Zarinpal Sandbox Gateway Provider (`backend/src/modules/payments/gateway/zarinpal-payment.gateway.ts`)**:
    - Official Zarinpal v4 Sandbox integration (`https://sandbox.zarinpal.com/pg/v4/payment/request.json`, `verify.json`, and `/pg/StartPay/{authority}`).
    - Automatic currency conversion between Rials and Tomans (`IRR` to `IRT`).
    - Dual gateway options: «درگاه پرداخت زرین‌پال (سندباکس رسمی ایران)» for realistic external sandbox payment tests vs «شبیه‌ساز پرداخت سریع (سندباکس داخلی)» for offline/instant testing.
  - **Coupons & Discount Engine (`backend/src/modules/payments/coupons.service.ts`)**:
    - Comprehensive discount validation: percentage (`PERCENTAGE`) and fixed Rial (`FIXED`) discounts, max ceiling (`maxDiscountAmount`), minimum order price (`minOrderAmount`), system usage limit (`usageLimit`), per-user usage cap (`perUserLimit`), and expiration dates (`expiresAt`).
    - Database entity `Coupon` (`coupons`) and redemption tracking in `CouponUsage` (`coupon_usages`).
    - Zero-Cost Coupon Bypass: if a coupon reduces the payable amount to 0 (100% discount), the subscription is activated immediately with `SUCCESS` and gateway `'free'`, bypassing external gateway redirects.
    - Public coupon validation endpoint: `POST /api/v1/payments/coupons/validate`.
    - Admin CRUD endpoints: `GET /api/v1/admin/coupons`, `POST /api/v1/admin/coupons`, `PATCH /api/v1/admin/coupons/:id`, `DELETE /api/v1/admin/coupons/:id`.
  - **Frontend UI & Admin Management (`frontend`)**:
    - `CheckoutModal.vue`: Modern modal triggered upon upgrading any paid plan on `/subscription` with interactive discount code entry, live price breakdown (original, discount, payable), and payment gateway selector.
    - `AdminCouponsSection.vue` & `CouponEditorModal.vue`: Dedicated admin management section under «کدهای تخفیف» (Tag icon) for creating, editing, monitoring usage, and deleting discount coupons.
    - `PersianDatePicker.vue` (`frontend/src/components/ui/PersianDatePicker.vue` & `frontend/src/lib/jalali.ts`):
      - Custom, high-precision Iranian Jalali (Shamsi) datepicker component with zero external dependencies.
      - Integrated into `CouponEditorModal.vue` for selecting coupon expiration dates.
      - Full Light and Dark theme adaptation (Obsidian Dark & Warm Cream Light) using CSS design system variables.
      - Features include Jalali month/year selector, interactive day grid with today indicator, time picker (hour and minute), quick "Today" shortcut, and clear expiration option.
- **Chat Snapshot Share (اشتراک‌گذاری گفتگو با پیوند عمومی و منجمد)**:
  - **Immutable JSONB Snapshot Engine (`backend/src/modules/chat/chat-share.service.ts`)**:
    - Captures an immutable snapshot of all conversation messages up to the exact moment the share button is clicked.
    - Subsequent messages, edits, or deletions in the original conversation do not alter or appear in the shared snapshot.
    - Database entity `ChatShare` (`chat_shares` table) with URL-safe random `shareCode`, indexed lookup, view count tracking, and active/revoked lifecycle.
  - **Public & Authenticated API Endpoints (`ChatShareController`)**:
    - `POST /api/v1/chat/conversations/:id/share`: Generates or updates the snapshot.
    - `GET /api/v1/chat/conversations/:id/share`: Retrieves current share status for conversation owner.
    - `DELETE /api/v1/chat/conversations/:id/share`: Revokes public link.
    - `GET /api/v1/chat/shares/:shareCode`: Public endpoint (no auth required) returning frozen snapshot messages and metadata.
    - `POST /api/v1/chat/shares/:shareCode/fork`: Clones the snapshot into a new editable conversation for the authenticated viewer.
  - **Frontend UI & Public Viewer (`frontend`)**:
    - `ShareConversationModal.vue`: Modal with copyable link, 1-click clipboard copy, snapshot details, update to current messages button, and revoke button.
    - `AppSidebar.vue`: Integrated «اشتراک‌گذاری گفتگو» action in the conversation 3-dots dropdown menu.
    - `ChatView.vue`: Added a sleek top chat header bar with conversation title and direct «اشتراک‌گذاری» button.
    - `SharedChatView.vue`: Dedicated public page at `/share/:shareCode` with clean header, frozen notice banner, full Markdown/KaTeX/Code/Reasoning message rendering, theme switcher, and «ادامه گفتگو در پروا» fork CTA button.
- **Subscription & Commercialization Platform (Task 44 / Commercialization Phase)**:
  - **Subscriptions & Entitlement Engine (`backend/src/modules/subscriptions`)**:
    - Multi-tier subscription plans (`subscription_plans`, `plan_models`, `subscriptions`) supporting `free`, `pro`, `enterprise`, and custom plans with customizable billing cycles (`monthly`, `yearly`, `lifetime`).
    - Association of AI models to specific plans via `plan_models` junction table.
    - Zero-conflict RBAC vs Subscription architecture: System roles (`admin` vs `user`) strictly govern system administrative privileges (admin panel, bypass all quotas/model locks), while Subscriptions govern product access (AI models, token/message quotas, advanced capability flags).
    - 3-Tier Quota Cascade Priority: `Personal override (user.tokenLimit > 0) > Active plan quota (plan.tokenQuota > 0) > Global system limit (globalTokenLimit > 0)`.
    - Automated lazy expiration: expired subscriptions transition to `expired` status and automatically fall back to the system default plan.
    - Feature gating support (`webSearch`, `thinking`, `document`, `customPrompts`) via `EntitlementService`.
  - **Payment Processing & Sandbox Gateway (`backend/src/modules/payments`)**:
    - Modular payment infrastructure with `PaymentGatewayProvider` interface and built-in `SandboxPaymentGateway` for test environments.
    - Pessimistic locking (`pessimistic_write`) transaction during payment verification to prevent double-credit and race conditions from duplicate webhooks or network replays.
    - Instant activation for free plans (0 price) without unnecessary gateway redirects.
    - Mock Sandbox Gateway UI (`SandboxGatewayMockView.vue`) for simulating successful or failed transactions.
    - Payment Result View (`PaymentResultView.vue`) with transaction reference, tracking code, and return to chat.
  - **Security Audit Logging (`backend/src/modules/audit`)**:
    - Comprehensive audit trail (`audit_logs`) tracking administrative changes and user commercial actions (`subscription.checkout`, `subscription.activated`, `plan.create`, `plan.update`, `plan.delete`, `payment.verified`, `payment.failed`).
    - Recursive redaction in `AuditService` to automatically sanitize sensitive attributes (passwords, tokens, API keys, card numbers, cvv).
    - Admin Audit Logs Section (`AdminAuditLogsSection.vue`) with action search, date filtering, and sanitized JSON inspection.
  - **User & Admin Frontend UI (`frontend`)**:
    - Public/User Subscription view (`SubscriptionView.vue`): minimal, beautiful pricing cards matching Obsidian Dark and Warm Cream Light themes, active plan badge, and seamless upgrade buttons.
    - Active Plan Immutability: users with an active purchased subscription cannot change their plan or re-enter the subscription page until cancelled/deleted by an admin; guarded in backend (`initiateCheckout`), router/page redirect, and profile menu (`ProfileMenu.vue`).
    - Model & Provider Subscription Assignment: in `PlanEditorModal.vue`, models are grouped by provider with select-all provider toggles and chips (feature tool toggles removed). Models assigned to paid plans are hidden from non-subscribed users (`GET /models`) and blocked in chat.
    - Admin Management Sections: `AdminPlansSection.vue` (plan editor with provider-grouped model selection), `AdminSubscriptionsSection.vue` (paginated table for user subscription tracking and manual assignment), and `AdminPaymentsSection.vue` (paginated financial transactions ledger with aggregate revenue KPI summary cards: total revenue, successful count, and subscriptions breakdown by plan).
    - Direct User Subscription Assignment for Admin: Admin can directly change or assign a subscription plan to any user from the Users section (`AdminUsersSection.vue`), either via a direct 1-click action button in the table row or within the user edit modal (`UserEditorModal.vue`).
    - User Payment History Inspection: Users can view and inspect their complete payment history (amounts, dates, statuses, tracking codes, plans, and pending sandbox payment resumption links) directly from their user menu and profile modal (`ProfileModal.vue` on the «سوابق پرداخت» tab).
    - Security Audit Logs: hidden from primary navigation tabs in `AdminPanelView.vue`.
- **Token & Message Limit System Harmonization (Cascade Priority, Inheritance, & Chat Blocking)**:
  - **Strict Priority Cascade**: Explicit per-user limits (`user.tokenLimit > 0` or `user.messageLimit > 0`) override role-based and global policies completely. If not set (stored as `null`), limits dynamically inherit from role quotas (`roleQuota.tokenLimit`, `roleQuota.messageLimit`) or the global token limit.
  - **Dynamic Inheritance & Visual Badges in Users Table**: `AdminUsersSection.vue` displays effective limits (`effectiveTokenLimit`, `effectiveMessageLimit`) and origin badges: «اختصاصی» (Personal override), «از نقش» (Inherited from role), and «سراسری» (Inherited from global).
  - **Inheritance Restoration in User Editor**: In `UserEditorModal.vue`, empty or cleared token/message limit fields save as `null` to restore dynamic inheritance instead of locking the user to zero. Added an explicit action button: «حذف سقف اختصاصی (بازگشت به ارث‌بری)» and contextual placeholders displaying the role's limit.
  - **Full Chat Composer Input & Send Blocking**: When a user's token or message limit is exhausted (`chatStore.isTokenLimitExceeded` or `authStore.quota?.blocked`), both the textarea and send button are disabled, and a dedicated Persian banner informs the user whether tokens or messages were exhausted and when the quota resets.
- **Merge feature branch `feat/thinking-adaptors` into `develop`**:
  - **Thinking Stream Parsing & Chain of Thought (CoT)**: Extracted reasoning content from upstream providers via `<think>...</think>` tags using `ThinkTagStreamParser` and structured deltas. Enhanced `ThinkingBlock.vue` with rich Markdown formatting, copy reasoning action, and pulsing progress indicator.
  - **Model Capabilities & Capability Badges**: Persisted `supportsThinking`, `supportsVision`, `supportsDocument`, and `thinkingBudgetTokens` in `AiModel` entity, migrations, and admin modal. Conditioned deep thinking toggles in `ChatComposer.vue` on `activeModel.supportsThinking` and displayed `CapabilityBadge` on the model picker button.
  - **Sent Images Gallery & Centered Lightbox Counter**: `ImageGallery.vue` with responsive thumbnail layouts, interactive lightbox, and an absolutely centered counter (`.lightbox-counter`) that stays anchored regardless of filename lengths.
  - **Model access management (public / commercial / private)**: every model now carries an `accessLevel` plus an `allowedUserIds` whitelist for private models (migration `1761700000000-ModelAccessLevels`, existing models default to `public`). Role access is stored in `system_settings` under `model_access` (`user` → public only, `admin` → all levels; admins always see everything) and edited from the admin role modal. The pure `resolveModelAccess` helper is the single decision point and is enforced in `GET /models`, `GET /models/default` (falls back to the first allowed model) and chat (`create`/`setModel`/`generate` → structured Persian error «به این مدل دسترسی ندارید»). Adding a future `premium` role requires no code: grant it commercial access in the admin panel.
  - **Reusable admin UI**: `ModelAccessBadge` (access badge), `ModelAccessPicker` (level select + searchable multi-user whitelist), `AdminTableSkeleton` (shadcn `Skeleton`-based table placeholder) — used across the models table, model editor, role table/modal and admin loading states.
  - **Optimistic updates in the admin panel**: model save/toggle and role-settings save apply immediately and roll back with an error toast if the API fails.
  - **Final provider-toggle rule**: provider-level `isActive` is no longer a product feature. The admin UI/API no longer expose provider enable/disable toggles, and chat/model selection no longer depend on provider activity. The only remaining safeguard is a model rule: a default model cannot be disabled until another default model is selected first, and only one platform default is allowed at a time.
  - **Conversation Pinning & 3-Dots Action Dropdown Menu**: Replaced direct edit/delete buttons in `AppSidebar.vue` with a 3-dots action menu with Pin/Unpin, Edit Title, and Delete options. Persisted `isPinned` in database with `isPinned DESC, updatedAt DESC` sorting.
  - **Sent File Content Viewer in User Chat**: Clickable attachment cards (`FilePreviewCard.vue`) for PDF, Text, Markdown, Excel, and Image with dedicated tabs and copy features.
  - **Per-Role Global Token Limits (Admin Panel)**: Admins can define token consumption limits per role, with dual dollar/token inputs in `RoleTokenLimitModal`.
  - **Live Effective Limit on Users Table**: `GET /admin/users` returns `effectiveTokenLimit` per user.
  - **Periodic Token/Message Quotas**: Periodic quotas with lazy hourly reset, role/user precedence, and structured `QUOTA_EXCEEDED` errors.

### Changed
- **User Token Limit Nullability Behavior**: When editing a user, an empty input field emits `tokenLimit: null` to inherit dynamically from the role/global limit rather than saving `0` (which previously severed role inheritance and locked the user).
- **All deletions are now soft-delete (production-ready)**: `users`, `ai_models`, and `ai_providers` gained an `isDeleted` flag; `DELETE /admin/users/:id`, `DELETE /admin/models/:id`, and `DELETE /admin/providers/:id` now flag rows instead of physically removing them.

### Fixed
- **Admin Modal Submit & Slot Harmonization**: Fixed `AdminModal.vue` to properly render the `<footer v-if="$slots.footer">` slot. Resolved missing and duplicate submit buttons in `PlanEditorModal.vue` and `AssignSubscriptionModal.vue` by standardizing action controls with clear Persian labels («ثبت طرح اشتراک»، «ذخیره تغییرات طرح»، «ثبت و تخصیص اشتراک»).
- **DeleteConfirmModal Encoding & Props Compatibility**: Fixed corrupted UTF-8 mojibake/question marks in `DeleteConfirmModal.vue` and added support for `description`, `isLoading`, `confirmText`, and `eyebrow` props for seamless modal confirmation across admin views.
- **Admin Tables for Subscriptions, Plans, Payments, and Audit Logs**: Standardized all commercialization admin sections (`AdminPlansSection`, `AdminSubscriptionsSection`, `AdminPaymentsSection`, `AdminAuditLogsSection`) to use `AdminTable.vue` with `:items` and `<template #row="{ item }">` for uniform DataGrid display, sorting, and responsive layout.
- **Initial Database Seeding for Subscriptions**: Created and executed `seed:subscriptions` script, ensuring `free`, `pro`, and `enterprise` plans are provisioned, model mappings are populated, and all existing users are assigned active subscriptions.
- **Users Table Token Limit Sync with Global**: Fixed issue where users without dedicated personal limits displayed "نامحدود" instead of inheriting the active global token limit when roles had no specific quota (`null` or `0`). Updated `resolveEffectiveTokenLimit`, `resolveLimitSource`, and `effectiveLimitFor` to accurately fallback to `globalLimit` and mark source as «سراسری».
- **DB-authoritative user role and quota state**: user role access for model listings and admin routing is re-read from the database instead of trusting stale claims.
- **Streaming auto-scroll fixes**: Smooth follow and disengage on scroll gestures.
- **Sources hidden for user-stopped messages**: `SourcesBlock` is not displayed for stopped/interrupted messages.
- **Persian/Arabic File Name Encoding (Mojibake Fix)**: Full CP1252 / ISO-8859-1 decoding in `fixUtf8MangledString`, client-side `X-Original-Filename` header, and migration `1761300000006-FixMangledFilenames.ts`.
- **Admin File Content Download**: Authenticated endpoint `GET /admin/files/:id/content` allowing admin inspection and download of user files.
- **Real-Time Streaming Synchronization**: Direct synchronous token appending in `frontend/src/stores/chat.ts`, eliminating queue backlog and sudden end jumps.
- **Token Exhaustion Message**: Clear message «توکن مصرفی شما به پایان رسید» displayed in composer and toasts when token quota is depleted.

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

