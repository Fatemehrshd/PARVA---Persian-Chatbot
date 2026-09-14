# Architecture Overview

پلتفرم **CODELESS / NeuralChat** یک سامانه تمام‌عیار هوش مصنوعی چندمدلی (Multi-Model AI Chat Platform) بر پایه معماری Monorepo و سرویس‌های مستقل فرانت‌اند و بک‌اند است.

---

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
├── main.ts                        ← بوت‌استرپ: ResponseEnvelopeInterceptor + HttpExceptionFilter + ValidationPipe + CORS
├── app.module.ts                  ← پیکربندی TypeORM و رجیستری ماژول‌ها
├── shared/                        ← لایه مشترک:
│   ├── jwt-auth.guard.ts          ← بررسی اعتبار توکن JWT کاربر
│   ├── admin.guard.ts             ← گیت دسترسی نقش ادمین
│   ├── http-exception.filter.ts   ← کپسوله‌سازی و استانداردسازی خطاهای سرور
│   └── response-envelope.interceptor.ts ← بسته‌بندی پاسخ‌ها در پاکت { success, message, data }
└── modules/
    ├── auth/                      ← احراز هویت: ثبت‌نام، ورود، خروج، صدور و ابطال توکن‌ها
    ├── users/                     ← موجودیت User، هش کلمات عبور و مدیریت کاربران
    ├── chat/                      ← سامانه گفتگو:
    │   ├── chat.controller.ts     ← کنترلر گفتگوها و استریمینگ توکن‌ها (SSE / JSON)
    │   ├── chat.service.ts        ← منطق ذخیره‌سازی، تاریخچه ۲۰ پیام و اتصال به فورواردر
    │   ├── conversation.entity.ts ← موجودیت گفتگو (id, userId, modelId, title)
    │   ├── message.entity.ts      ← موجودیت پیام (id, conversationId, role, content)
    │   └── openai-compat.controller.ts ← رابط سازگار با OpenAI (/v1/models, /v1/chat/completions)
    ├── ai/                        ← لایه ارسال هوش مصنوعی:
    │   └── openai-compat.forwarder.ts ← استریم زنده از طریق fetch نیتیو و پارسر بافر SSE
    └── models-admin/              ← مدیریت مدل‌ها و ارائه‌دهندگان:
        ├── ai-model.entity.ts     ← موجودیت مدل هوش مصنوعی
        ├── ai-provider.entity.ts  ← موجودیت ارائه‌دهنده سرویس
        ├── models-admin.service.ts← سرویس عملیات CRUD و تعیین مدل پیش‌فرض
        ├── providers-admin.service.ts ← سرویس ارائه‌دهنده‌ها و حذف آبشاری
        ├── models.controller.ts   ← اندپوینت عمومی لیست مدل‌های فعال برای کاربران (GET /models)
        └── admin-*.controller.ts  ← کنترلرهای مدیریتی پنل ادمین
```

---

## ۴. معماری لایه‌های فرانت‌اند (Vue 3)

```
frontend/src/
├── services/                      ← لایه ارتباط با API:
│   ├── api.ts                     ← کلاینت پایه HTTP (تزریق خودکار توکن، بازکردن پاکت دیتا، مدیریت ۴۰۱)
│   ├── auth.service.ts            ← سرویس احراز هویت
│   ├── chat.service.ts            ← سرویس چت، تاریخچه و ریدر استریم زنده (SSE)
│   └── models.service.ts          ← سرویس مدل‌ها و ارائه‌دهنده‌ها
├── stores/                        ← لایه استیت (Pinia):
│   ├── auth.ts                    ← وضعیت کاربر لاگین‌شده و دسترسی ادمین
│   ├── chat.ts                    ← مدیریت گفتگوها، استریم پیام، تعویض مدل و خطایابی
│   ├── models.ts                  ← فهرست مدل‌های سامانه و مدل منتخب
│   └── ui.ts                      ← تم (تاریک/روشن)، جهت صفحه (RTL/LTR) و تست‌ها (Toasts)
├── components/                    ← کامپوننت‌های چت، لی‌اوت، ادمین و دیالوگ‌ها
├── utils/
│   └── textDirection.ts           ← تابع نیتیو تشخیص زبان متن (RTL برای فارسی، LTR برای انگلیسی)
└── views/                         ← صفحات اصلی:
    ├── ChatView.vue               ← نمای اصلی چت با روتینگ /chat/:id
    ├── LoginView.vue              ← صفحه ورود و ثبت‌نام
    └── AdminModelsView.vue        ← پنل داشبورد مدیریت مدل‌ها و ارائه‌دهندگان
```

---

## ۵. مدل داده و ارتباطات پایگاه داده (Data Models)

- **`User` (کاربران):**
  - فیلدها: `id`, `email`, `password` (هش‌شده با bcrypt), `displayName`, `isAdmin`, `createdAt`.
  - روابط: یک کاربر می‌تواند چندین `Conversation` داشته باشد.
- **`Conversation` (گفتگوها):**
  - فیلدها: `id`, `userId`, `modelId`, `title`, `createdAt`, `updatedAt`.
  - روابط: متعلق به یک `User`؛ شامل چندین `Message`.
- **`Message` (پیام‌ها):**
  - فیلدها: `id`, `conversationId`, `role` (`user` | `assistant`), `content`, `createdAt`.
  - روابط: متعلق به یک `Conversation` با حذف آبشاری هنگام حذف گفتگو.
- **`AiProvider` (ارائه‌دهندگان هوش مصنوعی):**
  - فیلدها: `id`, `name`, `provider` (مثل openai, anthropic, google, custom), `baseUrl`, `apiKey` (ماسک‌شده در خروجی), `isActive`, `createdAt`.
- **`AiModel` (مدل‌های هوش مصنوعی):**
  - فیلدها: `id`, `providerId`, `name`, `provider`, `apiIdentifier`, `apiKey` (اختیاری), `baseUrl` (اختیاری), `isActive`, `isDefault`, `createdAt`.
