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
    │                                 (GET/PATCH /users/me, preferences, email/password change, avatar)
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
