# Architecture Overview

پلتفرم **CODELESS / NeuralChat** یک سامانه تمام‌عیار هوش مصنوعی چندمدلی (Multi-Model AI Chat Platform) بر پایه معماری Monorepo و سرویس‌های مستقل فرانت‌اند و بک‌اند است.

## Environment Variables
- **Frontend**: Vite-based variables prefixed with `VITE_` (e.g. `VITE_API_BASE_URL`). Types declared in `src/env.d.ts`.
- **Backend**: Loaded via `dotenv` from `.env` (e.g. `PORT`, `FRONTEND_URL`). CORS is configured in `main.ts` to allow requests from `FRONTEND_URL`.
- **AI credentials**: provider API keys live in the DATABASE (`ai_providers.apiKey`, managed via `/admin/providers`, masked on read). `OPENAI_API_KEY` / `OPENAI_BASE_URL` in env are only an optional global fallback for providers/models without stored credentials; with no key anywhere chat answers with the offline echo (WARN in logs).
- **Object storage (avatars)**: MinIO via `MINIO_*` env + `PUBLIC_BASE_URL`. Unconfigured MinIO makes avatar endpoints return 503; there is no disk fallback.

## ۱. ساختار مونو‌ریپو (Monorepo Layout)

- **`frontend/`**: اپلیکیشن مدرن SPA مبتنی بر Vue 3 + Vite + TypeScript + Pinia + Tailwind CSS + shadcn-vue.
- **`backend/`**: سرویس قدرتمند بک‌اند مبتنی بر NestJS + Express + TypeScript + PostgreSQL + TypeORM.
- **`docs/wiki/`**: مستندات فنی و راهنمای کامل توسعه و نگهداری سیستم.
- هر یک از دو پروژه فرانت‌اند و بک‌اند کاملاً مستقل هستند، وابستگی‌ها (`package.json`) و اسکریپت‌های تست و بیلد اختصاصی خود را دارند و تنها از طریق **قرارداد رسمی API** به یکدیگر متصل می‌شوند.

---

## ۲. مستندات تخصصی سیستم در ویکی

برای اطلاعات تفصیلی هر بخش، مستندات اختصاصی زیر را مطالعه کنید:
- 📖 [**راهنمای جامع API و پروتکل‌ها**](api-reference.md): ساختار پاکت پاسخ یکپارچه، سیستم احراز هویت JWT، کاتالوگ کامل اندپوینت‌ها و رابط سازگاری OpenAI.
- 💬 [**سیستم چت و استریمینگ**](chat-system.md): چرخه ارسال و دریافت پیام، پروتکل SSE، موتور ارسال به بالادست (Forwarder)، تغییر زنده مدل مکالمه و موتور دوطرفه زبان (BiDi).
- 🚀 [**شروع کار و راه‌اندازی محلی**](getting-started.md): متغیرهای محیطی، راه‌اندازی دیتابیس و اجرای سرویس‌ها.
- 📜 [**تاریخچه ویژگی‌ها**](features.md): لیست تفصیلی تمامی فازها و قابلیت‌های پیاده‌سازی‌شده.
- 🏛️ [**تصمیمات معماری (ADRs)**](decisions.md): چرایی و دلایل فنی تصمیمات اتخاذ شده در پروژه.

---

## ۳. معماری ماژول‌های بک‌اند (NestJS)

```
backend/src/
├── main.ts                        ← bootstrap: envelope interceptor + error filter + validation pipe
├── data-source.ts                 ← TypeORM CLI DataSource (migration:run/generate/revert)
├── migrations/                    ← production schema path (dev uses DB_SYNC)
├── app.module.ts                  ← TypeORM wiring (User, Conversation, Message, AiModel, AiProvider)
├── shared/                        ← JwtAuthGuard, AdminGuard, HttpExceptionFilter, ResponseEnvelopeInterceptor, FA messages
└── modules/
    ├── auth/                      ← signup/login/logout
    ├── users/                     ← User entity + UsersService + ProfileService/Controller
    │                                 (GET/PATCH /users/me, email/password change, avatar)
    ├── storage/                   ← StorageService: MinIO put/get/remove (global module)
    ├── chat/                      ← Conversation, Message, ChatService.generate (streaming),
    │                                 ChatController (SSE + JSON), OpenAiCompatController (/v1/*, JWT-protected)
    ├── ai/                        ← OpenAiCompatForwarder: credential resolution + SSE parsing via global fetch
    └── models-admin/              ← AiModel + AiProvider entities, ModelsAdminService,
                                      ProvidersAdminService (CRUD/status/default/cascade), admin controllers,
                                      and the public ModelsController (GET /models, active only)
```

### Chat resolution chain
`conversation.modelId → user default (preferences.defaultModelId) → platform default` (400 if the resolved model is inactive or its provider is inactive) → credential chain `model.apiKey → provider.apiKey → env` → real OpenAI-compatible streaming; echo fallback only when nothing is configured. Mid-conversation switching: `PATCH /chat/conversations/:id { modelId }`.

---

## ۴. معماری استریمینگ ادامه‌پذیر و مقاوم در برابر رفرش (Resilient Streaming)

### الف) جداسازی چرخه حیات استریم از سوکت کلاینت (`ActiveStreamService`):
- در معماری استاندارد قبلی، با رفرش صفحه یا بستن تب، رویداد `req.on('close')` فراخوانی شده و استریم مدل هوش مصنوعی در سرور بالادست متوقف می‌شد.
- برای رفع این مشکل، `ActiveStreamService` در بک‌ند نشست‌های تولید پاسخ فعال را در لایه حافظه و مستقل از کلاینت نگهداری می‌کند (`ActiveStreamSession`).
- زمانی که اتصال کلاینت به دلیل رفرش مرورگر، قطعی موقت اینترنت یا سوییچ بین گفتگوها قطع می‌شود، تولید توکن‌ها توسط مدل در پس‌زمینه ادامه می‌یابد و توکن‌ها در بافر `accumulatedText` ذخیره می‌شوند.

### ب) چرخه بازاتصال کلاینت (Client Reconnection Lifecycle):
1. **تشخیص در رفرش:** هنگام لود مجدد صفحه یا ورود به گفتگو (`selectConversation`)، فرانت‌اند وضعیت استریم را از طریق `GET /chat/conversations/:id/active-stream` استعلام می‌کند.
2. **انتقال به وضعیت استریمینگ فعال:** در صورت فعال بودن تولید، وضعیت بلافاصله به `isStreaming = true` تغییر یافته و متن تولید شده تا آن لحظه در بالون پیام نمایش داده می‌شود (همراه با انیمیشن تایپینگ و لودینگ بدون پرش و ناپدید شدن).
3. **دریافت توکن‌های زنده:** کلاینت از طریق اندپوینت بازاتصال `GET /chat/conversations/:id/stream` به صورت SSE متصل شده، رویداد `event: sync` (همگام‌سازی متن) را دریافت کرده و بقیه توکن‌ها را به شکل زنده تا رویداد `event: done` دریافت می‌کند.
4. **ادامه پیام‌های منقطع (`resumeMessage`):** در صورت قطع ارتباط کامل بالادست، متد `POST /chat/conversations/:id/messages/:messageId/resume` پرامپت اختصاصی ادامه پاسخ را به مدل ارسال کرده و پاسخ را از دقیقاً همان کلمه قطع شده ادامه می‌دهد (`isInterrupted = false`).

### ج) نام‌گذاری هوشمند خودکار گفتگوها (AI Auto-Title Generation):
- در پیام اول یک گفتگوی جدید، یک درخواست سبک و موازی (`OpenAiCompatForwarder.complete`) بدون ایجاد تاخیر در استریم اصلی اجرا می‌شود.
- هوش مصنوعی عنوانی موجز (۳ الی ۵ کلمه) به زبان پیام تولید می‌کند.
- عنوان بلافاصله در دیتابیس ذخیره شده و از طریق رویداد استریم `event: title` به کلاینت مخابره می‌شود تا سایدبار بدون نیاز به رفرش آپدیت شود.

---

## ۵. معماری چیدمان چت (ChatGPT-Style) و موتور رندرینگ مارک‌داون (`MarkdownContent`)

### الف) ساختار چیدمان نوبت‌محور چت (Linear Turn-Based Hierarchy):
- کانتینر مرکزی گفتگو با عرض استاندارد مطالعه (`max-w-3xl lg:max-w-4xl`) و فاصله مناسب (`py-6 px-4 md:px-8`) پیاده‌سازی شده است.
- در هر نوبت گفت‌وگو (Turn):
  1. **پیام کاربر:** در بالای نوبت با آواتار کاربر، نام کاربر، برچسب زمان، و یک کادر متنی چشم‌نواز (`bubble-user`) نمایش می‌یابد.
  2. **پیام دستیار هوش مصنوعی:** بلافاصله و **دقیقاً زیر پیام کاربر** به صورت تمام‌عرض باز شده و محتوای غنی پاسخ را بدون محدودیت‌های حبابی تنگ یا شکست‌های نامناسب نمایش می‌دهد.
  3. **حالت استریم زنده:** پیام در حال تولید هوش مصنوعی مستقیماً زیر آخرین پیام کاربر قرار گرفته و کلمات ورودی را به همراه کرسر تایپینگ چشمک‌زن و انیمیشن روان به صورت زنده رندر می‌کند.

### ب) خط لوله پردازش مارک‌داون (Markdown Processing Pipeline):
- کامپوننت اختصاصی `MarkdownContent.vue` با کتابخانه `marked` پیکربندی شده است:
  - **بلوک‌های کد پیشرفته:**
    - برچسب زبان در هدر بلوک با فونت مونو و حروف بزرگ (`TYPESCRIPT`, `PYTHON`, `SQL`).
    - دکمه تعاملی کپی کد با انیمیشن و بازخورد «کپی شد ✓».
    - جهت‌گیری اکیداً چپ‌به‌راست (`dir="ltr"`) با فونت `JetBrains Mono` و اسکرول افقی خودکار خطوط بلند.
  - **جداول ریسپانسیو (GFM Tables):**
    - کپسوله‌سازی جدول درون کانتینر `table-responsive` با اسکرول افقی روی دستگاه‌های موبایل تا جدول باعث به‌هم‌ریختگی عرض چت نشود.
    - هدرهای متمایز، ردیف‌های متناوب زبرا و بوردرهای هماهنگ با دیزاین سیستم.
  - **المان‌های استاندارد مستندسازی (README / Typography):**
    - تیترهای `h1` تا `h6` با وزن و فواصل استاندارد.
    - لیست‌های نامرتب (`ul`) و مرتب (`ol`) با تورفتگی منظم.
    - کوت‌های تاکیدی (`blockquote`) با حاشیه رنگی اصلی (Primary accent).
    - کدهای درون‌خطی (`code.inline-code`) به صورت کپسول‌های مشخص.
    - پیوندهای امن با `target="_blank" rel="noopener noreferrer"`.
  - **پشتیبانی دوجهته هوشمند (BiDi Handling):**
    - پاراگراف‌های فارسی بر اساس `getTextDirection` به صورت راست‌به‌چپ (RTL) رندر می‌شوند در حالی که جداول و کدها LTR باقی می‌مانند.
  - **مدیریت استریم ناقص:**
    - در حالت `streaming: true`، در صورتی که یک بلوک کد سه بک‌تیک در حال دریافت باشد و هنوز بسته نشده باشد، سیستم به صورت موقت آن را بسته تلقی می‌کند تا کاربر فرمت تمیز کد را از همان ابتدای تولید مشاهده کند.

