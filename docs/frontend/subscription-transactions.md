# مستندات Subscription Transactions (Frontend)

توابع مربوط به فرآیند پرداخت و درگاه بانکی در سمت فرانت‌اند.

Function: checkout
File: payment.service.ts
Path: src/services/payment.service.ts
Purpose: ارسال درخواست ساخت تراکنش خرید اشتراک به بک‌اند.
Parameters: data: { planId, gateway?, callbackUrl?, idempotencyKey?, couponCode? }
Return: Promise<CheckoutResponse>
Called By: SubscriptionView.vue (از طریق CheckoutModal.vue)
Calls: request API
Used In: تایید نهایی پلن و انتقال به درگاه بانکی.
Side Effects: ریدایرکت مرورگر به URL درگاه بازگشتی از بک‌اند.
Database: N/A
API: POST /payments/checkout

---

Function: verify
File: payment.service.ts
Path: src/services/payment.service.ts
Purpose: درخواست تایید پرداخت بر اساس authority و status بازگشتی از درگاه پرداخت.
Parameters: data: { authority, status?, payload? }
Return: Promise<VerifyPaymentResponse>
Called By: PaymentResultView.vue
Calls: request API
Used In: مدیریت منطق بازگشت پس از پرداخت (صفحه PaymentResultView).
Side Effects: به‌روزرسانی وضعیت اکانت (refreshQuota و refreshIdentity).
Database: N/A
API: POST /payments/verify

---

Function: getByAuthority
File: payment.service.ts
Path: src/services/payment.service.ts
Purpose: دریافت اطلاعات اولیه یک پرداخت بر اساس Authority پیش از اعمال منطق Verification.
Parameters: authority (string)
Return: Promise<Payment>
Called By: PaymentResultView.vue
Calls: request API
Used In: بررسی سریع وضعیت روی صفحه نتیجه پرداخت (برای جلوگیری از تایید دوباره تراکنش‌های تکمیل شده).
Side Effects: ندارد
Database: N/A
API: GET /payments/by-authority/:authority
