# مستندات Subscription Transactions (Backend)

این سند پروسه پرداخت و تراکنش‌های مربوط به خرید اشتراک را پوشش می‌دهد.

Function: initiateCheckout
File: payments.service.ts
Path: src/modules/payments/payments.service.ts
Purpose: شروع فرآیند خرید یک پلن اشتراک. بررسی‌های اولیه شامل وضعیت اشتراک فعال کاربر، اعتبار پلن و اعمال کد تخفیف انجام می‌شود. در صورت رایگان بودن پلن، مستقیما اشتراک فعال می‌شود. در غیر این صورت پرداخت به حالت PENDING ایجاد شده و توکن درگاه دریافت می‌شود.
Parameters: userId (string), dto (CheckoutDto), clientInfo ({ ip, userAgent })
Return: Object حاوی paymentId و authority و paymentUrl
Called By: PaymentsController.checkout
Calls: subscriptionsService.getActiveSubscription, plansService.findById, couponsService.validateCoupon, paymentRepo.create/save, subscriptionsService.assignPlanToUser (رایگان), gatewayProvider.requestPayment, auditService.log
Used In: مرحله اول خرید در سمت کاربر هنگام کلیک روی پرداخت.
Side Effects: ایجاد رکورد در جدول payments، در صورت رایگان بودن تغییر وضعیت اشتراک.
Database: جدول payments, جدول subscriptions (در حالت رایگان)
API: POST /payments/checkout

---

Function: verifyPayment
File: payments.service.ts
Path: src/modules/payments/payments.service.ts
Purpose: تایید پرداخت بازگشتی از سمت درگاه بانکی. با استفاده از Pessimistic Lock فرآیند به‌صورت اتمیک انجام می‌شود. در صورت تایید درگاه، وضعیت به SUCCESS تغییر یافته و اشتراک کاربر فعال می‌شود.
Parameters: dto (VerifyPaymentDto), actorId (string)
Return: Object نتیجه وضعیت تایید
Called By: PaymentsController.verify
Calls: dataSource.transaction, paymentRepo.createQueryBuilder, gatewayProvider.verifyPayment, paymentRepo.save, couponsService.recordUsage, subscriptionsService.assignPlanToUser, auditService.log
Used In: زمانی که کاربر از صفحه درگاه پرداخت به سیستم برمی‌گردد.
Side Effects: وضعیت رکورد payment به SUCCESS، CANCELLED یا FAILED تغییر می‌کند. اشتراک کاربر ایجاد/تغییر می‌یابد.
Database: جدول payments, جدول subscriptions, جدول coupon_usages
API: POST /payments/verify

---

Function: expireStalePendingPayments
File: payments.service.ts
Path: src/modules/payments/payments.service.ts
Purpose: لغو تراکنش‌های PENDING که از زمان شروع آن‌ها بیش از 20 دقیقه (زمان استاندارد درگاه) گذشته است.
Parameters: None
Return: Promise<void>
Called By: findUserPayments, findAllForAdmin
Calls: paymentRepo.createQueryBuilder.update
Used In: پاکسازی دیتابیس از تراکنش‌های ناتمام و مسدود شده پیش از فچ کردن لیست‌ها.
Side Effects: تغییر وضعیت رکوردهای قدیمی به CANCELLED.
Database: جدول payments
API: فراخوانی داخلی

---

Function: getPaymentByAuthority
File: payments.service.ts
Path: src/modules/payments/payments.service.ts
Purpose: یافتن تراکنش بر اساس کد مرجع درگاه (authority).
Parameters: authority (string)
Return: Promise<Payment>
Called By: PaymentsController.getByAuthority
Calls: paymentRepo.findOne, paymentRepo.save (برای منقضی کردن فوری در صورت لزوم)
Used In: صفحه بازگشت از پرداخت جهت استعلام اولیه وضعیت.
Side Effects: ممکن است تراکنش PENDING قدیمی را کنسل کند.
Database: جدول payments
API: GET /payments/by-authority/:authority
