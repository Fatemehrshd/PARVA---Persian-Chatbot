# مستندات Subscriptions (Frontend)

این سند سرویس‌های ارتباط با بک‌اند برای مدیریت اشتراک‌ها در رابط کاربری را توضیح می‌دهد.

Function: getPublicPlans
File: subscription.service.ts
Path: src/services/subscription.service.ts
Purpose: دریافت لیست پلن‌های فعال برای نمایش به کاربران.
Parameters: None
Return: Promise<SubscriptionPlan[]>
Called By: SubscriptionView.vue (جهت نمایش پلن‌ها)
Calls: request API
Used In: صفحه ارتقاء حساب / اشتراک‌ها.
Side Effects: ندارد
Database: N/A
API: GET /subscriptions/plans

---

Function: getCurrentSubscription
File: subscription.service.ts
Path: src/services/subscription.service.ts
Purpose: دریافت اطلاعات وضعیت اشتراک جاری، تاریخچه و حقرسی‌های کاربر (Entitlements).
Parameters: None
Return: Promise<CurrentSubscriptionResponse>
Called By: SubscriptionView.vue
Calls: request API
Used In: نمایش پلن فعلی و میزان مصرف در داشبورد.
Side Effects: ندارد
Database: N/A
API: GET /subscriptions/current

---

Function: getAllPlans
File: subscription.service.ts
Path: src/services/subscription.service.ts
Purpose: دریافت تمام پلن‌ها (شامل غیرفعال‌ها) برای پنل مدیریت.
Parameters: None
Return: Promise<SubscriptionPlan[]>
Called By: پنل ادمین
Calls: request API
Used In: مدیریت سیستم
Side Effects: ندارد
Database: N/A
API: GET /admin/plans
