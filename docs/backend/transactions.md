# مستندات تراکنش‌های دیتابیس (Backend)

در این سند، تمامی تراکنش‌های پایگاه داده (ACID Transactions) که در سمت بک‌اند با استفاده از `dataSource.transaction` پیاده‌سازی شده‌اند، مستند شده است.

Function: refresh
File: auth.service.ts
Path: d:\codeless_final\backend\src\modules\auth\auth.service.ts
Purpose: ابطال توکن قبلی و صدور توکن‌های جدید به صورت اتمیک در یک تراکنش دیتابیس، برای جلوگیری از مشکلات همزمانی و باگ‌های امنیتی (مانند Token Replay). در این تراکنش اطمینان حاصل می‌شود که توکن رفرش قدیمی فقط زمانی باطل شود که توکن جدید به درستی در دیتابیس ذخیره شده باشد.
Parameters: rawRefreshToken: string, clientInfo?: { ip?: string; userAgent?: string }
Return: Promise<{ user: any, accessToken: string, refreshToken: string }>
Called By: AuthController (مسیر /api/auth/refresh)
Calls: this.dataSource.transaction, manager.getRepository(RefreshToken), repo.save(existing), this.tokens(user, clientInfo, manager)
Used In: ماژول AuthModule
Side Effects: توکن قبلی به عنوان isRevoked = true بروزرسانی می‌شود و یک رکورد جدید در جدول refresh_tokens ایجاد می‌گردد.
Database: جدول refresh_tokens تحت مدیریت تراکنش. نقطه شروع تراکنش `dataSource.transaction`، نقطه Commit بازگشت موفق از کال‌بک، و نقطه Rollback بروز هرگونه Exception در زمان ذخیره یا تولید توکن است.
API: /api/auth/refresh

---

Function: verifyPayment
File: payments.service.ts
Path: d:\codeless_final\backend\src\modules\payments\payments.service.ts
Purpose: قفل کردن اتمیک رکورد پرداخت، وریفای وضعیت و ذخیره آن در تراکنش برای جلوگیری از Double-Credit و شرایط مسابقه‌ای (Race Conditions) در اثر فراخوانی‌های همزمان Webhook یا پاسخ‌های تکراری شبکه.
Parameters: dto: VerifyPaymentDto, actorId?: string
Return: Promise<{ success: boolean, refId?: string, status: PaymentStatus, message: string, payment: Payment, ... }>
Called By: PaymentsController (مسیر /api/payments/verify)
Calls: this.dataSource.transaction, paymentRepo.createQueryBuilder().setLock('pessimistic_write'), gatewayProvider.verifyPayment, paymentRepo.save, this.couponsService.recordUsage, this.subscriptionsService.assignPlanToUser, this.auditService.log
Used In: ماژول PaymentsModule
Side Effects: تغییر وضعیت پرداخت به SUCCESS یا FAILED/CANCELLED. مصرف کد تخفیف در صورت وجود. تخصیص پلن جدید به کاربر در صورت موفقیت تراکنش بانکی.
Database: جدول payments (با استفاده از قفل pessimistic_write). جدول coupon_usages (در صورت اعمال کد تخفیف). نقطه شروع `dataSource.transaction` است. در صورت موفقیت، Commit به صورت خودکار رخ می‌دهد. بروز هرگونه خطا باعث Rollback وضعیت پرداخت به حالت قبلی می‌گردد. تخصیص اشتراک خارج از قفل پرداخت انجام می‌شود تا از Deadlock با کلید خارجی جلوگیری شود.
API: /api/payments/verify

---

Function: assignPlanToUser
File: subscriptions.service.ts
Path: d:\codeless_final\backend\src\modules\subscriptions\subscriptions.service.ts
Purpose: غیرفعال‌سازی (Cancel) اشتراک‌های فعال پیشین کاربر و ثبت اشتراک جدید به صورت اتمیک، تا از وجود همزمان چندین اشتراک فعال برای یک کاربر جلوگیری شود و ثبات سیستم حفظ گردد.
Parameters: options: { userId: string, planId: string, source?: string, paymentId?: string, durationDays?: number, actorId?: string, actorType?: 'admin' | 'user' | 'system' }
Return: Promise<Subscription>
Called By: PaymentsService.verifyPayment, AdminSubscriptionsController.assignPlan
Calls: this.dataSource.transaction, subRepo.find, subRepo.save(sub), subRepo.create, subRepo.save(newSub), this.auditService.log
Used In: ماژول SubscriptionsModule
Side Effects: وضعیت اشتراک‌های فعال قبلی به CANCELLED تغییر یافته و رکورد جدید با وضعیت ACTIVE ثبت می‌گردد. ثبت تاریخچه در سیستم Audit Log.
Database: جدول subscriptions تحت تراکنش. نقطه شروع `dataSource.transaction` است. در حین تراکنش، اشتراک‌های قبلی پیدا و بروزرسانی می‌شوند و اشتراک جدید ذخیره می‌شود. اتمام موفقیت‌آمیز تابع منجر به Commit و در صورت بروز خطا تراکنش Rollback می‌شود.
API: فراخوانی غیرمستقیم (توسط /api/payments/verify و پنل ادمین)
