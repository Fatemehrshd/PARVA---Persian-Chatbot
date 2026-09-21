# PARVA / CODELESS — مستند جامع فنی و محصولی


---

## ۱. خلاصه اجرایی

**PARVA** (نام تجاری) / **CODELESS** (نام کدبیس) یک پلتفرم چت هوش مصنوعی چندمدلی (Multi-Model AI Chat Platform) است که از صفر ساخته شده. هدف محصول، ارائه‌ی یک رابط فارسی RTL برای تعامل با مدل‌های مختلف LLM (OpenAI، DeepSeek، Grok و هر مدل سازگار با OpenAI) است — همراه با سیستم اشتراک تجاری کامل، درگاه پرداخت زرین‌پال (سندباکس)، مدیریت فایل با MinIO، پنل ادمین ماژولار، و ممیزی امنیتی.

**وضعیت:** محصول در مرحله‌ی Production-Ready قرار دارد (نسخه‌ی `1.3.x+`).  
**قانون طلایی:** هر فیچر جدید نباید فیچر قبلی را خراب کند.

---

## ۲. معماری و استک فنی

### نگاه کلی — Monorepo با دو سرویس مستقل

```
/
├── backend/      ← NestJS + TypeScript + PostgreSQL + TypeORM
├── frontend/     ← Vue 3 + Vite + TypeScript + Pinia + Tailwind CSS
├── docs/wiki/    ← مستندات فنی
├── docker-compose.yml
├── api-contract.yaml
└── perf/k6/      ← load test scripts
```

دو پروژه **کاملاً مستقل** هستند؛ تنها نقطه‌ی اتصال **قرارداد REST API** است. آدرس API هرگز hardcode نیست — همیشه از env var می‌آید.

---

### استک بک‌اند

| لایه | فناوری |
|---|---|
| فریم‌ورک | NestJS 10 (TypeScript) روی Express |
| دیتابیس | PostgreSQL 16 |
| ORM | TypeORM (migrations + `DB_SYNC=true` برای dev) |
| احراز هویت | JWT — access token 1h + refresh token 7d + bcryptjs |
| Object Storage | MinIO (S3-compatible) |
| جستجوی وب | Serper API (google.serper.dev) |
| استریمینگ | SSE (Server-Sent Events) — native Node 18+ fetch |
| Validation | class-validator + class-transformer، پیام‌های فارسی |
| درگاه پرداخت | Zarinpal Sandbox v4 REST |
| Telemetry | OpenTelemetry OTLP → SigNoz (fail-safe, opt-in) |
| تست | Jest — 95+ تست، بدون نیاز به DB یا MinIO |

---

### استک فرانت‌اند

| لایه | فناوری |
|---|---|
| فریم‌ورک | Vue 3 (Composition API) |
| Build Tool | Vite |
| State Management | Pinia (یک store به ازای هر domain) |
| Routing | Vue Router 4 (lazy loading + route guards) |
| Styling | Tailwind CSS + shadcn-vue |
| HTTP Client | Native Fetch (wrapper در `services/api.ts`) |
| Markdown | رندرینگ کامل + KaTeX برای فرمول‌های ریاضی |
| RTL | تمام UI فارسی و راست‌به‌چپ |
| تست | Vitest + Vue Test Utils |

---

### Infrastructure (Docker Compose)

| سرویس | پورت | نقش |
|---|---|---|
| PostgreSQL | 5432 | دیتابیس اصلی |
| MinIO API | 9000 | Object Storage (عکس پروفایل، فایل‌ها) |
| MinIO Console | 9001 | مدیریت Storage |
| Redis | 6379 | آماده در compose (برای cache/queue آینده) |
| Backend API | 3000 | `/api/v1/*` |
| Frontend SPA | 5173 | Vue dev server |

---

## ۳. ابزارهای اضافی

| ابزار | هدف | وضعیت |
|---|---|---|
| **SigNoz APM** | مانیتورینگ تله‌متری (OpenTelemetry OTLP HTTP) | کد آماده در `shared/telemetry.ts`؛ کانتینرها باید جداگانه راه‌اندازی شوند (نیاز به ≥4GB RAM) |
| **k6** | Load / Stress testing | اسکریپت کامل در `perf/k6/load-test.js` |
| **Serper API** | جستجوی زنده‌ی گوگل در چت | کلید از env (`SERPER_API_KEY`) |
| **Zarinpal Sandbox** | درگاه پرداخت واقعی (حالت تست) | اتصال به `sandbox.zarinpal.com` + fallback داخلی |
| **MinIO** | S3-compatible object storage | عکس پروفایل و فایل‌های ارسالی |


---

## ۴. ماژول‌های بک‌اند (NestJS)

هر ماژول **self-contained** است: controller + service + entity + dto + test در یک پوشه.

### `auth/` — احراز هویت
- **Endpoints:** `POST /auth/signup`، `POST /auth/login`، `POST /auth/logout`
- **مکانیزم:** JWT با access (1h) و refresh (7d). لیست سیاه توکن‌ها در حافظه (`AuthService.revoked`) برای logout سرور-ساید.
- **امنیت:** bcryptjs با salt=10، پیام خطاهای عمومی (جلوگیری از user enumeration)، guard در تمام مسیرهای حساس.

### `users/` — پروفایل کاربران
- **Endpoints:** `GET/PATCH /users/me`، تغییر ایمیل/رمز عبور با re-auth، `GET/PATCH /users/me/theme`، آپلود آواتار.
- کلیدهای حساس هرگز در response لیک نمی‌شوند. آواتار فقط از MinIO سرو می‌شود.

### `chat/` — چت و مکالمات
- **Endpoints:** CRUD کامل مکالمات، ارسال پیام با SSE streaming، resume، stop، pin، search، feedback (like/dislike)، share.
- `ChatService.generate()` یک async generator است که توکن‌ها را token-by-token yield می‌کند.
- **ActiveStreamService:** استریم را مستقل از اتصال کلاینت نگه می‌دارد (صفحه رفرش بشود، تولید توکن ادامه می‌یابد).

### `ai/` — فوروارد به مدل‌ها
- **OpenAiCompatForwarder:** زنجیره‌ی credential resolution: `model.apiKey → provider.apiKey → OPENAI_API_KEY (env)`.
- **ThinkTagStreamParser:** استخراج `<think>...</think>` از stream برای نمایش Chain of Thought.
- اگر هیچ credential‌ای نباشد → echo offline (فقط در dev، با WARN در لاگ).

### `models-admin/` — مدیریت مدل‌ها و پرووایدرها
- CRUD کامل برای `AiProvider` و `AiModel`.
- کلیدهای API همیشه masked می‌شوند (`sk-...last4`).
- تنها یک مدل می‌تواند `isDefault=true` باشد. مدل پیش‌فرض قابل غیرفعال شدن نیست مگر جانشین داشته باشد.
- `POST /admin/models/test` — تست اتصال و latency قبل از ذخیره.

### `subscriptions/` — پلن‌های اشتراک
- `SubscriptionPlan` + `PlanModel` + `Subscription` entities.
- **EntitlementService:** محاسبه‌ی دسترسی کاربر، quota cascade، feature gating (`webSearch`, `thinking`, `document`).
- Lazy expiration: اشتراک منقضی‌شده در اولین فراخوانی `getActiveSubscription` expire می‌شود.

### `payments/` — پرداخت
- Pessimistic write lock در verify برای جلوگیری از double-credit.
- `PaymentGatewayProvider` interface — دو پیاده‌سازی: `SandboxPaymentGateway` (داخلی) + `ZarinpalPaymentGateway` (رسمی sandbox).
- Zero-cost bypass: اگر کوپن قیمت را به ۰ برساند، مستقیم activate می‌شود.
- `CouponsService`: تخفیف درصدی/ثابت، سقف استفاده، per-user limit، تاریخ انقضا.

### `admin/` — تنظیمات سیستم
- `system_settings` table: key-value store برای تنظیمات سراسری (global token limit، model access rules، web search usage counter و...).

### `files/` — مدیریت فایل
- آپلود image/pdf/excel/text به MinIO، استخراج متن، تله‌متری با SigNoz.
- پاکسازی خودکار فایل‌های orphan بعد از 48 ساعت. فایل‌های bound به پیام دائمی نگه داشته می‌شوند.

### `audit/` — ممیزی امنیتی
- `AuditLog` entity با auto-redaction کلیدهای حساس (passwords، tokens، apiKey، card numbers).
- رویدادهای مالی و مدیریتی را ثبت می‌کند.

### `web-search/` — جستجوی وب
- **Serper API** با timeout 10s و max 8 منبع.
- شمارش مصرف credit به صورت atomic در `system_settings`.

### `storage/` — Object Storage
- Global module برای MinIO: put/get/remove. اگر MinIO کانفیگ نشده باشد → 503 صادقانه (هیچ fallback دیسکی وجود ندارد).

---

## ۵. معماری فرانت‌اند

### صفحات (Views)

| مسیر | View | توضیح |
|---|---|---|
| `/` | `ChatView.vue` | رابط اصلی چت |
| `/chat/:id` | `ChatView.vue` | گفتگوی خاص |
| `/login` | `LoginView.vue` | ورود/ثبت‌نام (همیشه light theme) |
| `/subscription` | `SubscriptionView.vue` | صفحه‌ی خرید اشتراک |
| `/payment-result` | `PaymentResultView.vue` | نتیجه‌ی پرداخت |
| `/sandbox-gateway` | `SandboxGatewayMockView.vue` | شبیه‌ساز درگاه |
| `/share/:shareCode` | `SharedChatView.vue` | نمایش عمومی گفتگوی share شده (بدون auth) |
| `/admin/*` | `AdminPanelView.vue` + 13 sub-route | پنل ادمین ماژولار |

### Pinia Stores

| Store | مسئولیت |
|---|---|
| `auth.ts` | session، JWT، identity، quota، theme sync |
| `chat.ts` | مکالمات، streaming state (per-conversation)، message queue |
| `models.ts` | لیست مدل‌های در دسترس |
| `ui.ts` | toast، theme، sidebar state، authPageLightMode |
| `counter.ts` | نمونه‌ی ساده (legacy) |

### کامپوننت‌های کلیدی

| کامپوننت | نقش |
|---|---|
| `AppSidebar.vue` | لیست مکالمات، pin، 3-dots menu، share |
| `ChatComposer.vue` | input چت، آپلود فایل، web search toggle، thinking toggle |
| `MessageBubble.vue` | رندر پیام، markdown، KaTeX، thinking block، feedback |
| `ThinkingBlock.vue` | نمایش chain-of-thought با کرونومتر زنده |
| `ImageGallery.vue` | گالری تصاویر با lightbox |
| `CheckoutModal.vue` | مودال خرید اشتراک + کد تخفیف |
| `PersianDatePicker.vue` | دیت‌پیکر شمسی اختصاصی (zero-dependency) |
| `AdminTable.vue` | DataGrid با server-side pagination/sort/filter |

### Route Guards

```
requiresAuth    → redirect به /login اگر token نداشته باشد
requiresAdmin   → refresh identity از DB + redirect به / اگر admin نباشد
guestOnly       → redirect به / اگر logged-in باشد
token expiry    → proactive check در window focus
```

---

## ۶. امنیت و RBAC

### نقش‌ها (Roles)

| نقش | دسترسی |
|---|---|
| `admin` | همه چیز — bypass کامل quota و model lock |
| `user` | چت، پروفایل، اشتراک، تاریخچه پرداخت |

نقش‌ها فقط بر **اختیارات مدیریتی** اثر دارند؛ **دسترسی به مدل‌ها** با subscription plan کنترل می‌شود.

### Model Access Levels

| سطح | توضیح |
|---|---|
| `public` | همه‌ی کاربران |
| `commercial` | نقش‌های مجاز (در `system_settings.model_access`) |
| `private` | فقط `allowedUserIds` whitelist |

تابع `resolveModelAccess` تنها مرجع تصمیم است — در `GET /models`، `POST chat/messages`، و `GET /models/default` اعمال می‌شود.

### سایر مکانیزم‌های امنیتی

- **JWT blacklist** در memory برای logout سرور-ساید
- **Pessimistic write lock** در verify پرداخت (جلوگیری از race condition)
- **Soft delete** برای users، models، providers (حذف فیزیکی نمی‌شوند)
- **Auto-redaction** در AuditService برای کلیدهای حساس
- **API key masking** در تمام response های admin (`sk-...last4`)
- **Re-auth** برای تغییر email/password (current password لازم است)
- **CORS** whitelist از env (`FRONTEND_URL`)
- **Input validation** با class-validator + whitelist: true + forbidNonWhitelisted
- **DB-authoritative role:** نقش در هر request حساس از DB خوانده می‌شود نه از JWT

### Quota Cascade Priority

```
۱. سهمیه‌ی اختصاصی کاربر (user.tokenLimit > 0)
۲. سهمیه‌ی پلن اشتراک فعال (plan.tokenQuota > 0)
۳. سقف سراسری سیستم (globalTokenLimit > 0)
```


---

## ۷. Data Model

### جداول اصلی

```
users
  id (uuid PK)
  email (unique)
  passwordHash
  displayName, username (unique nullable)
  avatarUrl, avatarKey
  role ('user' | 'admin')
  isActive, isDeleted (soft-delete)
  tokenLimit (null=inherit), messageLimit (null=inherit)
  usedTokens, periodUsedTokens, periodUsedMessages
  periodStart, usageByType (jsonb)
  themePreference
  createdAt

conversations
  id (uuid PK)
  userId (FK → users, SET NULL on delete)
  title, modelId
  isDeleted, isPinned
  createdAt, updatedAt

messages
  id (uuid PK)
  conversationId (FK → conversations, CASCADE)
  role ('user' | 'assistant' | 'system')
  content (text)
  isInterrupted, stoppedByUser, isDeleted
  sources (jsonb) — web search sources
  reasoning_content (text) — chain of thought
  thinking_duration_ms (int)
  feedback ('like' | 'dislike' | null)
  createdAt

ai_providers
  id (uuid PK)
  name (unique), baseUrl, apiKey (write-only)
  isActive, defaultModelId
  isDeleted

ai_models
  id (uuid PK)
  name, provider (display label), apiIdentifier
  apiKey, baseUrl (per-model overrides)
  providerId (FK → ai_providers, CASCADE)
  isActive, isDefault, isDeleted
  accessLevel ('public' | 'commercial' | 'private')
  allowedUserIds (jsonb array)
  supportsThinking, supportsVision, supportsDocument
  thinkingBudgetTokens (nullable int)
  createdAt

file_attachments
  id (uuid PK)
  userId, conversationId, messageId (nullable FKs)
  originalName, mimeType, fileType, fileSize
  minioKey, status ('uploading'|'processing'|'ready'|'error')
  extractedText, metadata (jsonb)
  expiresAt (48h orphan cleanup)
  isDeleted

subscription_plans
  id (uuid PK)
  slug (unique), name, description
  price (bigint IRR), currency, durationDays
  tokenQuota, messageQuota, resetHours
  features (jsonb: webSearch, thinking, document, maxFileSizeMb)
  isActive, isDefault, isDeleted, sortOrder

plan_models
  planId (FK → subscription_plans)
  modelId (FK → ai_models)

subscriptions
  id (uuid PK)
  userId (FK), planId (FK), paymentId (FK nullable)
  status ('ACTIVE'|'EXPIRED'|'CANCELLED'|'PENDING')
  startDate, endDate (nullable = lifetime)
  source, cancelledAt, metadata (jsonb)

payments
  id (uuid PK)
  userId (FK), planId (FK), couponId (FK nullable)
  amount, originalAmount, discountAmount (bigint IRR)
  currency, status ('PENDING'|'SUCCESS'|'FAILED'|'CANCELLED'|'REFUNDED')
  gateway ('sandbox' | 'zarinpal')
  authority (unique), refId, idempotencyKey (unique)
  ip, userAgent, verifiedAt, metadata (jsonb)

coupons
  id (uuid PK)
  code (unique)
  discountType ('PERCENTAGE' | 'FIXED')
  discountValue, maxDiscountAmount, minOrderAmount
  usageLimit, usedCount, perUserLimit
  expiresAt, isActive

coupon_usages
  couponId (FK), userId (FK), paymentId (FK)

chat_shares
  id (uuid PK)
  shareCode (unique, 32 chars)
  conversationId (FK nullable), userId (FK)
  title, modelId, modelName
  snapshotMessages (jsonb — frozen at share time)
  isActive, viewCount

audit_logs
  id (uuid PK)
  actorId (uuid nullable), actorType
  action, entityType, entityId
  changes (jsonb: before/after), metadata (jsonb)
  ip, userAgent, createdAt

system_settings
  key (PK text)
  value (text)
  updatedAt
  — کلیدهای مهم: globalTokenLimit، model_access، web_search_used، ...
```

### روابط کلیدی

```
User ──< Conversation ──< Message ──< FileAttachment
User ──< Subscription >── SubscriptionPlan ──< PlanModel >── AiModel
User ──< Payment >── SubscriptionPlan
Payment >── Coupon ──< CouponUsage
AiModel >── AiProvider
Conversation ──< ChatShare
```

---

## ۸. Data Flows

### ۸.۱ جریان ارسال پیام (Streaming Chat)

```
[کاربر تایپ می‌کند و Send می‌زند]
       ↓
ChatComposer.vue → chatStore.sendMessage()
       ↓
POST /api/v1/chat/conversations/:id/messages
  Accept: text/event-stream
       ↓
ChatController.send()
  ├─ JwtAuthGuard: verify token (+ blacklist check)
  ├─ QuotaInterceptor: بررسی سهمیه (token/message)
  ├─ EntitlementService: بررسی دسترسی مدل
  ├─ [اختیاری] WebSearchService.search() → Serper API
  │     → event: search-status, event: sources
  ├─ ChatService.generate() → async generator
  │     ├─ OpenAiCompatForwarder.resolveTarget()
  │     │     credential chain: model.apiKey → provider.apiKey → env
  │     ├─ fetch(upstream, stream:true)
  │     ├─ [اختیاری] ThinkTagStreamParser
  │     │     → event: thinking-status, event: thinking
  │     └─ token-by-token yield
  │           → event: token
  ├─ پس از اتمام: ذخیره message در DB
  └─ event: done (messageId)
       ↓
chatStore: مستقیم append به currentStreamingText (no buffer queue)
       ↓
MessageBubble.vue رندر می‌کند
```

### ۸.۲ جریان احراز هویت

```
LoginView → authStore.login()
  → POST /auth/login
  → دریافت {user, accessToken, refreshToken}
  → setSession() → localStorage
  → refreshProfile() → GET /users/me (با آواتار)
  → syncUserTheme() → GET /users/me/theme
  → refreshIdentity() → GET /users/me (DB-authoritative role)
```

### ۸.۳ جریان خرید اشتراک

```
SubscriptionView → CheckoutModal
  → [اختیاری] POST /payments/coupons/validate
  → POST /payments/checkout  {planId, couponCode, gateway}
       ↓
  اگر price == 0 یا coupon 100% → فعال‌سازی فوری → SUCCESS
  اگر gateway == 'sandbox' → redirect به /sandbox-gateway
  اگر gateway == 'zarinpal' → redirect به sandbox.zarinpal.com
       ↓
PaymentResultView (بازگشت از درگاه)
  → POST /payments/verify  {authority, status}
    (pessimistic_write lock → فقط یک بار verify می‌شود)
  → subscription ACTIVE
  → AuditLog ثبت می‌شود
```

### ۸.۴ جریان Share گفتگو

```
AppSidebar (3-dots) → ShareConversationModal
  → POST /chat/conversations/:id/share
    (snapshot از messages در snapshotMessages jsonb ذخیره می‌شود)
  → shareCode تولید → URL کپی می‌شود

بیننده → /share/:shareCode (بدون auth)
  → GET /chat/shares/:shareCode
  → SharedChatView رندر می‌کند (frozen, read-only)
  → [اختیاری] POST /chat/shares/:shareCode/fork → مکالمه‌ی جدید
```

### ۸.۵ مدیریت Quota

```
هر پیام:
  ChatService → EntitlementService.checkQuota()
    → resolveEffectiveTokenLimit():
        user.tokenLimit > 0  →  استفاده از آن
        plan.tokenQuota > 0  →  استفاده از آن
        globalTokenLimit > 0 →  استفاده از آن
        else → نامحدود
    → lazy period reset (اگر periodStart + resetHours گذشته باشد)
    → مصرف ثبت می‌شود در periodUsedTokens + usedTokens
    → X-User-Quota header → فرانت‌اند quota state را sync می‌کند
```


---

## ۹. ویژگی‌های محصول (از نگاه کاربر)

### چت و مکالمات
- **چت real-time streaming** با رندر token-by-token
- **تغییر مدل در وسط مکالمه** (PATCH /chat/conversations/:id)
- **Chain of Thought / Deep Thinking** — نمایش استدلال مدل با کرونومتر زنده (مدل‌های پشتیبانی‌کننده)
- **جستجوی زنده‌ی وب** در حین چت (تا 8 منبع از Google)
- **ارسال فایل** — تصویر، PDF، Excel، Text؛ مدل محتوا را می‌بیند
- **پین کردن مکالمه** — گفتگوهای مهم همیشه بالا
- **جستجو در گفتگوها**
- **لایک/دیس‌لایک پیام‌های دستیار**
- **ادامه‌ی مکالمه بعد از رفرش** — ActiveStreamService استریم را نگه می‌دارد
- **پیش‌نویس متن** — draft در sessionStorage per conversation
- **Share گفتگو** — لینک عمومی با snapshot منجمد + امکان Fork

### پروفایل و تنظیمات
- تغییر نام، ایمیل، رمز عبور (با re-auth)
- آپلود آواتار (MinIO)
- **تم اختصاصی به ازای هر کاربر** (light/dark، ذخیره در DB، مستقل از بقیه)
- سابقه‌ی پرداخت‌ها

### اشتراک و پرداخت
- مقایسه‌ی پلن‌ها (Free / Pro / Enterprise)
- **کد تخفیف** با اعتبارسنجی real-time
- **دو درگاه:** زرین‌پال sandbox + شبیه‌ساز داخلی
- **تقویم شمسی اختصاصی** برای تاریخ انقضای کوپن
- پلن فعال قفل است تا توسط ادمین لغو نشود

### پنل ادمین
- **داشبورد:** KPI های سیستم، رضایت کاربران
- **مدل‌ها و پرووایدرها:** CRUD کامل، تست اتصال، سطح دسترسی
- **کاربران:** ویرایش، تغییر نقش، تخصیص اشتراک، سهمیه (با badge ارث‌بری)
- **پلن‌ها:** تعریف پلن با مدل‌های اختصاصی گروه‌بندی‌شده بر اساس پرووایدر
- **اشتراک‌ها و تراکنش‌ها:** جدول مالی + KPI درآمد
- **کدهای تخفیف:** CRUD + مانیتورینگ مصرف
- **فایل‌ها:** مشاهده، دانلود، تنظیمات
- **گفتگوها:** جستجو و بررسی
- **لاگ‌های ممیزی:** فیلتر action + نمایش metadata
- همه‌ی جداول: server-side search/filter/sort/pagination

---

## ۱۰. تصمیمات معماری کلیدی

### ADR-001: Monorepo با دو سرویس مستقل
frontend و backend کاملاً ایزوله هستند. تنها رابط: قرارداد REST API (`api-contract.yaml`).

### ADR-002: پاکت یکنواخت پاسخ
همه‌ی پاسخ‌های JSON: `{ success, message, data }`.  
SSE streams از این interceptor معاف هستند.  
خطاها: `{ success:false, message, error, statusCode }`.

### ADR-003: معماری هیبرید فرم + Route Guard
- `useFormSubmit` composable برای مدیریت loading/error/fieldErrors
- 401 global در `api.ts` → auto logout + redirect
- Role-based routing با identity از DB (نه از localStorage)
- حذف کامل mock fallback‌های production

### ADR-004: OpenAI-Compatible Architecture
هر مدل/پرووایدر از هر endpoint سازگار با OpenAI پشتیبانی می‌کند. API key در DB ذخیره می‌شود (masked)، نه در env. `/v1/*` نیز با JWT ایمن است.

### ADR-005: Providers as First-Class Entities + Real Streaming
- `AiProvider` entity با cascade به models
- Streaming واقعی با `stream:true` + SSE parsing
- زنجیره‌ی credential: `model.apiKey → provider.apiKey → env`
- Offline echo فقط وقتی هیچ credential‌ای نیست (با WARN)

### ADR-006: آواتار روی MinIO، تغییر credential با re-auth
- هیچ disk fallback: اگر MinIO کانفیگ نشده → 503 صادقانه
- تغییر email/password نیاز به current password دارد

### تصمیم: حذف provider toggle
`provider.isActive` دیگر کنترل کسب‌وکار نیست. تنها قاعده: مدل پیش‌فرض بدون جانشین غیرفعال نمی‌شود.

### تصمیم: جداسازی RBAC از Subscription
نقش (`admin`/`user`) → اختیارات مدیریتی  
پلن اشتراک → دسترسی به مدل‌ها و quota  
این دو لایه هرگز با هم تداخل ندارند.

### تصمیم: Soft Delete
تمام حذف‌ها soft هستند (`isDeleted=true`). رکوردها برای audit نگه داشته می‌شوند.

### تصمیم: ActiveStreamService
استریم مدل از lifecycle اتصال TCP کلاینت جدا است. رفرش صفحه تولید توکن را متوقف نمی‌کند.

---

## ۱۱. تست و Quality Gates

### بک‌اند

```bash
cd backend
npm run test        # 95+ unit/integration test (بدون DB/MinIO)
npm run test:e2e    # e2e tests
npm run lint        # ESLint
```

**فایل‌های تست (45+ فایل):**

| دسته | نمونه فایل‌ها |
|---|---|
| Auth | `auth.e2e.spec.ts`, `auth-edge-cases.spec.ts`, `auth-logout.spec.ts` |
| Chat | `chat.e2e.spec.ts`, `chat-share.spec.ts`, `chat-thinking-flow.spec.ts`, `chat-resume.spec.ts` |
| Models | `models-admin.spec.ts`, `model-access.spec.ts`, `models-capabilities.spec.ts` |
| Subscriptions | `subscriptions-and-payments.spec.ts`, `coupons-and-zarinpal.spec.ts` |
| Users | `profile.spec.ts`, `soft-delete.spec.ts`, `role-token-limits.spec.ts` |
| Admin | `admin-panel.spec.ts`, `admin-guard.spec.ts` |
| Performance | `chat-real-stream.spec.ts`, `token-tariffs.spec.ts` |
| Infra | `health.spec.ts`, `error-format.spec.ts`, `validation-fa.spec.ts` |

### فرانت‌اند

```bash
cd frontend
npm run test:unit   # Vitest + Vue Test Utils
npm run lint        # ESLint
npm run build       # بیلد production (type-check ضمنی)
```

**فایل‌های تست (نمونه):**
- `LoginView.spec.ts` — ورود/ثبت‌نام + inline error فارسی
- `ThemePerUser.spec.ts` — استقلال تم بین کاربران + پایداری با رفرش
- `services/api.spec.ts` — ترجمه‌ی خطاها، fallback، network error

### Quality Gates (Checklist بستن هر task)

**بک‌اند:**
- [ ] `npm run lint` بدون خطا
- [ ] `npm run test` و `npm run test:e2e` سبز
- [ ] اندپوینت‌های جدید مستند شده (Swagger یا README)
- [ ] `docs/wiki/features.md` به‌روز

**فرانت‌اند:**
- [ ] `npm run lint` بدون خطا
- [ ] `npm run build` بدون خطا
- [ ] `npm run test:unit` سبز
- [ ] بررسی دستی: فیچرهای قبلی (login، chat، admin) همچنان کار می‌کنند
- [ ] `docs/wiki/features.md` به‌روز

### Load Testing (k6)

```bash
# نصب k6 (macOS ARM)
curl -L -o /tmp/k6.zip https://github.com/grafana/k6/releases/download/v2.2.0/k6-v2.2.0-macos-arm64.zip
unzip /tmp/k6.zip -d /tmp/k6bin

# اجرا
BASE_URL=http://localhost:3000/api/v1 /tmp/k6bin/k6 run perf/k6/load-test.js
```

**Thresholds:**
- `p(95) < 1000ms` برای HTTP requests
- `http_req_failed < 5%`
- `conv_create_ms p(95) < 800ms`

**Ramp-up Scenario:** 0 → 20 VU (30s) → 50 VU (1m) → 100 VU (1m) → 0 (30s)



---

## ۱۲. Configuration و Deployment

### متغیرهای محیطی بک‌اند (.env)

| کلید | توضیح | مثال |
|---|---|---|
| `PORT` | پورت سرور | `3000` |
| `DB_HOST/PORT/USER/PASS/NAME` | اتصال PostgreSQL | `localhost/5432/postgres/postgres/chatbot` |
| `DB_SYNC` | auto-migrate در dev | `true` (production: `false`) |
| `JWT_SECRET` | کلید امضای JWT | یک رشته‌ی تصادفی قوی |
| `FRONTEND_URL` | CORS whitelist (ویرگول‌جدا) | `http://localhost:5173` |
| `OPENAI_API_KEY/BASE_URL` | fallback سراسری AI (اختیاری) | کلیدهای اصلی در DB هستند |
| `MINIO_*` | اتصال MinIO | `127.0.0.1:9000` |
| `PUBLIC_BASE_URL` | URL پایه‌ی backend برای آواتار | `http://localhost:3000` |
| `SERPER_API_KEY` | جستجوی وب | از serper.dev |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | تله‌متری SigNoz (اختیاری) | `http://localhost:4318` |

### متغیرهای محیطی فرانت‌اند (.env)

| کلید | توضیح |
|---|---|
| `VITE_API_BASE_URL` | آدرس API بک‌اند |
| `VITE_APP_TITLE` | عنوان اپ |

### راه‌اندازی محلی (گام به گام)

```bash
docker compose up -d          # PostgreSQL + MinIO + Redis

cd backend && npm install
npm run seed:admin             # اولین ادمین
npm run seed:subscriptions     # پلن‌های پیش‌فرض + اشتراک کاربران
npm run start:dev              # localhost:3000

cd ../frontend && npm install
npm run dev                    # localhost:5173
```

### Migration در Production

```bash
cd backend
DB_SYNC=false npm run migration:run
```

---

## ۱۳. مستندات

| فایل | محتوا |
|---|---|
| `docs/wiki/README.md` | نقشه‌ی wiki |
| `docs/wiki/getting-started.md` | راه‌اندازی محلی |
| `docs/wiki/architecture.md` | معماری کامل |
| `docs/wiki/features.md` | لیست تفصیلی تمام فیچرها (فارسی) |
| `docs/wiki/decisions.md` | ADR های معماری |
| `docs/wiki/chat-system.md` | سیستم چت و streaming |
| `docs/wiki/api-reference.md` | کاتالوگ اندپوینت‌ها |
| `docs/wiki/admin.md` | راهنمای پنل ادمین |
| `docs/wiki/frontend-guide.md` | راهنمای توسعه فرانت‌اند |
| `docs/wiki/backend-nestjs-guide.md` | راهنمای توسعه بک‌اند |
| `docs/wiki/signoz.md` | راه‌اندازی SigNoz APM |
| `docs/wiki/chat-resilience.md` | مستند resilient streaming |
| `api-contract.yaml` | قرارداد رسمی REST API (OpenAPI) |
| `CHANGELOG.md` | تاریخچه‌ی نسخه‌ها (semantic versioning) |
| `SIGNOZ_GUIDE.md` | راهنمای کامل فارسی SigNoz |
| `SYSTEM_AUDIT_AND_FIXES.md` | گزارش audit سیستم |

**قانون:** در پایان هر task، `docs/wiki/features.md` و در صورت تغییر معماری `architecture.md` و `getting-started.md` باید به‌روزرسانی شوند.

---

## ۱۴. Observability

### SigNoz APM (آماده، opt-in)

معماری: `backend/src/shared/telemetry.ts` با **OpenTelemetry OTLP HTTP** پیاده‌سازی شده.

**چه چیزی trace می‌شود:**
- پردازش فایل (`file.process` span): `file.id`، `file.type`، `file.size_bytes`، `process.duration_ms`، status
- قابل گسترش به تمام requestها

**Fail-safe:** اگر SigNoz خاموش باشد، سیستم قفل نمی‌شود — telemetry در background با error handling کامل اجرا می‌شود.

**راه‌اندازی SigNoz:**
```bash
git clone https://github.com/SigNoz/signoz.git
cd signoz/deploy && docker compose up -d
# Dashboard: http://localhost:3301
# OTLP endpoint: http://localhost:4318
```

**در پنل ادمین:** دکمه‌ی «داشبورد SigNoz» در بخش فایل‌ها → `http://localhost:3301`.

### Logging

- خطاهای 500 stack trace فقط در لاگ سرور ثبت می‌شوند، هرگز به کاربر نمی‌رسند.
- `AuditService` تمام رویدادهای مالی/مدیریتی را در `audit_logs` ثبت می‌کند.
- `WebSearchService` مصرف credit Serper را به‌صورت atomic در `system_settings` شمارش می‌کند.

### Health Check

```bash
GET /health   # (از global prefix مستثنی است)
```

---

## ۱۵. Git Workflow

### ساختار برنچ‌ها (بر اساس کدبیس)

```
main / master     ← production
develop           ← integration branch
feat/<name>       ← فیچر جدید (مثلاً feat/thinking-adaptors)
fix/<name>        ← bugfix
```

### قوانین

- **قانون طلایی:** فیچر جدید نباید فیچر قبلی را خراب کند.
- هر تغییر رفتار قبلی باید در commit message و `CHANGELOG.md` مستند شود.
- `CHANGELOG.md` با [Keep a Changelog](https://keepachangelog.com) فرمت‌بندی شده (Semantic Versioning).

### Commit Structure (بر اساس CHANGELOG)

تغییرات در سه دسته‌بندی: **Added** / **Changed** / **Fixed**

---

## ۱۶. قیمت‌گذاری و Business Model

### ساختار پلن‌ها

| پلن | قیمت | مدت | هدف |
|---|---|---|---|
| **Free** | 0 | نامحدود | کاربران جدید، مدل‌های عمومی |
| **Pro** | مشخص (IRR) | ماهانه/سالانه | مدل‌های تجاری، quota بالاتر |
| **Enterprise** | مشخص (IRR) | ماهانه/سالانه/مادام‌العمر | quota سفارشی، مدل‌های اختصاصی |

### مکانیزم‌های درآمدی

1. **اشتراک ماهانه/سالانه/مادام‌العمر** — پرداخت از طریق زرین‌پال
2. **کدهای تخفیف** — PERCENTAGE یا FIXED، با سقف مصرف و انقضا
3. **تخصیص دستی توسط ادمین** — بدون پرداخت (برای B2B)

### کنترل دسترسی به مدل‌ها

```
کاربر Free → فقط مدل‌های public + مدل پیش‌فرض پلن Free
کاربر Pro  → مدل‌های public + مدل‌های commercial اختصاص‌یافته به پلن
Admin      → همه‌ی مدل‌ها بدون استثنا
```

### سیستم Quota

| نوع | محدودیت |
|---|---|
| Token | tokenLimit → planQuota → globalLimit |
| Message | messageLimit per period (resetHours) |
| Period Reset | lazy — در اولین request بعد از پایان دوره |

### KPI های مالی (داشبورد ادمین)
- مجموع درآمد (تومان و ریال)
- تعداد تراکنش‌های موفق
- تفکیک اشتراک‌های فعال بر اساس پلن
- درصد رضایت کاربران (likes/dislikes)

---

## ۱۷. نکات مهم برای ارائه

### فنی

1. **Streaming Architecture** — SSE با async generator؛ ActiveStreamService اتصال را مستقل از TCP کلاینت نگه می‌دارد (رفرش صفحه = بدون قطع پاسخ).
2. **Zero-Conflict RBAC vs Subscription** — نقش و پلن کاملاً جدا هستند. admin bypass همه‌چیز را دارد.
3. **Pessimistic Lock در payment** — Double-credit غیرممکن است.
4. **Soft Delete همه جا** — هیچ رکوردی فیزیکی حذف نمی‌شود.
5. **Persian-first error messages** — هیچ خطای raw انگلیسی/stack trace به کاربر نمی‌رسد.
6. **DB-authoritative identity** — نقش از DB خوانده می‌شود نه از JWT قدیمی (تغییر نقش بدون logout کار می‌کند).
7. **OpenAI-Compatible** — هر مدل سازگار با OpenAI بدون تغییر کد پشتیبانی می‌شود.
8. **Fail-safe telemetry** — SigNoz خاموش باشد، سیستم قفل نمی‌شود.

### محصولی

1. **اولین پلتفرم فارسی multi-model AI** با UI کاملاً RTL و persian-native.
2. **تجربه‌ی streaming** مثل ChatGPT — token-by-token، thinking block، web search sources.
3. **Share گفتگو** با snapshot منجمد — بدون لاگین قابل دیدن است.
4. **تقویم شمسی بومی** (zero-dependency) برای مدیریت کوپن.
5. **پنل ادمین کامل** — همه‌چیز از UI قابل مدیریت است، بدون دسترسی به DB.
6. **Load test آماده** — k6 با threshold های مشخص برای CI.

---

## ۱۸. چک‌لیست ارائه

### فنی
- [ ] `docker compose up -d` — PostgreSQL، MinIO، Redis در حال اجرا
- [ ] `npm run start:dev` (backend) — در `localhost:3000` پاسخ می‌دهد
- [ ] `npm run dev` (frontend) — در `localhost:5173` بارگذاری می‌شود
- [ ] حداقل یک AI provider با API key واقعی در DB تنظیم شده
- [ ] `npm run test` در backend سبز است (95+ تست)
- [ ] `npm run test:unit` در frontend سبز است
- [ ] `npm run build` در frontend بدون خطا است

### دموی محصول
- [ ] ثبت‌نام کاربر جدید و ورود
- [ ] ارسال پیام و مشاهده‌ی streaming token-by-token
- [ ] فعال‌سازی Web Search و نمایش منابع
- [ ] فعال‌سازی Deep Thinking (اگر مدل پشتیبانی کند)
- [ ] آپلود فایل (PDF یا تصویر) و پرسیدن سوال
- [ ] Share گفتگو و باز کردن لینک در incognito
- [ ] تغییر تم (dark/light) — ذخیره بعد از رفرش
- [ ] صفحه‌ی اشتراک — مقایسه‌ی پلن‌ها
- [ ] خرید با کد تخفیف (sandbox)
- [ ] پنل ادمین: داشبورد، مدیریت مدل‌ها، کاربران
- [ ] تست اتصال مدل از پنل ادمین

### مستندات
- [ ] `docs/wiki/features.md` به‌روز است
- [ ] `CHANGELOG.md` آخرین نسخه را دارد
- [ ] `api-contract.yaml` با implementation همخوان است
