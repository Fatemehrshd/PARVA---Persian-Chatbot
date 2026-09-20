# مستندات Subscriptions (Backend)

این سند شامل توابع مربوط به مدیریت اشتراک‌های کاربران در سمت سرور است.

Function: getActiveSubscription
File: subscriptions.service.ts
Path: src/modules/subscriptions/subscriptions.service.ts
Purpose: یافتن اشتراک فعال فعلی کاربر. در صورتی که زمان اشتراک گذشته باشد، وضعیت آن را به EXPIRED تغییر می‌دهد (Lazy expiration).
Parameters: userId (string)
Return: Promise<Subscription | null>
Called By: PaymentsService.initiateCheckout, SubscriptionsController.getCurrentSubscription, EntitlementService
Calls: subscriptionRepo.findOne, subscriptionRepo.save, auditService.log
Used In: بررسی دسترسی‌ها و وضعیت فعلی کاربر پیش از خرید پلن جدید.
Side Effects: در صورت انقضای اشتراک، وضعیت در دیتابیس آپدیت شده و لاگ سیستم ثبت می‌شود.
Database: جدول subscriptions
API: فراخوانی داخلی

---

Function: getUserHistory
File: subscriptions.service.ts
Path: src/modules/subscriptions/subscriptions.service.ts
Purpose: دریافت تاریخچه تمامی اشتراک‌های یک کاربر خاص.
Parameters: userId (string)
Return: Promise<Subscription[]>
Called By: SubscriptionsController.getCurrentSubscription
Calls: subscriptionRepo.find
Used In: نمایش تاریخچه اشتراک‌های کاربر در پروفایل.
Side Effects: ندارد
Database: جدول subscriptions
API: فراخوانی داخلی

---

Function: assignPlanToUser
File: subscriptions.service.ts
Path: src/modules/subscriptions/subscriptions.service.ts
Purpose: اختصاص یک پلن جدید به کاربر. این تابع در یک تراکنش دیتابیس اجرا می‌شود، اشتراک‌های فعال قبلی را لغو کرده و اشتراک جدید ایجاد می‌کند.
Parameters: options: { userId, planId, source?, paymentId?, durationDays?, actorId?, actorType? }
Return: Promise<Subscription>
Called By: PaymentsService.initiateCheckout (برای پلن‌های رایگان)، PaymentsService.verifyPayment (پس از پرداخت موفق)، AdminSubscriptionsController
Calls: plansService.findById, dataSource.transaction, subRepo.find, subRepo.save, auditService.log
Used In: پس از تایید موفقیت‌آمیز پرداخت و یا تخصیص دستی توسط ادمین.
Side Effects: وضعیت اشتراک‌های قبلی به CANCELLED تغییر می‌کند، رکورد اشتراک جدید ثبت شده و Audit Log ثبت می‌شود.
Database: جدول subscriptions
API: فراخوانی داخلی

---

Function: cancelSubscription
File: subscriptions.service.ts
Path: src/modules/subscriptions/subscriptions.service.ts
Purpose: لغو یک اشتراک فعال توسط مدیر سیستم.
Parameters: id (string), reason? (string), actorId? (string)
Return: Promise<Subscription>
Called By: AdminSubscriptionsController
Calls: subscriptionRepo.findOne, subscriptionRepo.save, auditService.log
Used In: پنل ادمین برای مدیریت دسترسی کاربران.
Side Effects: تغییر وضعیت اشتراک به CANCELLED و ثبت تاریخ و دلیل لغو در دیتابیس.
Database: جدول subscriptions
API: فراخوانی داخلی

---

Function: findAllForAdmin
File: subscriptions.service.ts
Path: src/modules/subscriptions/subscriptions.service.ts
Purpose: دریافت لیست کامل اشتراک‌ها برای پنل ادمین همراه با قابلیت صفحه‌بندی و فیلتر.
Parameters: options: { page, limit, userId, status }
Return: Object حاوی items و متادیتا صفحه‌بندی
Called By: AdminSubscriptionsController
Calls: subscriptionRepo.createQueryBuilder
Used In: نمایش جدول مدیریت اشتراک‌ها در داشبورد ادمین.
Side Effects: ندارد
Database: جدول subscriptions
API: فراخوانی داخلی
