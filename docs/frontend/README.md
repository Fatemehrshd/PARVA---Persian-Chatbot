# Frontend Architecture & Documentation

این بخش از مستندات، ساختار لایه‌بندی فرانت‌اند، ارتباط آن با بک‌اند بر اساس قرارداد OpenAPI ([`api-contract.yaml`](../../api-contract.yaml)) و تفکیک لایه‌های منطق و سرویس‌های API را تشریح می‌کند.

---

## ۱. ساختار معماری و تفکیک لایه‌ها (Separation of Concerns)

کد فرانت‌اند به صورت ماژولار و در ۴ لایه کاملاً مجزا تفکیک شده است:

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. لایه نمایش (Presentation Layer)                             │
│    - src/views/ (LoginView, ChatView, AdminModelsView)          │
│    - src/components/ (ChatComposer, MessageList, AppSidebar...) │
└───────────────────────────────┬─────────────────────────────────┘
                                │ (اکشن‌ها و وضعیت واکنشی)
┌───────────────────────────────▼─────────────────────────────────┐
│ 2. لایه منطق بیزینس و استیت (Business Logic & State Layer)      │
│    - src/stores/ (useAuthStore, useChatStore, useModelsStore)   │
│    - src/composables/ (useAsyncAction, useLoadingState)         │
└───────────────────────────────┬─────────────────────────────────┘
                                │ (فراخوانی توابع تایپ‌شده سرویس‌ها)
┌───────────────────────────────▼─────────────────────────────────┐
│ 3. لایه سرویس‌های اختصاصی دامنه (Domain API Services)            │
│    - authService (ورود، ثبت‌نام، خروج)                           │
│    - chatService (لیست گفتگوها، تاریخچه پیام‌ها، استریم زنده)    │
│    - modelsService (مدیریت مدل‌های هوش مصنوعی، انتخاب پیش‌فرض)   │
└───────────────────────────────┬─────────────────────────────────┘
                                │ (ارسال درخواست Fetch و مدیریت هدر)
┌───────────────────────────────▼─────────────────────────────────┐
│ 4. لایه کلاینت پایه HTTP (Base HTTP Client)                     │
│    - src/services/api.ts (URL Builder, JWT Bearer, Error Handler)│
└───────────────────────────────┬─────────────────────────────────┘
                                │ REST & SSE Stream
                                ▼
                     Backend Service (NestJS)
```

---

## ۲. لایه سرویس‌های API (`src/services/`)

هر گروه از اندپوینت‌های تعریف‌شده در `api-contract.yaml` دارای یک فایل سرویس اختصاصی و مستقل است:

| سرویس | مسیر فایل | تگ متناظر در OpenAPI | وظایف |
|---|---|---|---|
| **Base API** | [`src/services/api.ts`](../../frontend/src/services/api.ts) | Security / Error | تزریق خودکار توکن JWT، بیلد کردن URL، تبدیل خطاهای سرور به کلاس `ApiError` |
| **Auth Service** | [`src/services/auth.service.ts`](../../frontend/src/services/auth.service.ts) | `Auth` | ثبت‌نام کاربر جدید، ورود به حساب و ابطال سشن (خروج) |
| **Chat Service** | [`src/services/chat.service.ts`](../../frontend/src/services/chat.service.ts) | `Chat` | مدیریت گفتگوها، دریافت پیام‌ها و مصرف استریم زنده توکن‌ها (SSE) |
| **Models Service** | [`src/services/models.service.ts`](../../frontend/src/services/models.service.ts) | `Admin - Models` | دریافت لیست مدل‌ها، افزودن مدل، حذف مدل و انتخاب مدل پیش‌فرض |

جزئیات کامل امضای متدها و نمونه کدها در فایل [services-architecture.md](./services-architecture.md) شرح داده شده است.

---

## ۳. نحوه اتصال به بک‌اند (Configuration & Environment)

آدرس پایه سرور هرگز در کدهای فرانت‌اند هاردکد نمی‌شود و از متغیر محیطی `VITE_API_BASE_URL` خوانده می‌شود:

```env
# frontend/.env
VITE_APP_TITLE=NeuralChat
VITE_API_BASE_URL=http://localhost:3000/api/v1
```

### نحوه عملکرد کلاینت پایه (`api.ts`):
1. **تشخیص خودکار آدرس پایه:** تابع `buildUrl(endpoint)` آدرس پایه را از `VITE_API_BASE_URL` خوانده و اسلش‌های ابتدا و انتها را نرمال‌سازی می‌کند.
2. **احراز هویت خودکار (Bearer Token):** در صورت وجود `token` در `localStorage`، هدر `Authorization: Bearer <token>` به طور خودکار به تمام درخواست‌ها اضافه می‌شود.
3. **پشتیبانی از پاسخ‌های خالی (204 No Content):** در درخواست‌هایی مانند حذف مدل یا لاگ‌اوت که بدنه ندارند، بدون خطای JSON Parse مقدار موفق برگردانده می‌شود.
4. **استانداردسازی خطاها:** در صورت بروز خطا (مانند ۴۰۱، ۴۰۴ یا ۴۰۹)، خطای سرور به صورت شیء تایپ‌شده `ApiError` حاوی `statusCode`، `message` و `error` پرتاب می‌شود.

---

## ۴. لایه استیت و مدیریت داده (Pinia Stores)

- **`useAuthStore`:** وضعیت کاربر فعال (`user`)، توکن‌ها (`token`, `refreshToken`)، دسترسی ادمین (`isAdmin`) و وضعیت لاگین بودن را نگهداری کرده و با `authService` همگام می‌ماند.
- **`useChatStore`:** گفتگوها و پیام‌ها را نگهداری کرده و در زمان ارسال پیام با استفاده از `chatService.sendMessageStream` پاسخ هوش مصنوعی را توکن‌به‌توکن و بدون وقفه نمایش می‌دهد.
- **`useModelsStore`:** فهرست مدل‌های هوش مصنوعی را از `modelsService` دریافت کرده و مدل پیش‌فرض سامانه و مدل انتخابی کاربر را مدیریت می‌کند.

---

## ۵. اجرای آزمون‌ها (Testing)

تمامی لایه‌ها دارای تست‌های واحد و رفتاری با Vitest هستند:
```bash
# اجرای تست‌های فرانت‌اند (شامل تست‌های سرویس‌ها، استورها و کامپوننت‌ها)
npm run test:unit
```
نتایج: **۳۸ تست از ۳۸ تست سبز (۱۰ فایل تست)**.

