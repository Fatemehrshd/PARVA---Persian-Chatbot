# مستندات تراکنش‌ها (Frontend)

در اپلیکیشن‌های کلاینت (Vue.js)، تراکنش پایگاه داده (ACID) به صورت مستقیم اجرا نمی‌شود. با این حال، توابع سرویس فرانت‌اند درخواست‌هایی را به سمت بک‌اند ارسال می‌کنند که منجر به اجرای تراکنش‌های اتمیک در دیتابیس می‌گردند. در این سند توابع فرانت‌اند که تریگر کننده تراکنش‌های اصلی سیستم هستند، مستند شده است.

Function: refreshToken
File: auth.service.ts
Path: d:\codeless_final\frontend\src\services\auth.service.ts
Purpose: ارسال درخواست به بک‌اند جهت تولید توکن‌های جدید و ابطال توکن قدیمی. این عملیات در سمت سرور در قالب یک تراکنش اتمیک انجام می‌شود.
Parameters: refreshToken: string
Return: Promise<{ accessToken: string, refreshToken: string }>
Called By: auth.ts (Pinia Store) در صورت منقضی شدن توکن اکسس
Calls: request('/auth/refresh', { ... })
Used In: ماژول‌ها و استورهای مربوط به احراز هویت (Auth Store)
Side Effects: بروزرسانی توکن‌ها در LocalStorage و Session فرانت‌اند.
Database: به صورت مستقیم در فرانت‌اند اثری ندارد. در سمت سرور رکورد متناظر را در جدول refresh_tokens تغییر می‌دهد.
API: /api/auth/refresh

---

Function: verify
File: payment.service.ts
Path: d:\codeless_final\frontend\src\services\payment.service.ts
Purpose: ارسال اطلاعات بازگشتی از درگاه پرداخت به بک‌اند جهت وریفای تراکنش بانکی. این متد باعث اجرای یک تراکنش همراه با قفل بدبینانه (Pessimistic Lock) در دیتابیس سرور می‌شود.
Parameters: data: { authority: string, status?: string, payload?: any }
Return: Promise<VerifyPaymentResponse>
Called By: PaymentResultView.vue, SandboxGatewayMockView.vue
Calls: request<VerifyPaymentResponse>('/payments/verify', { ... })
Used In: پروسه پرداخت و بازگشت از درگاه پرداخت
Side Effects: نمایش نتیجه پرداخت به کاربر (موفق، لغو شده یا ناموفق) و بروزرسانی وضعیت اشتراک کاربر در UI.
Database: هیچ عملیات مستقیم دیتابیسی در فرانت‌اند ندارد. سرور در جدول payments عملیات تراکنشی انجام می‌دهد.
API: /api/payments/verify

---

Function: assignPlan
File: subscription.service.ts
Path: d:\codeless_final\frontend\src\services\subscription.service.ts
Purpose: ارسال درخواست تخصیص مستقیم پلن به کاربر توسط ادمین سیستم. در سمت سرور این درخواست منجر به اجرای تراکنش جهت باطل کردن پلن قبلی و فعال‌سازی پلن جدید می‌گردد.
Parameters: data: { userId: string, planId: string, durationDays?: number, paymentId?: string }
Return: Promise<Subscription>
Called By: AdminSubscriptionsSection.vue
Calls: request<Subscription>('/subscriptions/assign', { ... })
Used In: پنل مدیریت (Admin Dashboard)
Side Effects: اضافه شدن اشتراک جدید در لیست اشتراک‌های کاربر و تغییر وضعیت در رابط کاربری ادمین.
Database: سمت کلاینت فاقد تراکنش دیتابیس است. عملیات در سمت سرور روی جدول subscriptions صورت می‌پذیرد.
API: /api/subscriptions/assign
