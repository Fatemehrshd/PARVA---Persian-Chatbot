# جزئیات معماری لایه سرویس‌های API فرانت‌اند

این سند نحوه ارتباط دقیق هر سرویس در پوشه `frontend/src/services/` با اندپوینت‌های قرارداد OpenAPI ([`api-contract.yaml`](../../api-contract.yaml)) و کنترلرهای بک‌اند را تشریح می‌کند.

---

## ۱. کلاینت پایه HTTP (`src/services/api.ts`)

کلاینت پایه با هدف جلوگیری از تکرار کدهای شبکه و یکپارچه‌سازی مدیریت توکن و خطا ایجاد شده است:

- **تزریق خودکار توکن JWT:** توکن احراز هویت مستقیماً از `localStorage.getItem('token')` خوانده شده و با فرمت استاندارد `Bearer <token>` به هدر اضافه می‌شود.
- **پردازش انولوپ استاندارد پاسخ:** طبق قرارداد نسخه 0.2.0 تمامی پاسخ‌های سرور درون یک پاکت استاندارد برگردانده می‌شوند:
  ```json
  {
    "success": true,
    "message": "Operation successful",
    "data": { ... }
  }
  ```
  کلاینت `request<T>` به‌صورت خودکار و شفاف مقدار فیلد `data` را بازگشایی (Unwrap) کرده و به عنوان نتیجه بازمی‌گرداند؛ در نتیجه استورها و کامپوننت‌های فرانت‌اند بدون نیاز به تغییر یا وابستگی به ساختار ترنسپورت به داده خالص دسترسی دارند.
- **تبدیل پاکت خطای OpenAPI:** خطاهای سرور نیز با ساختار `{ success: false, message, data: null, statusCode, error }` دریافت شده و در کلاس `ApiError` کپسوله‌سازی می‌شوند.
- **توابع کمکی:**
  - `buildUrl(endpoint)`: الحاق امن مسیر با آدرس سرور بدون تولید اسلش اضافه.
  - `getApiBaseUrl()`: بازیابی آدرس پایه فعال از متغیرهای محیطی.

---

## ۲. سرویس احراز هویت (`auth.service.ts`)

این سرویس اندپوینت‌های تگ `Auth` را پوشش می‌دهد:

### متدها:
1. `signup(email, password, displayName?)`:
   - **مسیر:** `POST /auth/signup`
   - **بدنه ارسالی:** `{ email, password, displayName }`
   - **پاسخ موفق:** `201 Created` شامل `{ user, accessToken, refreshToken }`
   - **پاسخ خطا:** `400 Validation Error`، `409 Conflict (ایمیل تکراری)`

2. `login(email, password)`:
   - **مسیر:** `POST /auth/login`
   - **بدنه ارسالی:** `{ email, password }`
   - **پاسخ موفق:** `200 OK` شامل `{ user, accessToken, refreshToken }`
   - **پاسخ خطا:** `401 Unauthorized (ایمیل یا رمز عبور اشتباه)`

3. `logout(refreshToken?)`:
   - **مسیر:** `POST /auth/logout`
   - **بدنه ارسالی:** `{ refreshToken }`
   - **پاسخ موفق:** `204 No Content`

---

## ۳. سرویس چت و استریم زنده (`chat.service.ts`)

این سرویس وظیفه تبادل پیام با مدل‌های هوش مصنوعی و مصرف جریان داده SSE را بر عهده دارد:

### متدها:
1. `listConversations()`:
   - **مسیر:** `GET /chat/conversations`
   - **پاسخ:** آرایه‌ای از گفتگوها (`Conversation[]`)

2. `createConversation(modelId?, title?)`:
   - **مسیر:** `POST /chat/conversations`
   - **بدنه ارسالی:** `{ modelId, title }`
   - **پاسخ:** گفتگوی ایجاد شده (`Conversation`)

3. `getMessages(conversationId)`:
   - **مسیر:** `GET /chat/conversations/{conversationId}/messages`
   - **پاسخ:** تاریخچه پیام‌های گفتگو به ترتیب زمان (`Message[]`)

4. `sendMessageStream(conversationId, content, onToken, onDone, onError)`:
   - **مسیر:** `POST /chat/conversations/{conversationId}/messages`
   - **هدر:** `Accept: text/event-stream`
   - **پروتکل ارتباطی:**
     - کلاینت از طریق API بومی `ReadableStream` و `TextDecoder` چانک‌های داده را می‌خواند.
     - رویدادهای `event: token` بلافاصله محتوای متن تولیدشده (`{"content": "..."}`) را به کال‌بک `onToken` ارسال می‌کنند تا کاربر به صورت کلمه‌به‌کلمه و بدون تأخیر پاسخ هوش مصنوعی را در صفحه مشاهده کند.
     - رویداد `event: done` شناسه پیام ذخیره‌شده را به کال‌بک `onDone` تحویل می‌دهد تا استریم با موفقیت خاتمه یابد.

5. `sendMessage(conversationId, content)`:
   - **مسیر:** `POST /chat/conversations/{conversationId}/messages`
   - **هدر:** `Accept: application/json`
   - **پاسخ:** دریافت یک‌باره کل پیام پاسخ در قالب JSON (`Message`)

---

## ۴. سرویس مدیریت مدل‌ها (`models.service.ts`)

این سرویس دسترسی پنل ادمین به مدل‌های زبانی هوش مصنوعی را پیاده‌سازی می‌کند:

### متدها:
1. `listModels()`:
   - **مسیر:** `GET /admin/models`
   - **پاسخ:** لیست تمامی مدل‌های پیکربندی شده در سامانه (`Model[]`)

2. `createModel(data)`:
   - **مسیر:** `POST /admin/models`
   - **بدنه ارسالی:** `{ name, provider, apiIdentifier, isActive }`
   - **پاسخ:** مدل ذخیره‌شده (`Model`)

3. `deleteModel(modelId)`:
   - **مسیر:** `DELETE /admin/models/{modelId}`
   - **پاسخ:** `204 No Content`

4. `setDefaultModel(modelId)`:
   - **مسیر:** `PATCH /admin/models/{modelId}/default`
   - **پاسخ:** مدل بروزرسانی‌شده به عنوان پیش‌فرض پلتفرم (`Model`)

---

## ۵. مقایسه لایه سرویس در برابر لایه استور

| ویژگی | لایه سرویس (`services/`) | لایه استور (`stores/`) |
|---|---|---|
| **مسئولیت** | ارتباط مستقیم با شبکه و درخواست‌های HTTP | نگهداری استیت واکنشی، منطق بیزینس و محاسبات |
| **وابستگی به فریم‌ورک** | کاملاً مستقل (توابع تایپ‌اسکریپت خالص) | وابسته به Pinia و ری‌اکتیویتی Vue 3 |
| **تست‌پذیری** | تست آسان با موک کردن `fetch` | تست با Mount کردن Pinia و شبیه‌سازی اکشن‌ها |
| **مدیریت کش و فال‌بک** | ندارد (ورودی به خروجی خالص) | داده‌ها را در حافظه کش کرده و در صورت قطعی آفلاین عمل می‌کند |

