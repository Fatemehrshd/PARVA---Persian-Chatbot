# API Architecture & Technical Reference

این سند راهنمای جامع و فنی معماری API پلتفرم **PARVA** است که بر اساس قرارداد استاندارد OpenAPI نسخه ۰.۵.۰ ([`api-contract.yaml`](../../api-contract.yaml)) تدوین شده است.

---

## ۱. اصول طراحی و زیرساخت API

### ۱.۱ ساختار پاکت پاسخ یکپارچه (Unified Response Envelope)
تمامی پاسخ‌های استاندارد JSON در سطح سرور از طریق `ResponseEnvelopeInterceptor` رهگیری شده و در یک فرمت استاندارد کپسوله‌سازی می‌شوند:

```json
{
  "success": true,
  "message": "Operation successful",
  "data": { ... }
}
```

- **`success` (boolean):** نشان‌دهنده وضعیت منطقی عملیات (`true` برای موفقیت، `false` برای خطا).
- **`message` (string):** پیام توصیفی سرور برای کاربر یا کلاینت.
- **`data` (any | null):** داده‌های اصلی برگردانده‌شده از کنترلرها. در صورت خالی بودن بدنه یا بروز خطا مقدار `null` قرار می‌گیرد.

> **نکته استثنا:** اندپوینت‌های سازگار با استاندارد رسمی OpenAI (واقع در مسیر `/v1/*`) و پاسخ‌های جریانی استریمینگ SSE (`text/event-stream`) از پاکت پاسخ مستثنی هستند تا ساختار استاندارد بین‌المللی حفظ گردد.

---

### ۱.۲ ساختار خطاها و استاتوس کدهای HTTP
در صورت بروز استثنا در سطح برنامه‌نویسی یا اعتبارسنجی ورودی‌ها، `HttpExceptionFilter` پاسخی استاندارد به کلاینت ارائه می‌دهد:

```json
{
  "success": false,
  "message": "Selected AI model is currently disabled",
  "error": "Bad Request",
  "statusCode": 400,
  "data": null
}
```

#### جدول وضعیت‌های رایج HTTP:
| کد وضعیت | عنوان | کاربرد |
|---|---|---|
| **200 OK** | عملیات موفق | بازگرداندن داده، ارسال پیام، تولید استریم یا توکن |
| **201 Created** | منبع ایجاد شد | ثبت‌نام کاربر جدید، ایجاد گفتگو یا ثبت مدل/ارائه‌دهنده جدید |
| **204 No Content** | موفقیت بدون بدنه | حذف موفق گفتگو یا مدل (`DELETE`) |
| **400 Bad Request** | خطای اعتبارسنجی | ناقص بودن فیلدهای الزامی، غیرفعال بودن مدل یا ارائه‌دهنده انتخابی |
| **401 Unauthorized** | عدم احراز هویت | عدم ارسال توکن یا انقضای زمان دسترسی |
| **403 Forbidden** | عدم دسترسی ادمین | دسترسی کاربر عادی به اندپوینت‌های مدیریتی (`/admin/*`) |
| **404 Not Found** | منبع یافت نشد | شناسه نامعتبر برای گفتگو، پیام، مدل یا ارائه‌دهنده |
| **409 Conflict** | تداخل داده | ایمیل قبلاً ثبت‌نام شده در سیستم |
| **502 Bad Gateway** | خطای بالادستی هوش مصنوعی | عدم دسترسی به ارائه‌دهنده هوش مصنوعی (قبل از شروع استریم) |

---

### ۱.۳ امنیت و احراز هویت (Authentication & Authorization)
- **مکانیزم احراز هویت:** توکن‌های مبتنی بر استانداردهای JWT (Access Token و Refresh Token).
- **ارسال توکن در هدر:** تمامی اندپوینت‌های محافظت‌شده نیازمند هدر زیر هستند:
  ```http
  Authorization: Bearer <access_token>
  ```
- **محافظ‌های احراز هویت (Guards):**
  - `JwtAuthGuard`: تایید امضا و اعتبار توکن کاربر و استخراج `req.user.sub`.
  - `AdminGuard`: بررسی فلگ `isAdmin === true` برای حفاظت از اندپوینت‌های مدیریتی.

---

## ۲. کاتالوگ جامع اندپوینت‌های سامانه

### ۲.۱ احراز هویت (Auth) — عمومی

#### ۲.۱.۱ ثبت‌نام کاربر جدید (`POST /auth/signup`)
- **دسترسی:** عمومی
- **درخواست (Request):**
  ```json
  {
    "email": "user@example.com",
    "password": "StrongPassword123",
    "displayName": "User Name"
  }
  ```
- **پاسخ (201 Created):**
  ```json
  {
    "success": true,
    "message": "Account created successfully",
    "data": {
      "user": {
        "id": "uuid-v4",
        "email": "user@example.com",
        "displayName": "User Name",
        "isAdmin": false,
        "createdAt": "2026-09-14T12:00:00.000Z"
      },
      "accessToken": "eyJhbGciOi..."
    }
  }
  ```
  رفرش‌توکن در پاسخ JSON برگردانده نمی‌شود و به‌صورت cookie با نام `refreshToken`، پرچم `HttpOnly` و عمر ۷ روزه تنظیم می‌شود.

#### ۲.۱.۲ ورود به سیستم (`POST /auth/login`)
- **دسترسی:** عمومی
- **درخواست (Request):**
  ```json
  {
    "email": "user@example.com",
    "password": "StrongPassword123"
  }
  ```
- **پاسخ (200 OK):** مشابه خروجی ثبت‌نام حاوی `user` و `accessToken`؛ cookie رفرش در header `Set-Cookie` چرخانده می‌شود.

#### ۲.۱.۳ خروج از سیستم (`POST /auth/logout`)
- **دسترسی:** نیازمند توکن کاربر (`Bearer`)
- **توضیح:** سشن و توکن رفرش cookie کاربر را در سرور نامعتبر می‌کند و cookie را پاک می‌کند.
- **پاسخ (200 OK):**
  ```json
  {
    "success": true,
    "message": "Logged out successfully",
    "data": null
  }
  ```

---

### ۲.۲ فهرست مدل‌های فعال کاربران (`GET /models`)
- **دسترسی:** نیازمند توکن کاربر (`Bearer`)
- **توضیح:** فهرست مدل‌هایی را برمی‌گرداند که هم خودشان فعال‌اند (`isActive: true`)، هم ارائه‌دهنده والد آن‌ها فعال است و هم **کاربر جاری به آن‌ها دسترسی دارد**: مدل‌های `public` برای همه، مدل‌های `commercial` فقط برای نقش‌های مجاز (تنظیم `model_access` در پنل ادمین) و مدل‌های `private` فقط برای کاربران وایت‌لیست‌شده؛ نقش `admin` همه مدل‌ها را می‌بیند.
- **پاسخ (200 OK):**
  ```json
  {
    "success": true,
    "message": "Active models retrieved",
    "data": {
      "models": [
        {
          "id": "model-uuid",
          "name": "GPT-4o Mini",
          "provider": "openai",
          "apiIdentifier": "gpt-4o-mini",
          "isActive": true,
          "isDefault": true,
          "accessLevel": "public",
          "allowedUserIds": [],
          "createdAt": "2026-09-14T10:00:00.000Z"
        }
      ]
    }
  }
  ```

- **مدل پیش‌فرض کاربر:** `GET /models/default` مدل پیش‌فرض سراسریِ قابل‌استفاده را (با کلید maskشده) برمی‌گرداند؛ اگر پیش‌فرض برای کاربر جاری مجاز نباشد، اولین مدل مجاز کاربر برگردد و اگر دیفالتی تنظیم نشده یا غیرفعال باشد 404 می‌دهد و کلاینت به منطق لیستی برمی‌گردد.
- **نقش ← دسترسی مدل:** `GET /admin/settings` اکنون نگاشت `modelAccess` (نقش → سطوح مجاز) را برمی‌گرداند؛ `PUT /admin/settings` فیلد `modelAccess` را (به‌صورت merge برای هر نقش؛ `null` یعنی بازگشت به پیش‌فرض) می‌پذیرد.
- **کنترل دسترسی در چت:** انتخاب مدل غیرمجاز در `POST /chat/conversations` یا `PATCH /chat/conversations/:id` (مسیر `modelId`) و تلاش برای تولید پاسخ با مدلی که دسترسی ندارید، با خطای ساختاریافته فارسی «به این مدل دسترسی ندارید» رد می‌شود؛ اگر گفتگوی قبلی به مدلی پین شده باشد که دسترسی‌اش را از دست داده‌اید، تولید با اولین مدل مجاز شما ادامه می‌یابد.

---

### ۲.۳ مدیریت گفتگوها و چت (Chat & Conversations)

#### ۲.۳.۱ ایجاد گفتگوی جدید (`POST /chat/conversations`)
- **دسترسی:** نیازمند توکن کاربر (`Bearer`)
- **درخواست (Request):**
  ```json
  {
    "title": "تحلیل هوش مصنوعی",
    "modelId": "model-uuid" // اختیاری؛ در صورت عدم ارسال مدل پیش‌فرض سامانه انتخاب می‌شود
  }
  ```
- **پاسخ (201 Created):**
  ```json
  {
    "success": true,
    "message": "Conversation created",
    "data": {
      "id": "conv-uuid",
      "userId": "user-uuid",
      "modelId": "model-uuid",
      "title": "تحلیل هوش مصنوعی",
      "createdAt": "2026-09-14T12:00:00.000Z",
      "updatedAt": "2026-09-14T12:00:00.000Z"
    }
  }
  ```

#### ۲.۳.۲ دریافت فهرست گفتگوهای کاربر (`GET /chat/conversations`)
- **دسترسی:** نیازمند توکن کاربر (`Bearer`)
- **پاسخ (200 OK):** آرایه‌ای از گفتگوهای کاربر، مرتب‌شده بر اساس آخرین زمان بروزرسانی (`updatedAt DESC`).

#### ۲.۳.۳ دریافت تاریخچه پیام‌های گفتگو (`GET /chat/conversations/:id/messages`)
- **دسترسی:** نیازمند توکن کاربر (`Bearer`)
- **پاسخ (200 OK):**
  ```json
  {
    "success": true,
    "message": "Messages retrieved",
    "data": {
      "messages": [
        {
          "id": "msg-1",
          "conversationId": "conv-uuid",
          "role": "user",
          "content": "سلام، چطور می‌توانی به من کمک کنی؟",
          "createdAt": "2026-09-14T12:01:00.000Z"
        },
        {
          "id": "msg-2",
          "conversationId": "conv-uuid",
          "role": "assistant",
          "content": "سلام! من دستیار هوشمند شما هستم...",
          "createdAt": "2026-09-14T12:01:02.000Z"
        }
      ]
    }
  }
  ```

#### ۲.۳.۴ تغییر مشخصات گفتگو یا تعویض مدل در میان مکالمه (`PATCH /chat/conversations/:id`)
- **دسترسی:** نیازمند توکن کاربر (`Bearer`)
- **درخواست (Request):** (حداقل یکی از دو فیلد الزامی است)
  ```json
  {
    "title": "عنوان جدید گفتگو",
    "modelId": "new-model-uuid"
  }
  ```
- **توضیح:** این متد امکان تغییر مدل پاسخ‌دهنده را در حین مکالمه جاری فراهم می‌سازد، بدون آنکه تاریخچه پیام‌های قبلی حذف یا مخدوش شوند.
- **پاسخ (200 OK):** اطلاعات بروزرسانی‌شده گفتگو.

#### ۲.۳.۵ حذف گفتگو (`DELETE /chat/conversations/:id`)
- **دسترسی:** نیازمند توکن کاربر (`Bearer`)
- **توضیح:** گفتگو و تمامی پیام‌های درون آن را به صورت آبشاری حذف می‌کند.
- **پاسخ (204 No Content):** بدون بدنه با استاتوس کد 204.

---

### ۲.۴ ارسال پیام و پروتکل استریمینگ (`POST /chat/conversations/:id/messages`)

این اندپوینت بر اساس هدر `Accept` درخواست، دو رفتار مجزا ارائه می‌دهد:

#### الف) حالت استریمینگ زنده (Server-Sent Events - پیش‌فرض فرانت‌اند):
- **هدرهای درخواست:**
  ```http
  Accept: text/event-stream
  Cache-Control: no-cache
  Authorization: Bearer <access_token>
  Content-Type: application/json
  ```
- **بدنه درخواست:**
  ```json
  {
    "content": "متن سوال کاربر",
    "fileIds": ["file-uuid-1"],
    "useWebSearch": true
  }
  ```
  (`fileIds` و `useWebSearch` اختیاری‌اند؛ `useWebSearch: true` فقط وقتی جستجو می‌کند که کلید سراسری ادمین هم روشن باشد.)
- **پروتکل پاسخ سرور (Event Stream Framing):**
  1. هر توکن کلمه با رویداد `event: token` ارسال می‌شود:
     ```http
     event: token
     data: {"content":"سلام"}

     event: token
     data: {"content":" کاربر"}
     ```
  2. پس از پایان استریم و ذخیره پیام در پایگاه داده، رویداد `event: done` شناسه پیام ذخیره‌شده را اعلام می‌کند:
     ```http
     event: done
     data: {"messageId":"msg-uuid-assistant"}
     ```
  3. اتصال بسته می‌شود.

- **رویدادهای جستجوی وب (فقط وقتی `useWebSearch: true` و کلید ادمین روشن):**
  ```http
  event: search-status
  data: {"state":"searching"}

  event: sources
  data: {"sources":[{"title":"...","url":"https://...","snippet":"..."}]}

  event: sources-error
  data: {"message":"جستجوی وب ناموفق بود؛ پاسخ بدون منابع ادامه می‌یابد"}
  ```
  منابع در ستون `sources` پیام دستیار ذخیره می‌شوند و در تاریخچه (`GET .../messages`) برمی‌گردند. هر سه رویداد در مسیر بازاتصال (`GET .../stream`) هم بازپخش می‌شوند.
- **تنظیم ادمین:** `PUT /admin/settings` با `{ "webSearchEnabled": true|false }` (پیش‌فرض روشن)؛ در `GET /admin/settings` خوانده می‌شود.
- **مدل پیش‌فرض کاربر:** `GET /models/default` مدل پیش‌فرض سراسریِ قابل‌استفاده را (با کلید maskشده) برمی‌گرداند؛ اگر پیش‌فرض برای کاربر جاری از نظر دسترسی مجاز نباشد، اولین مدل مجاز همان کاربر برگردد و اگر دیفالتی تنظیم نشده یا غیرفعال باشد 404 می‌دهد و کلاینت به منطق لیستی برمی‌گردد.

#### ب) حالت غیراستریمینگ (JSON Fallback):
- در صورت ارسال هدر `Accept: application/json`، سرور کل پاسخ هوش مصنوعی را در حافظه تجمیع کرده و پس از اتمام به شکل یک پاکت استاندارد JSON بازمی‌گرداند:
  ```json
  {
    "success": true,
    "message": "Operation successful",
    "data": {
      "id": "msg-uuid",
      "conversationId": "conv-uuid",
      "role": "assistant",
      "content": "پاسخ کامل دستیار...",
      "createdAt": "2026-09-14T12:01:05.000Z"
    }
  }
  ```

---

### ۲.۵ رابط سازگاری مستقیم OpenAI (`/v1/*`)
برای اتصال ابزارها و کلاینت‌های استاندارد اکوسیستم هوش مصنوعی (مثل LangChain، ابزارهای خط فرمان و ...) اندپوینت‌های استاندارد سازگار با مشخصات OpenAI پیاده‌سازی شده‌اند. به منظور حفظ امنیت و مدیریت مصرف، این اندپوینت‌ها نیازمند احراز هویت توکن Bearer هستند.

#### ۲.۵.۱ فهرست مدل‌های سازگار (`GET /v1/models`)
- **هدر:** `Authorization: Bearer <token>`
- **پاسخ (200 OK):**
  ```json
  {
    "object": "list",
    "data": [
      {
        "id": "gpt-4o",
        "object": "model",
        "created": 1726315200,
        "owned_by": "openai",
        "permission": [],
        "root": "gpt-4o",
        "parent": null
      }
    ]
  }
  ```

#### ۲.۵.۲ تکمیل مکالمه OpenAI (`POST /v1/chat/completions`)
- **هدرها:** `Authorization: Bearer <token>`, `Content-Type: application/json`
- **درخواست:**
  ```json
  {
    "model": "gpt-4o",
    "messages": [
      { "role": "user", "content": "Hello World" }
    ],
    "stream": true,
    "temperature": 0.7,
    "max_tokens": 1000
  }
  ```
- **پاسخ:** در صورت `stream: true` بسته‌های استاندارد SSE با `data: {"choices":[{"delta":{"content":"..."}}]}` و خاتمه با `data: [DONE]`.

---

### ۲.۶ مدیریت ادمین: مدل‌ها و ارائه‌دهنده‌ها (`/admin/*`)
تمامی این اندپوینت‌ها نیازمند نقش ادمین (`isAdmin: true`) هستند.

#### ۲.۶.۱ ارائه‌دهندگان هوش مصنوعی (Providers):
- `GET /admin/providers`: فهرست ارائه‌دهنده‌ها (با ماسک کردن کلیدها به شکل `sk-...last4`).
- `POST /admin/providers`: ثبت ارائه‌دهنده جدید (`name`, `provider`, `baseUrl`, `apiKey`).
- `PATCH /admin/providers/:id`: ویرایش نام، آدرس یا روتِیت کردن کلید امنیتی.
- `PATCH /admin/providers/:id/status`: فعال‌سازی / غیرفعال‌سازی ارائه‌دهنده (`{ "isActive": true/false }`).
- `PATCH /admin/providers/:id/default`: تعیین مدل پیش‌فرض ارائه‌دهنده.
- `DELETE /admin/providers/:id`: حذف آبشاری ارائه‌دهنده به همراه تمام مدل‌های زیرمجموعه آن.

#### ۲.۶.۲ مدل‌های هوش مصنوعی (Models):
- `GET /admin/models`: دریافت تمامی مدل‌ها به همراه اطلاعات ارائه‌دهنده.
- `POST /admin/models`: ایجاد مدل جدید با فیلدهای `name`, `provider`, `apiIdentifier`, و در صورت نیاز کلید و آدرس اختصاصی (`apiKey`, `baseUrl`).
- `PATCH /admin/models/:id`: ویرایش اطلاعات مدل (شامل `accessLevel` و `allowedUserIds`).
- `PATCH /admin/models/:id/status`: تغییر وضعیت فعال/غیرفعال بودن مدل.
- `DELETE /admin/models/:id`: حذف نرم مدل از سامانه (رکورد برای تاریخچه حفظ می‌شود).

