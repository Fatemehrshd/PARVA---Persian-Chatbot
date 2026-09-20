# Frontend Authentication

## سرویس‌ها (Services)

Function: signup
File: auth.service.ts
Path: d:\codeless_final\frontend\src\services\auth.service.ts
Purpose: ارسال اطلاعات ثبت‌نام کلاینت به سرور برای ایجاد حساب کاربری.
Parameters: email: string, password: string, displayName?: string
Return: Promise از `AuthResponse` حاوی اطلاعات کاربر و توکن‌ها
Called By: useAuthStore.signup
Calls: request
Used In: روال‌های مربوط به عضویت
Side Effects: ارسال درخواست شبکه
Database: ندارد
API: `POST /auth/signup`

Function: login
File: auth.service.ts
Path: d:\codeless_final\frontend\src\services\auth.service.ts
Purpose: احراز هویت با استفاده از ایمیل و کلمه عبور و دریافت توکن‌ها از سرور.
Parameters: email: string, password: string
Return: Promise از `AuthResponse`
Called By: useAuthStore.login
Calls: request
Used In: روال‌های ورود به حساب
Side Effects: ارسال درخواست شبکه
Database: ندارد
API: `POST /auth/login`

Function: logout
File: auth.service.ts
Path: d:\codeless_final\frontend\src\services\auth.service.ts
Purpose: درخواست باطل کردن توکن نشست فعلی در بک‌اند.
Parameters: refreshToken?: string
Return: Promise<void>
Called By: useAuthStore.logout
Calls: request
Used In: روال‌های خروج از برنامه
Side Effects: ارسال درخواست شبکه
Database: ندارد
API: `POST /auth/logout`

Function: refreshToken
File: auth.service.ts
Path: d:\codeless_final\frontend\src\services\auth.service.ts
Purpose: درخواست دریافت توکن‌های جدید با ارائه رفرش توکن فعلی.
Parameters: refreshToken: string
Return: Promise حاوی توکن‌های دسترسی و رفرش جدید
Called By: useAuthStore.checkExpiry
Calls: request
Used In: تمدید نشست پیش از انقضا
Side Effects: درخواست شبکه
Database: ندارد
API: `POST /auth/refresh`

Function: request (Interceptor logic)
File: api.ts
Path: d:\codeless_final\frontend\src\services\api.ts
Purpose: مدیریت تمام درخواست‌های شبکه؛ تزریق توکن دسترسی به سرآیندِ Authorization و گرفتن خطای 401 برای تمدید خودکار نشست.
Parameters: endpoint: string, options: RequestInit
Return: Promise<T>
Called By: تمامی سرویس‌های سمت فرانت‌اند (auth, chat, admin و غیره)
Calls: fetch, buildUrl, silentRefreshToken
Used In: تمام تعاملات با بک‌اند
Side Effects: در صورت 401، عملیات تمدید را اجرا می‌کند و در صورت شکست کاربر را به صفحه Login منتقل می‌سازد (همراه با پاک شدن حافظه محلی).
Database: حافظه مرورگر (`localStorage`)
API: تمامی درخواست‌های API از این متد رد می‌شوند.

Function: silentRefreshToken
File: api.ts
Path: d:\codeless_final\frontend\src\services\api.ts
Purpose: تمدید خودکار و بی‌سروصدای توکن‌ها هنگام بروز خطای 401 بدون متوجه شدن کاربر.
Parameters: ندارد
Return: Promise<string | null> (اکسس توکن جدید)
Called By: متد `request` هنگام دریافت 401 Unauthorized
Calls: fetch, buildUrl
Used In: احیای نشست پس از انقضای توکن دسترسی
Side Effects: ذخیره توکن‌های جدید در `localStorage` و `authStore`
Database: نوشتن روی `localStorage`
API: `POST /auth/refresh`

## وضعیت‌ها و مدیریت نشست (Stores)

Function: refreshIdentity
File: auth.ts
Path: d:\codeless_final\frontend\src\stores\auth.ts
Purpose: دریافت وضعیت لحظه‌ای کاربر (مثل مسدود بودن یا نقش ادمین) به‌صورت مطمئن از دیتابیس (سرور) و نه فقط از روی توکن کش شده.
Parameters: ندارد
Return: Promise<void>
Called By: login, signup, beforeEach (router)
Calls: profileService.getProfile, adminService.listUsers
Used In: اطمینان از صحت دسترسی در بخش‌های حساس نظیر مدیریت
Side Effects: تغییر در `identity.value`، `isAdmin` و آپدیت یوزر ذخیره شده
Database: ندارد
API: `GET /users/me`, و در صورت ادمین بودن `GET /admin/users`

Function: setSession
File: auth.ts
Path: d:\codeless_final\frontend\src\stores\auth.ts
Purpose: ذخیره‌سازی وضعیت کاربر و توکن‌ها در حافظه Pinia و localStorage.
Parameters: newUser: User, newAccessToken: string, newRefreshToken: string
Return: void
Called By: login, signup
Calls: localStorage.setItem
Used In: زمان ایجاد نشست موفقیت‌آمیز
Side Effects: تغییر `user.value` و نوشتن در `localStorage`
Database: LocalStorage
API: ندارد

Function: login
File: auth.ts
Path: d:\codeless_final\frontend\src\stores\auth.ts
Purpose: فراخوانی سرویس لاگین و پیکربندی فروشگاه وضعیت (store)، راه‌اندازی تم و پروفایل کاربر.
Parameters: email: string, password: string
Return: Promise<boolean> (موفقیت‌آمیز بودن)
Called By: فرم ورود در `LoginView.vue`
Calls: authService.login, resetThemeSession, setSession, refreshProfile, refreshIdentity
Used In: فرآیند ورود کاربر
Side Effects: روشن شدن فلگ `loading`، بروزرسانی متغیرهای نشست
Database: LocalStorage
API: درخواست ورود از سرویس مربوطه

Function: signup
File: auth.ts
Path: d:\codeless_final\frontend\src\stores\auth.ts
Purpose: فراخوانی سرویس ثبت‌نام و مدیریت وضعیت و نشست کاربر.
Parameters: email: string, password: string, displayName?: string
Return: Promise<boolean>
Called By: فرم ثبت نام
Calls: authService.signup, resetThemeSession, setSession, refreshProfile, refreshIdentity
Used In: فرآیند ایجاد حساب
Side Effects: تغییر استیت کاربری
Database: LocalStorage
API: درخواست ثبت‌نام

Function: logout
File: auth.ts
Path: d:\codeless_final\frontend\src\stores\auth.ts
Purpose: پاک کردن داده‌های نشست از رم برنامه و ذخیره‌گاه محلی و ارسال درخواست به سرور جهت ابطال توکن.
Parameters: ندارد
Return: Promise<void>
Called By: دکمه خروج در نوار کنار، یا انقضای نشست قطعی
Calls: authService.logout, resetThemeSession
Used In: خروج آگاهانه یا قهری کاربر
Side Effects: پاک کردن مقادیر و `localStorage`
Database: LocalStorage.removeItem
API: فراخوانی سرویس لاگ‌اوت

## توابع کمکی (Helpers)

Function: decodeJwtPayload
File: jwt.ts
Path: d:\codeless_final\frontend\src\lib\jwt.ts
Purpose: رمزگشایی ایمن بدنه توکن JWT در مرورگر و تبدیل به آبجکت جاوا اسکریپت بدون استفاده از کتابخانه خارجی.
Parameters: token?: string | null
Return: `JwtPayload | null`
Called By: isTokenExpired
Calls: atob, Buffer.from, JSON.parse
Used In: ارزیابی زمان انقضای توکن
Side Effects: ندارد
Database: ندارد
API: ندارد

Function: isTokenExpired
File: jwt.ts
Path: d:\codeless_final\frontend\src\lib\jwt.ts
Purpose: تشخیص زمان انقضای توکن با استفاده از پراپرتی `exp` و بررسی در نظر گرفتن یک بافر زمانی.
Parameters: token?: string | null, bufferSeconds = 5
Return: `boolean`
Called By: useAuthStore (چک کردن در زمان focus صفحه)، روتر (beforeEach)
Calls: decodeJwtPayload, Date.now
Used In: اعتبارسنجی توکن قبل از ارسال درخواست یا ورود به مسیرهای محافظت‌شده
Side Effects: ندارد
Database: ندارد
API: ندارد

## مسیریاب و گارد (Router)

Function: beforeEach
File: index.ts
Path: d:\codeless_final\frontend\src\router\index.ts
Purpose: گارد پیمایش در Vue Router جهت بررسی نشست کاربر قبل از ورود به صفحات.
Parameters: to, _from, next
Return: void (مسیر بعدی یا ریدایرکت)
Called By: رویدادهای تغییر مسیر Vue Router
Calls: localStorage.getItem, isTokenExpired, localStorage.removeItem, authStore.refreshIdentity, next
Used In: محافظت از صفحات، احراز نقش مدیریت برای بخش `/admin`، ممانعت کاربر لاگین شده از باز کردن صفحات مهمان (مثل ورود).
Side Effects: جلوگیری از رندر صفحات یا انتقال به صفحه Login. اگر توکن منقضی شده باشد به طور خودکار نشست کلاینت پاک می‌شود.
Database: بررسی مقادیر ذخیره شده در LocalStorage
API: صدازدن غیرمستقیم API حین بررسی وضعیت ادمین در `refreshIdentity`
