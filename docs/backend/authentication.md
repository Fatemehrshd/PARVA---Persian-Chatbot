# Backend Authentication

## کنترلرها (Controllers)

Function: signup
File: auth.controller.ts
Path: d:\codeless_final\backend\src\modules\auth\auth.controller.ts
Purpose: دریافت درخواست ثبت‌نام کاربر جدید و ارسال اطلاعات به سرویس احراز هویت.
Parameters: d: SignupDto, req: any
Return: اطلاعات کاربر و توکن‌های دسترسی (access/refresh)
Called By: درخواست HTTP POST به `/auth/signup`
Calls: this.auth.signup
Used In: مسیرهای عمومی (بدون نیاز به توکن)
Side Effects: ثبت IP و User-Agent کاربر
Database: خواندن و نوشتن از طریق سرویس
API: Endpoint: `POST /auth/signup`

Function: login
File: auth.controller.ts
Path: d:\codeless_final\backend\src\modules\auth\auth.controller.ts
Purpose: دریافت اطلاعات ورود کاربر (ایمیل و رمز عبور) و تولید توکن‌های جدید.
Parameters: d: LoginDto, req: any
Return: اطلاعات کاربر و توکن‌های (access/refresh)
Called By: درخواست HTTP POST به `/auth/login`
Calls: this.auth.login
Used In: مسیرهای عمومی (بدون نیاز به توکن)
Side Effects: ثبت IP و User-Agent کاربر
Database: خواندن و نوشتن از طریق سرویس
API: Endpoint: `POST /auth/login`

Function: refresh
File: auth.controller.ts
Path: d:\codeless_final\backend\src\modules\auth\auth.controller.ts
Purpose: دریافت رفرش توکن و تولید جفت توکن‌های جدید (دسترسی و رفرش) در صورت معتبر بودن توکن قبلی.
Parameters: d: RefreshTokenDto, req: any
Return: اطلاعات کاربر به همراه توکن‌های جدید
Called By: درخواست HTTP POST به `/auth/refresh`
Calls: this.auth.refresh
Used In: کلاینت هنگام انقضای Access Token
Side Effects: ثبت IP و User-Agent در توکن جدید
Database: از طریق سرویس مربوطه
API: Endpoint: `POST /auth/refresh`

Function: logout
File: auth.controller.ts
Path: d:\codeless_final\backend\src\modules\auth\auth.controller.ts
Purpose: خروج کاربر از سیستم با نامعتبر کردن رفرش توکن و اکسس توکن.
Parameters: req: any, d: LogoutDto
Return: خروجی ندارد (کد HTTP 204)
Called By: درخواست HTTP POST به `/auth/logout`
Calls: this.auth.logout
Used In: محافظت شده با `JwtAuthGuard`
Side Effects: قرار دادن Access Token در لیست سیاه (حافظه موقت) و ابطال رفرش توکن در دیتابیس
Database: از طریق سرویس مربوطه
API: Endpoint: `POST /auth/logout`

## سرویس‌ها (Services)

Function: hashToken
File: auth.service.ts
Path: d:\codeless_final\backend\src\modules\auth\auth.service.ts
Purpose: رمزنگاری یک‌طرفه (هش) توکن‌ها با استفاده از الگوریتم SHA-256 برای ذخیره امن در دیتابیس.
Parameters: token: string
Return: هش تولید شده (رشته Hex)
Called By: this.tokens, this.refresh, this.logout
Calls: crypto.createHash
Used In: AuthService
Side Effects: ندارد
Database: ندارد
API: ندارد

Function: tokens
File: auth.service.ts
Path: d:\codeless_final\backend\src\modules\auth\auth.service.ts
Purpose: تولید اکسس توکن و رفرش توکن جدید بر اساس اطلاعات کاربر و ذخیره هش رفرش توکن در دیتابیس.
Parameters: u: any, clientInfo?: { ip?: string; userAgent?: string }, manager?: EntityManager
Return: شیء حاوی `accessToken` و `refreshToken`
Called By: this.signup, this.login, this.refresh
Calls: this.jwt.sign, this.hashToken, repo.save
Used In: پروسه تولید و تمدید نشست‌ها (Sessions)
Side Effects: ذخیره نشست جدید (Refresh Token) در دیتابیس
Database: درج رکورد در جدول `RefreshToken`
API: ندارد

Function: toUserJson
File: auth.service.ts
Path: d:\codeless_final\backend\src\modules\auth\auth.service.ts
Purpose: فیلتر کردن اطلاعات کاربر برای بازگرداندن داده‌های امن به کلاینت (حذف هش رمز عبور).
Parameters: u: any
Return: شیء حاوی فیلدهای ایمن کاربر
Called By: this.signup, this.login, this.refresh
Calls: ندارد
Used In: بازگشت داده‌های کاربر به کنترلر
Side Effects: ندارد
Database: ندارد
API: ندارد

Function: signup
File: auth.service.ts
Path: d:\codeless_final\backend\src\modules\auth\auth.service.ts
Purpose: ایجاد کاربر جدید در دیتابیس در صورتی که ایمیل تکراری نباشد و تولید توکن‌ها برای نشست.
Parameters: email: string, password: string, displayName?: string, clientInfo?: { ip?: string; userAgent?: string }
Return: اطلاعات کاربر و توکن‌های مربوطه
Called By: AuthController.signup
Calls: this.users.findByEmail, bcrypt.hash, this.users.create, this.tokens, this.toUserJson
Used In: فرآیند ثبت‌نام کاربر
Side Effects: هش کردن رمز عبور
Database: جستجو در `users` و درج رکورد جدید در `users` و `refresh_tokens`
API: ندارد

Function: login
File: auth.service.ts
Path: d:\codeless_final\backend\src\modules\auth\auth.service.ts
Purpose: احراز هویت کاربر با ایمیل و رمز عبور و تولید نشست جدید.
Parameters: email: string, password: string, clientInfo?: { ip?: string; userAgent?: string }
Return: اطلاعات کاربر و توکن‌های مربوطه
Called By: AuthController.login
Calls: this.users.findByEmail, bcrypt.compare, this.tokens, this.toUserJson
Used In: فرآیند ورود کاربر
Side Effects: ندارد
Database: خواندن از `users` و درج رکورد جدید در `refresh_tokens`
API: ندارد

Function: refresh
File: auth.service.ts
Path: d:\codeless_final\backend\src\modules\auth\auth.service.ts
Purpose: چرخش رفرش توکن؛ رفرش توکن قدیمی را باطل کرده و توکن‌های جدید صادر می‌کند. در صورت استفاده از توکنِ باطل شده، نشست امنیتی لغو می‌شود.
Parameters: rawRefreshToken: string, clientInfo?: { ip?: string; userAgent?: string }
Return: اطلاعات کاربر به همراه توکن‌های جدید
Called By: AuthController.refresh
Calls: this.jwt.verify, this.hashToken, this.refreshTokenRepo.findOne, this.refreshTokenRepo.update, this.users.findById, dataSource.transaction, this.tokens, this.toUserJson
Used In: تمدید نشست کاربر بدون نیاز به ورود مجدد
Side Effects: ابطال توکن قدیمی (Revoke)
Database: خواندن از `refresh_tokens` و `users`، به‌روزرسانی وضعیت ابطال در `refresh_tokens`، و ایجاد رکورد جدید در تراکنش پایگاه داده
API: ندارد

Function: logout
File: auth.service.ts
Path: d:\codeless_final\backend\src\modules\auth\auth.service.ts
Purpose: قرار دادن توکن دسترسی فعلی در لیست سیاه (Blacklist) موقت و ابطال رفرش توکن در پایگاه داده.
Parameters: token?: string, rawRefreshToken?: string
Return: Promise<void>
Called By: AuthController.logout
Calls: AuthService.revoked.add, this.hashToken, this.refreshTokenRepo.update
Used In: فرآیند خروج از سیستم
Side Effects: تغییر متغیر استاتیک (لیست سیاه توکن‌ها در مموری)
Database: به‌روزرسانی `isRevoked = true` در جدول `refresh_tokens`
API: ندارد

Function: isRevoked
File: auth.service.ts
Path: d:\codeless_final\backend\src\modules\auth\auth.service.ts
Purpose: بررسی اینکه آیا یک توکن دسترسی خاص مسدود شده است یا خیر (از طریق متد استاتیک فراخوانی می‌شود).
Parameters: t: string
Return: مقدار بولی (true در صورت مسدود بودن)
Called By: متدهای داخلی
Calls: AuthService.revoked.has
Used In: -
Side Effects: ندارد
Database: ندارد
API: ندارد

Function: isTokenRevoked
File: auth.service.ts
Path: d:\codeless_final\backend\src\modules\auth\auth.service.ts
Purpose: یک متد استاتیک برای بررسی ابطال توکن‌های دسترسی در حافظه موقت (Ram) سرور.
Parameters: t: string
Return: مقدار بولی (true در صورت قرار داشتن در بلک لیست)
Called By: JwtAuthGuard.canActivate
Calls: AuthService.revoked.has
Used In: گاردهای امنیتی برای احراز هویت توکن‌های ارسال شده
Side Effects: ندارد
Database: ندارد
API: ندارد

## گاردها (Guards)

Function: canActivate
File: jwt-auth.guard.ts
Path: d:\codeless_final\backend\src\shared\jwt-auth.guard.ts
Purpose: بررسی صحت، اعتبار و عدم ابطال Access Token ارسال شده در هدر درخواست؛ همچنین استخراج اطلاعات کاربر به درون بدنه درخواست.
Parameters: ctx: ExecutionContext
Return: مقدار بولی که مشخص می‌کند مسیر قابل دسترسی است یا نه (یا پرتاب `UnauthorizedException`)
Called By: هسته پردازشی NestJS برای مسیرهایی که `@UseGuards(JwtAuthGuard)` دارند.
Calls: ctx.switchToHttp().getRequest, AuthService.isTokenRevoked, this.jwt.verify
Used In: تمامی مسیرهای نیازمند لاگین کاربر (مثبت `chat`, `users/me` و غیره)
Side Effects: اضافه کردن `req.user` و `req.token` به شیء درخواست
Database: ندارد (ابطال دسترسی تنها در RAM چک می‌شود)
API: کنترل دسترسی به روت‌های API
