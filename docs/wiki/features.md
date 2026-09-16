# Features

## Task 31: Version 1.1.0 Release — Admin Chat Viewer, System Prompt Section, Fixed Sidebar, 3s Search Debounce, Uniform Provider Cards & RTL Enhancements
- **مشاهده و بازرسی چت‌ها در پنل ادمین (`Admin Chat Viewer`)**:
  - ایجاد کنترلر اختصاصی `AdminConversationsController` در بک‌اند با اندپوینت‌های `GET /admin/conversations`، `GET /admin/conversations/:id` و `DELETE /admin/conversations/:id` محافظت شده با `AdminGuard`.
  - اضافه شدن تب «گفتگوها» به پنل ادمین همراه با جدول مشخصات، تعداد پیام‌ها، نام کاربر و مدال کامل مشاهده حباب‌های پیام و تاریخچه کامل گفتگو.
- **بخش اختصاصی پرامپت سیستم در پنل ادمین (`System Prompt Section`)**:
  - اضافه شدن تب مستقل «پرامپت سیستم» به سایدبار ادمین با الگوهای آماده (پیش‌فرض، دستیار برنامه‌نویسی، لحن رسمی، خلاصه ساز)، شمارنده زنده حروف/کلمات/خطوط، و قابلیت ذخیره‌سازی پایدار در دیتابیس.
- **سایدبار کاملاً ثابت و بدون اسکرول پنل ادمین (`Fixed Sidebar`)**:
  - تثبیت دائمی سایدبار (`position: fixed; inset-inline-start: 0; height: 100vh; overflow: hidden;`) تا در هیچ شرایطی اسکرول نخورد و محتوای اصلی به صورت مجزا اسکرول شود.
- **هماهنگ‌سازی کامل کاردهای ارائه‌دهنده‌ها (`Uniform Provider Cards`)**:
  - یکسان‌سازی ارتفاع کاردها با `min-height: 250px` و چیدمان منعطف عمودی، بدون تغییر اندازه یا کشیدگی نامتوازن.
  - حذف برچسب «سیستمی» از ارائه‌دهنده‌ها طبق درخواست.
  - نمایش چیپ‌ها و نام مدل‌های متصل به هر ارائه‌دهنده در پایین کارد مربوطه.
- **دیلی ۳ ثانیه‌ای در جستجوها (`3-Second Debounce`)**:
  - اعمال تاخیر ۳ ثانیه‌ای (۳۰۰۰ میلی‌ثانیه) در سرچ سایدبار چت‌ها و سرچ پنل ادمین جهت جلوگیری از درخواست‌های مکرر و بهبود کارایی.
  - حذف نوار جستجو از تب داشبورد و تب پرامپت‌ها.
- **قانون جهت متن در اینپوت برای عبارات ترکیبی فارسی و انگلیسی (`RTL Direction Rule`)**:
  - تنظیم تابع `getActiveTypingDirection` به شکلی که در صورت وجود هرگونه کاراکتر فارسی (حتی در متن‌های ترکیبی فارسی و انگلیسی)، جهت متن حتماً `rtl` باشد و صرفاً در صورت انگلیسی خالص `ltr` شود.
- **رفع تداخل پلیس‌هولدر و حذف سایه مدال‌ها**:
  - حذف کامل `box-shadow` از مدال‌ها (`AdminModal`، `ModelsModal`، `SearchModal`).
  - اصلاح فاصله‌گذاری ورودی سرچ با ویژگی‌های منطقی (`padding-inline-start: 38px`) جهت رفع همپوشانی آیکون و پلیس‌هولدر.

## Task 30: Admin Panel Overhaul, Custom AdminTable, Edit/Delete Modals & Token Quotas (بازطراحی و ارتقای پنل ادمین، کامپوننت جدول، مدال‌های ویرایش/حذف و سهمیه توکن)
- **کاردهای مینیمال با فواصل استاندارد**: بازطراحی کاردهای آماری شاخص‌های کلیدی (KPIs) با فواصل استاندارد ۲۰ پیکسلی (`gap-5`)، حاشیه‌های ظریف، سایه‌های ملایم و پس‌زمینه کارت متوازن در `AdminPanelView.vue`.
- **سایدبار ثابت و چسبان (`Sticky / Fixed Sidebar`)**: ثابت‌سازی سایدبار ادمین (`position: sticky; top: 0; height: 100vh; overflow-y: auto;`) تا در زمان اسکرول کردن محتوا و جداول طولانی همواره در دسترس و ثابت بماند.
- **کامپوننت اختصاصی جداول (`AdminTable.vue`)**: ساخت کامپوننت ماژولار جداول با قابلیت سفارشی‌سازی هدرها، اسلات سطرهای دلخواه، هاور ملایم و حالت خالی با پیام و آیکون فارسی.
- **مدال‌های اختصاصی ویرایش و حذف**:
  - جایگزینی کامل `window.confirm` با `DeleteConfirmModal.vue` همراه با حالت لودینگ و غیرفعال‌سازی دکمه در زمان اجرا.
  - انتقال فرم‌های ایجاد و ویرایش مدل و ارائه‌دهنده به مدال‌های اختصاصی با فیلدهای از پیش پر شده.
  - ساخت مدال اختصاصی ویرایش کاربر با فیلدهای از پیش پر شده (نام، ایمیل، نقش، سقف توکن، و امکان ریست مصرف توکن).
  - **حذف دکمه حذف کاربر**: در جدول کاربران، دکمه حذف کاملاً حذف شده و فقط دکمه ویرایش و سوئیچ فعال/غیرفعال‌سازی وضعیت کاربر در دسترس است.
- **سیستم مدیریت دو سطحی سقف توکن‌ها (`Two-Tier Token Quota System`)**:
  - افزودن ستون `tokenLimit` به جدول کاربران در بک‌اند (`1761200000000-AddUserTokenLimit.ts`) برای تعیین سقف اختصاصی هر کاربر.
  - بررسی اولویت‌دار سهمیه در `chat.service.ts`: ابتدا سقف اختصاصی کاربر بررسی می‌شود (مقدار ۰ به معنای سقف نامحدود) و در صورت عدم تعیین، سقف سراسری سیستم اعمال می‌شود.
  - رفع باگ عدم شمارش توکن در استریمینگ واقعی چت (محاسبه و ذخیره قطعی در بلاک `finally` متد `generate`).
  - تعبیه دکمه و مدال تنظیم سقف توکن سراسری و پرامپت سیستم در داشبورد ادمین.
- **فارسی‌سازی ۱۰۰٪ با فونت وزیرمتن و حذف تمامی عبارات انگلیسی**:
  - حذف کلیه سربرگ‌های انگلیسی بالای صفحات و جداول (`CATALOG`, `REGISTRY`, `ACCESS & USAGE`, `SYSTEM STATUS`, `USAGE`, `PARVA / ADMIN`, `ADMIN CONSOLE`).
  - اعمال یکپارچه فونت وزیرمتن با چینش کاملاً راست‌به‌چپ (`RTL`).
- **جستجوی همه‌جانبه**: فیلتر لحظه‌ای و پویا برای تمامی بخش‌ها (مدل‌ها، ارائه‌دهنده‌ها، کاربران) با دکمه پاک‌کردن سریع جستجو.
- **تست‌ها**: پاس شدن ۱۰۰٪ تمامی ۲۳ فایل تست فرانت‌اند (۱۲۴ تست سبز شامل تست جدید `AdminTable.spec.ts`) و ۱۸ فایل تست بک‌اند (۱۲۷ تست سبز).

## Task 29: Admin Panel Restoration & Direct Navigation (بازگردانی کامل پنل و داشبورد ادمین و هدایت مستقیم بدون مدال)
- **بازگردانی کامل پنل مدیریت (`AdminPanelView.vue`)**: بازگردانی کامل داشبورد مدیریتی شامل ۴ تب مجزا: داشبورد (کارت‌های KPI، مصرف توکن، مدل‌های فعال، وضعیت ارائه‌دهندگان)، مدیریت ارائه‌دهندگان (Providers)، مدل‌ها (Models)، و کاربران (Users با قابلیت تغییر نقش و غیرفعال‌سازی).
- **هدایت مستقیم بدون باز شدن مدال**: حذف باز شدن پاپ‌آپ/مدال ادمین هنگام کلیک روی دکمه‌های «ادمین» یا «پنل مدیریت» در سایدبار (`AppSidebar.vue`)، هدر (`AppHeader.vue`) و منوی پروفایل (`ProfileMenu.vue`)؛ در تمام این بخش‌ها کاربر مستقیماً از طریق روتر به `/admin/models` هدایت می‌شود.
- **حفظ ۱۰۰٪ قابلیت‌های متنی تسک ۲۸**: تمامی قابلیت‌های تایپ دوطرفه پویا، چینش خط-به-خط پیام‌های کاربر و مارک‌داون هیبرید حفظ شده و با پنل مدیریت همگام است.
- **تست‌ها**: پاس شدن ۱۰۰٪ تست‌های فرانت‌اند (۲۲ فایل تست، ۱۲۱ تست سبز) و بک‌اند (۱۸ فایل تست، ۱۲۶ تست سبز).

## Task 28: Hybrid & Dynamic Bidirectional Text Direction (چپ‌چین و راست‌چین هوشمند و هیبرید)
- **پویاسازی جهت در اینپوت (`ChatComposer.vue`)**: با تایپ هر کاراکتر و جابجایی مکان‌نما، جهت ورودی به صورت بلادرنگ تنظیم می‌شود (تایپ انگلیسی $\rightarrow$ چپ‌چین؛ تایپ فارسی $\rightarrow$ راست‌چین؛ تایپ مجدد انگلیسی $\rightarrow$ چپ‌چین) و با پاک شدن ورودی یا ارسال پیام بلافاصله به پیش‌فرض فارسی (`rtl`) برمی‌گردد.
- **چینش هیبرید خط-به-خط در پیام‌های کاربر (`MessageBubble.vue`)**: خطوط پیام کاربر به صورت مستقل بررسی شده و خطوط انگلیسی در سمت چپ و خطوط فارسی در سمت راست قرار می‌گیرند (`.user-msg-line.rtl` و `.user-msg-line.ltr`).
- **جهت‌گیری مستقل اجزای Markdown در پاسخ دستیار (`MarkdownContent.vue`)**: بلوک‌های مارک‌داون، آیتم‌های لیست (`li`)، نقل‌قول‌ها (`blockquote`)، و خطوط پاراگراف با `<br>` هر کدام جهت مستقل خود را حفظ می‌کنند.
- **تست‌ها**: افزودن تست‌های جامع واحد در `textDirection.spec.ts`، `ChatComposer.spec.ts` و `MessageBubble.spec.ts` (تمام ۱۲۰ تست فرانت‌اند و ۱۲۵ تست بک‌اند سبز).

## Task 27: Per-Conversation Independent Streaming State
- Refactored `chat.ts` Pinia store to replace all global streaming state refs with a `Map<convId, ConvStreamState>`.
- Each conversation now has its own `isStreaming`, `isThinking`, `streamError`, `currentStreamingText`, `abortController`, and `lastUserPrompt`.
- Backward-compatible computed aliases expose the active conversation's state to all components without code changes in `ChatComposer.vue`, `MessageList.vue`, etc.
- Switching conversations no longer aborts an ongoing background stream — both conversations continue independently.
- `AppSidebar.vue`: Animated pulsing dot badge shown next to any conversation currently streaming in the background (visible in both expanded and icon-only sidebar modes).
- Updated 3 test files (`MessageList.spec.ts`, `ChatComposer.spec.ts`, `NetworkAndRetry.spec.ts`) to use `convStreamStates` Map for test setup.

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

## Task 15: User Profile, MinIO Avatars & Credential Changes (backend only)
- **Profile endpoints**: `GET/PATCH /users/me` — `displayName` and unique lowercased `username` (409 on conflict; `bio`/language/theme/timezone/defaultModelId were later removed by product decision — see `CHANGELOG`). Shipped via dedicated TypeORM migrations (`AddUserProfileAndPreferences` then `DropUserProfileAndPreferences`; run with `npm run migration:run`, local dev still auto-syncs with `DB_SYNC=true`).
- **Avatars on MinIO** (new `StorageModule` + `minio` dependency): `POST /users/me/avatar` (multipart field `file`; only `image/png|jpeg|webp`; ≤ 2 MB → honest 413 by multer; replaces + deletes the previous object), `DELETE /users/me/avatar`. Files are served publicly at `GET /static/avatars/{userId}/{file}` (opaque random keys, streamed from MinIO). Without `MINIO_*` env, upload endpoints return **503** — no silent disk fallback.
- **Credential changes with re-auth**: `POST /users/me/email` (requires the current password → 401 if wrong; 409 if the email exists; applies immediately) and `POST /users/me/password` (requires current password; bcrypt re-hash). No forgot-password/reset flow (product decision).
- **Contract**: `Users` tag + `/users/me*` + `/static/avatars/...` paths in `api-contract.yaml`. Tests: `backend/test/profile.spec.ts`. Frontend untouched.

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
  - Recorded the previous gap explicitly: the previous implementation persisted partial text but did not support durable generation state or true resume from a cursor after reconnect.

## Task 18: Resumable & Persistent Streaming Across Refreshes + AI Auto-Title Generation
- **Resilient & Resumable Streaming (Full-Stack)**:
  - **Backend Decoupled Stream Architecture (`ActiveStreamService`)**:
    - Background LLM generation sessions are maintained independently of individual client HTTP connections.
    - If the user refreshes the page or experiences a network interruption, the generation continues uninterrupted in the background instead of aborting upstream.
    - `ActiveStreamSession` maintains buffered tokens (`accumulatedText`), status (`thinking` / `streaming` / `completed`), subscribers, and abort controllers.
    - `GET /chat/conversations/:id/active-stream`: Returns current generation status, accumulated tokens, and title.
    - `GET /chat/conversations/:id/stream`: Server-Sent Events (SSE) reconnection endpoint. Dispatches `event: sync` with accumulated text and continues streaming incoming tokens in real time.
    - `POST /chat/conversations/:id/messages/:messageId/resume`: Continues interrupted assistant responses directly from where they stopped with prior context and continuation prompt.
    - `POST /chat/conversations/:id/stop` & `POST /chat/conversations/:id/messages/:messageId/stop`: Allows explicit user-initiated stream cancellation.
  - **Frontend Stream Reconnection & Persistence (`chatService`, `useChatStore`)**:
    - On page refresh or conversation selection, `chatStore` checks for active background streams via `chatService.getActiveStream`.
    - If active, the UI immediately restores `isStreaming = true`, populates `currentStreamingText` with accumulated content, renders the typing animation, and attaches to the live stream via `subscribeActiveStream`.
    - Automatic retry with exponential backoff on transport disconnects.
    - Streamed content never vanishes or jumps abruptly on refresh.
- **AI-Powered Automatic Conversation Titling (Auto-Title)**:
  - `OpenAiCompatForwarder.complete`: Lightweight non-streaming method for fast one-turn completions.
  - Upon receiving the first user message in a new conversation, triggers a concurrent, non-blocking AI prompt to generate a 3-5 word concise title in the same language.
  - Persists title to PostgreSQL (`conversations.title`) and emits `event: title` over SSE stream.
  - Frontend updates the active conversation title in the sidebar in real time without requiring a page reload.
  - Includes offline heuristic fallback (clean keyword boundary trimming up to 35 chars) if the AI provider is unreachable or unconfigured.
- **Verification**:
  - 100% test pass rate across both projects: 109 backend tests (15 test suites) and 77 frontend tests (16 test suites) — 186/186 total passing tests.

## Task 19: ChatGPT-Style Chat Layout Refactor & Rich Markdown Engine (Code, Tables, Readme)
- **ChatGPT-Style Layout Refactoring**:
  - Refactored chat presentation to modern turn-based layout:
    - User prompt anchored cleanly at the top of each turn with user avatar, name badge, and timestamp.
    - Assistant response positioned directly underneath the user prompt, unfolding across the full width of the central reading container (`max-w-3xl` / `max-w-4xl`).
    - Clean visual rhythm with Tailwind CSS utility classes, smooth spacing (`gap-3.5`, `py-6`), and seamless responsiveness across desktop and mobile.
    - Obsidian Dark theme and Warm Cream Light theme full compatibility.
  - Assistant response box has zero border and completely transparent background color, integrating seamlessly with the page surface.
  - Removed sender/chatbot name text ("شما" / "دستیار هوشمند پروا") for a decluttered, authentic conversation flow.
  - Replaced "در حال نوشتن..." textual label with a minimal 3-dot bouncing pulse indicator.
  - Localized timestamps to Persian digits with explicit «قبل‌ازظهر» / «بعدازظهر» indicators.
  - Added copy button to user messages as well, allowing users to copy their own prompts instantly.
  - Arranged login view with brand artwork on the left pane and authentication form on the right pane.
- **Rich Markdown Engine (`MarkdownContent.vue`)**:
  - Powered by `marked` with custom GFM renderers:
    - **Code Blocks**: Formatted in `dir="ltr"` with JetBrains Mono, language header badge (e.g. `TYPESCRIPT`, `PYTHON`, `SQL`), and an interactive copy button with instant feedback («کپی» -> «کپی شد ✓»).
    - **Responsive Tables**: Full GFM markdown tables wrapped in an overflow container (`table-responsive`) with zebra rows, themed borders, and horizontal scrolling on mobile.
    - **README & Typography**: Headers (`h1`-`h6`), nested ordered/unordered lists (`ul`, `ol`), blockquotes with accent left border, inline code pills (`code`), links opening in safe new tabs, and task checkboxes.
    - **Bidirectional Support (BiDi)**: Automatic text direction detection via `getTextDirection` — Persian paragraphs rendered in RTL, while code blocks and tables strictly maintain LTR formatting.
    - **Streaming-Friendly**: Dynamically closes unclosed fences during active stream generation.
- **Verification**:
  - 100% test pass rate: **109 backend tests** (15 test suites) + **82 frontend tests** (17 test suites, including new unit tests in `MarkdownContent.spec.ts`) — 191/191 total passing tests.
  - Production build (`vue-tsc -b && vite build`) compiles with zero errors.

## Task 20: Local Login Connection Fix
- Corrected the frontend `VITE_API_BASE_URL` to use the reachable local backend at `http://localhost:3000/api/v1` instead of an unavailable machine-specific IP.
- Updated the getting-started example to include the backend's `/api/v1` global prefix.

## Task 21: Streaming Chat Scroll Follow Behavior
- Chat streaming auto-scroll now follows only while the user is at or near the bottom of the message list.
- Scrolling upward during generation preserves the reader's position; returning to the bottom re-enables follow mode.
- Stream completion no longer forces a user who is reading older messages back to the bottom.
- Added focused regression coverage in `frontend/tests/MessageList.spec.ts`.

## Task 22: MinIO Object Storage Setup & Avatar Upload Fix
- Diagnosed root cause of `Object storage (MinIO) is not configured; avatar upload is disabled`: MinIO environment variables were missing from `backend/.env` and no local MinIO server was running.
- Started containerized MinIO server using Quay.io mirror (`codeless_minio`) with API on `9000` and console on `9001`.
- Added a root `docker-compose.yml` defining PostgreSQL and MinIO for repeatable local development.
- Configured MinIO settings in `backend/.env` (`MINIO_ENDPOINT`, `MINIO_PORT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_BUCKET`, `MINIO_REGION`, `PUBLIC_BASE_URL`).
- Enhanced `StorageService`:
  - Implemented `OnModuleInit` to auto-bootstrap the target bucket (`codeless`) on backend startup.
  - Added self-healing bucket creation in `put()` on `NoSuchBucket` errors.
  - Added robust parsing for `MINIO_ENDPOINT` handling (protocol/port stripping).
- Verified end-to-end user avatar upload, storage in MinIO, and retrieval via `GET /static/avatars/:userId/:file`.

## Task 23: Chat Error Handling, Upstream Timeouts & Message Delivery Status
- **Root Cause & Scope**: Long-running or stalled chat requests previously left the chat in an indefinite thinking state with no feedback, and network glitches inserted synthetic assistant messages that polluted chat history on refresh.
- **Backend Timeouts & Health Endpoint**:
  - Added `@Get(['health', 'api/v1/health'])` health endpoint (`backend/src/app.controller.ts` & `app.service.ts`), excluded from JWT guard and accessible at root without prefix.
  - Implemented 35-second connection timeout and 25-second idle read stall timeout in `OpenAiCompatForwarder` using `AbortController` and `AbortSignal`.
  - Added 35-second `thinkingTimer` in `ActiveStreamService` to automatically terminate stuck background sessions before first token emission.
  - Ensured provider failures before the first token properly propagate as standard 502 envelopes / SSE error events and cleanly end response sockets (`res.end()`).
- **Frontend Pre-flight Health & Delivery Lifecycle**:
  - Implemented `checkBackendHealth(timeoutMs?: number)` in `frontend/src/services/api.ts` to verify server availability before sending messages.
  - Kept user message bottom meta-bar strictly clean (timestamp + copy button only, avoiding clutter or status labels).
  - Fixed error persistence: Replaced fake synthetic assistant messages (`msg-err-...`) with a transient Pinia `streamError` ref and composer alert banner (`ChatComposer.vue`) that automatically resets to `null` on page refresh or conversation switch.
  - Enhanced retry action: Clicking the retry button on the stream error alert banner accurately recovers the user prompt even when `lastUserPrompt` was cleared (e.g. after refresh), aborts any lingering controllers/watchdogs, cleans trailing failed messages, and cleanly re-sends the prompt.
  - In backend `generate()`, existing stalled/thinking sessions are automatically aborted when starting a new send or retry, and duplicate user message entities are prevented from accumulating in PostgreSQL.
  - Normalized all offline and fetch failures to user-friendly Persian: «خطا در برقراری ارتباط».
- **Verification**:
  - 100% test pass rate across both monorepo projects: **125 backend tests** (18 test suites) + **109 frontend tests** (21 test suites) — 234 total passing tests.

## Task 24: Visual Theme Switcher & Sidebar Settings Overhaul
- **Problem**: The sidebar lacked a direct settings trigger, the "شخصی‌سازی" button in `ProfileMenu.vue` was non-functional (`emit('close')`), and the theme switcher in `SettingsModal.vue` consisted of two plain text rectangular buttons with typos (`Dark (Grok)`).
- **Sidebar & Profile Menu**:
  - Added dedicated Settings row in `AppSidebar.vue` footer with Persian label «تنظیمات», settings icon, and current active theme badge (`Moon` / `Sun`).
  - Added collapsed-state Settings icon button with tooltip in `sidebar-collapsed`.
  - Fixed "شخصی‌سازی" in `ProfileMenu.vue` to trigger `openSettings` with live theme badge.
  - Upgraded `ProfileMenu.vue` panel to floating glassmorphism styling (`backdrop-filter: blur(16px)`, rounded corners, soft shadows).
- **Settings Modal & Theme Switcher**:
  - Replaced basic buttons with two large interactive visual theme cards (Dark vs Light):
    - **Dark Mode Card**: Realistic miniature UI mockup showing slate-dark window frame, dark chat canvas, mini user and assistant chat bubbles, input bar, Moon icon badge, and active radio check indicator.
    - **Light Mode Card**: Realistic miniature UI mockup showing warm cream window frame, clean white chat canvas, navy chat bubbles, Sun icon badge, and active radio check indicator.
  - Supported instant real-time theme toggling with zero flicker and full CSS variable color preservation (`#FFFFFF` light mode, `#171825` dark mode).
  - Modernized language & direction toggles with country/locale badges and auto-save indicator.
- **Verification**:
  - Added `tests/SettingsModal.spec.ts` testing modal visibility, theme card switching, direction toggling, and closing.
  - 100% test pass rate across both monorepo projects: **125 backend tests** (18 test suites) + **112 frontend tests** (22 test suites) — 237/237 total passing tests.

## Task 25: Large Message List Auto-Scrolling & State Preservation
- **Problem**: When a conversation contained many messages (20+), sending a new message or streaming an assistant response failed to scroll all the way to the bottom. This occurred due to single-microtask scrolling (`nextTick`) measuring incomplete DOM layout heights before Markdown/code/KaTeX components finished reflow, coupled with Tailwind's `scroll-smooth` interrupting successive position updates.
- **Implementation**:
  - Replaced single `nextTick` scroll with multi-pass synchronization in `MessageList.vue`: Pass 1 (`nextTick`), Pass 2 (`requestAnimationFrame`), Pass 3 (`setTimeout(50)`), and Pass 4 (`setTimeout(150)`).
  - Attached `ResizeObserver` to the inner message content wrapper (`.message-list-content`) to detect dynamic height expansion from Markdown and syntax-highlighted code blocks, keeping the scroll position pinned to the absolute bottom during generation.
  - Implemented strict state protection:
    1. **User Scroll-Up**: If the user manually scrolls up to read earlier messages (`distanceFromBottom > 120px`), auto-scroll is paused so their reading position is never interrupted.
    2. **User Returns Near Bottom**: If the user scrolls within 120px of the bottom, auto-scroll smoothly resumes.
    3. **New User Message**: When the user submits a new prompt or switches conversations, auto-scroll is forcefully re-engaged and viewport jumps to the absolute bottom.
    4. **Stream Completion Away from Bottom**: If the assistant finishes streaming while the user is scrolled up, their reading position is preserved without sudden jerking.
  - Added a floating glassmorphic "Scroll to bottom" button (with real-time pulsating badge when streaming is active in the background) that allows 1-click jump to the absolute bottom.
- **Verification**:
  - Added comprehensive test coverage in `frontend/tests/MessageList.spec.ts` (6 passing tests).
  - Verified with headless Chrome screenshots (`chat_many_messages_bottom.png`, `chat_scroll_up_with_button.png`, `chat_after_jump_click.png`) with 25 messages, confirming `distanceFromBottom: 0`.
  - Full test suite green: **125 backend tests** (18 suites) + **114 frontend tests** (22 suites) — 239 total passing tests.

## Task 26: Complete Removal of English Language & Strictly Persian RTL Platform
- **Requirement**: Completely remove the English language option/capability from the platform, ensuring the application is purely Persian and strictly RTL without any bilingual toggles or LTR modes.
- **Store & Core Architecture**:
  - Updated `frontend/src/stores/ui.ts`: hardcoded `direction` strictly to `'rtl'`, purged any stored direction overrides from `localStorage`, and configured document root attributes exclusively to `dir="rtl"` and `lang="fa"`.
  - Converted `toggleDirection` to a backward-compatible no-op ensuring the direction cannot be changed away from RTL.
- **Settings Modal (`SettingsModal.vue`)**:
  - Removed the entire "Language & Direction" section (`زبان و جهت چیدمان`), including the English / LTR switch button and English labels.
  - Simplified the modal subtitle to «شخصی‌سازی ظاهر و تم برنامه» and retained the visual Dark / Light theme cards.
- **Component Text & Tooltip Normalization**:
  - Replaced all bilingual ternary checks (`isRtl ? ... : ...` and `uiStore.direction === 'rtl' ? ... : ...`) across the entire frontend codebase (`AppHeader`, `AppSidebar`, `ProfileModal`, `ProfileMenu`, `SearchModal`, `LogoutModal`, `EditConversationModal`, `DeleteConversationModal`, `ModelsModal`, `ChatComposer`, `MessageBubble`, `EmptyState`, `LoginView`, and `AdminModelsView`) with authentic Persian strings.
- **Verification & Visual Confirmation**:
  - Updated test suites (`SettingsModal.spec.ts`, `Stores.spec.ts`, and `AdminModelsView.spec.ts`) asserting that English/LTR options are absent and the application strictly operates in Persian RTL.
  - Verified with headless Chrome CDP screenshots (`settings_modal_pure_persian.png` and `persian_chat_view.png`).
  - Full test suite 100% green across both frontend and backend: **125 backend tests** (18 suites) + **114 frontend tests** (22 suites) — 239 total passing tests.


