# ماژول Auth بک‌اند — توضیح فایل‌به‌فایل (NestJS)

> محدوده: فقط `backend/src/modules/auth/*` + گارد `backend/src/shared/jwt-auth.guard.ts`

## نقش کلی ماژول Auth

وظیفه: **ثبت‌نام، ورود، تمدید نشست (refresh)، خروج (logout)** با مدل
**Access Token کوتاه‌مدت (۱ ساعت) + Refresh Token بلندمدت (۷ روز)**.
Access Token بدون State تأیید می‌شود (JWT)، اما Refresh Token در دیتابیس
ذخیره و قابل باطل‌کردن است.

```
Client
  │ POST /auth/signup | /auth/login | /auth/refresh | /auth/logout
  ▼
AuthController ── DTO ──▶ AuthService ──┬──▶ UsersService
                                        ├──▶ JwtService
                                        └──▶ RefreshToken Entity
JwtAuthGuard ◀── روی logout و روت‌های محافظت‌شده ── هدر Authorization
```

## ۱) `auth.module.ts` — نقشه سیم‌کشی ماژول

**این فایل چیه؟**
کلاس `AuthModule` با دکوریتور `@Module()`؛ در NestJS هر قابلیت یک Module
دارد که Controller، Providerها، imports و exports را مشخص می‌کند.

**چه کاری انجام می‌ده؟**
- `TypeOrmModule.forFeature([RefreshToken])` → ریپازیتوری جدول
  `refresh_tokens` را injectable می‌کند.
- `forwardRef(() => UsersModule)` → شکستن چرخه import بین Auth و Users.
  بدون این، Nest خطای circular dependency می‌دهد.
- `JwtModule.register({global:true, secret})` → `JwtService` را سراسری ثبت
  می‌کند تا هم AuthService و هم JwtAuthGuard از `sign/verify` استفاده کنند.
  راز از `JWT_SECRET` می‌آید (fallback ‏`dev-secret` فقط برای dev).
- `controllers: [AuthController]` → نقطه ورود HTTP.
- `providers: [AuthService, JwtAuthGuard, AdminGuard]` → ساخت نمونه‌ها با DI.
- `exports: [JwtAuthGuard, AdminGuard, JwtModule]` → ماژول‌های دیگر
  (Chat/Admin) با import کردن AuthModule از همان گاردها استفاده می‌کنند.

**ارتباط با بقیه فایل‌ها:**
قلب اتصال است؛ Controller و Service را به هم می‌دوزد، Entity را به
TypeORM وصل می‌کند، گاردها را برای مصرف بیرونی export می‌کند.

**در معماری NestJS چرا وجود داره؟**
Nest بر پایه Modularity + DI است. این فایل مرز دامنه احراز هویت را
تعریف می‌کند: هرچه مربوط به توکن است اینجاست، نه پخش در کل پروژه.

## ۲) `auth.controller.ts` — درگاه HTTP

**این فایل چیه؟**
کلاس `AuthController` با `@Controller('auth')`؛ همه مسیرها با `/auth`
شروع می‌شوند. در Nest، Controller فقط پروتکل HTTP را می‌فهمد، نه منطق تجاری.

**۴ اندپوینت:**
- `POST /auth/signup` + `ValidationPipe({whitelist:true, transform:true})`:
  بادی → `SignupDto`، جدا کردن `ip/userAgent` از `req`، فراخوانی `auth.signup()`.
- `POST /auth/login` + `@HttpCode(200)`: دیفالت POST در Nest ‏۲۰۱‏ است
  ولی قرارداد OpenAPI ‏۲۰۰‏ می‌خواهد؛ → `auth.login()`.
- `POST /auth/refresh` + `@HttpCode(200)`: فقط `refreshToken` → `auth.refresh()`
  و برگرداندن جفت توکن جدید.
- `POST /auth/logout` + `@UseGuards(JwtAuthGuard)` + `@HttpCode(204)`:
  اول گارد هویت را از access token پیدا می‌کند، بعد access token
  (از `req.token` یا هدر Bearer) و `refreshToken` اختیاری بادی به
  `auth.logout()` می‌رود. بادی ۲۰۴ خالی است.

**ارتباط با بقیه فایل‌ها:**
از `dto.ts` تایپ ورودی، از `jwt-auth.guard.ts` محافظت logout، و همه منطق
را از `AuthService` می‌گیرد (خودش bcrypt/JWT/DB نمی‌شناسد).
`clientInfo` را برای ذخیره امنیتی کنار refresh token جمع می‌کند.

**چرا در NestJS وجود داره؟**
جداسازی Transport از Domain: اگر فردا gRPC/GraphQL اضافه شود فقط
Controller عوض می‌شود. Pipe و Guard دقیقاً در همین لایه معنا دارند.

## ۳) `auth.service.ts` — مغز منطق

**این فایل چیه؟**
کلاس `AuthService` با `@Injectable()`؛ قابل inject در Controller و جاهای دیگر.
تمام قوانین احراز هویت اینجاست.

**سازنده:**
`UsersService` (جدول users)، `JwtService` (امضا/تأیید)،
`@InjectRepository(RefreshToken)` (جدول refresh_tokens)، `DataSource`
(برای transaction). دو تای آخری `@Optional()` هستند تا در تست حافظه‌ای
بدون DB هم بالا بیاید.

**متدها:**
- `revoked: Set<string>` (static): لیست سیاه access tokenهای logoutشده
  در حافظه. چون access ذاتاً stateless است، راه باطل‌کردنش نگه‌داشتنش تا
  انقضاست. با ری‌استارت پاک می‌شود (محدودیت شناخته‌شده؛ راه درست Redis).
- `hashToken()`: هش SHA-256 از refresh خام. توکن خام هرگز در DB ذخیره
  نمی‌شود تا لو رفتن DB قابل سوءاستفاده نباشد (مثل هش پسورد).
- `tokens()`: ساخت جفت توکن؛ Access با `{sub,email,role}` و انقضای ۱ ساعت،
  Refresh با `type:'refresh'` و انقضای ۷ روز؛ ذخیره هش refresh + متادیتا.
- `toUserJson()`: خروجی امن کاربر؛ هش پسورد هرگز به کلاینت برنمی‌گردد.
- `signup()`: ایمیل تکراری → `ConflictException`؛ وگرنه `bcrypt.hash(10)` →
  ساخت یوزر با نقش `user` → صدور جفت توکن.
- `login()`: normalize ایمیل، عدم تطابق → `401` با پیام مشترک (لو نرفتن
  اینکه ایمیل غلط بود یا پسورد)؛ `isActive===false` → خطای غیرفعال.
- `refresh()` (پیچیده‌ترین): verify ناموفق/خالی/`type` اشتباه/`sub` نداشتن
  → ‏۴۰۱؛ هش در DB نبود → ‏۴۰۱؛ `isRevoked`/منقضی → حمله reuse: همه
  توکن‌های کاربر باطل + ‏۴۰۱؛ کاربر حذف/غیرفعال → ‏۴۰۱؛ سپس چرخش اتمی
  داخل transaction (revoke قدیمی + صدور جدید در یک تراکنش) تا با درخواست
  هم‌زمان دو جفت معتبر ساخته نشود.
- `logout()`: access به Set حافظه، هش refresh در DB باطل می‌شود.
- `isRevoked/isTokenRevoked`: پلی که گارد برای چک لیست سیاه صدا می‌زند.

**ارتباط:** به Controller سرویس می‌دهد، از UsersService یوزر، با JwtService
توکن، با Entity نشست ماندگار، پیام فارسی از `messages.fa.ts`.

**چرا در NestJS وجود داره؟**
اصل Injectable Provider: منطق قابل تست و مستقل از HTTP. Controller نازک،
Service چاق — استاندارد Nest.

## ۴) `dto.ts` — قرارداد ورودی و اعتبارسنجی

**این فایل چیه؟**
چهار کلاس `SignupDto/LoginDto/RefreshTokenDto/LogoutDto` با دکوریتورهای
`class-validator`. در Nest، DTO شکل مورد انتظار بادی را تعریف می‌کند.

**چه کاری انجام می‌ده؟**
- `SignupDto`: ایمیل معتبر + پسورد ≥۸ با Regex پیچیدگی (کوچک+بزرگ+عدد+نماد)
  + `displayName` اختیاری. پیام‌ها فارسی از `FA`.
- `LoginDto`: ایمیل + پسورد (بدون چک پیچیدگی؛ موقع ورود فقط تطبیق مهم است).
- `RefreshTokenDto`: فقط `refreshToken` الزامی.
- `LogoutDto`: فقط `refreshToken` اختیاری (شاید فقط access باطل شود).
- با `whitelist:true` فیلد اضافه حذف می‌شود (ضد mass-assignment).

**ارتباط:** Controller قبل از Service با همین‌ها بادی را فیلتر می‌کند.

**چرا در NestJS وجود داره؟**
مرز Validation: ورودی کثیف اینترنت نباید به Service/DB برسد. DTO+Pipe
استاندارد Nest برای همین مرز است و مستند OpenAPI هم از این‌ها می‌آید.

## ۵) `refresh-token.entity.ts` — نگاشت جدول نشست‌ها

**این فایل چیه؟**
کلاس `RefreshToken` با `@Entity('refresh_tokens')`؛ نگاشت TypeORM به Postgres.

**ستون‌ها:**
- `id: uuid PK`؛ `userId: uuid + Index` (مالک نشست، برای باطل گروهی).
- `tokenHash: unique + Index` (اثر انگشت توکن، نه خودش؛ جست‌وجوی سریع).
- `expiresAt: timestamptz + Index` (انقضای ۷ روزه).
- `isRevoked: boolean + Index` (قلب reuse-detection).
- `ip/userAgent: nullable` (ممیزی امنیتی)؛ `createdAt: auto`.

**ارتباط:** در Module با `forFeature` ثبت، در Service با ریپازیتوری‌اش
CRUD می‌شود؛ هرگز مستقیم به Controller نمی‌رسد.

**چرا در NestJS وجود داره؟**
الگوی Repository via TypeORM: قرارداد کد شی‌گرا با جدول رابطه‌ای.
جدول جدا لازم است چون یک کاربر چند نشست هم‌زمان (چند دستگاه) دارد و هر
نشست باید جدا باطل شود.

## ۶) `shared/jwt-auth.guard.ts` — نگهبان احراز هویت

**این فایل چیه؟**
کلاس `JwtAuthGuard` با `@Injectable()` که `CanActivate` را پیاده می‌کند؛
قبل از رسیدن درخواست به Controller اجرا می‌شود. در `shared/` است چون همه
ماژول‌ها استفاده می‌کنند، ولی مالک منطقی‌اش Auth است (در AuthModule ساخته
و export می‌شود).

**`canActivate` خط‌به‌خط:**
۱. توکن از هدر `Bearer` وگرنه `?token=` کوئری (برای SSE/دانلود).
۲. نبود توکن → ‏۴۰۱. ۳. بودن در لیست سیاه → ‏۴۰۱ (پوشش logout).
۴. `jwt.verify` ناموفق → ‏۴۰۱ با پیام یکسان (عدم نشت دلیل).
۵. موفق: `decoded.id ||= decoded.sub` (سازگاری)، بعد
`req.user=decoded; req.token=token` و برگرداندن `true`.

**ارتباط:** به JwtService و متد static لیست سیاه AuthService وابسته است
(چرخه ندارد). روی logout مستقیم و روی روت‌های chat/admin غیرمستقیم.

**چرا در NestJS وجود داره؟**
Cross-cutting concern: به‌جای تکرار `if(!token)` در هر Controller، با
`@UseGuards` دکلراتیو اعمال می‌شود. با AdminGuard (که نقش را از DB
می‌خواند نه از ادعای JWT) دفاع دولایه می‌سازد: «کی هستی؟» جدا از
«چه حقی داری؟».

## جمع‌بندی یک‌خطی

| فایل | در یک جمله |
|---|---|
| `auth.module.ts` | سیم‌کشی DI و مرز ماژول؛ ثبت همه‌چیز و export گاردها |
| `auth.controller.ts` | مترجم HTTP؛ مسیر/اعتبارسنجی/کد وضعیت، بدون منطق |
| `auth.service.ts` | مغز تصمیم؛ هش، JWT، چرخش اتمی، لیست سیاه |
| `dto.ts` | دروازه‌بان ورودی؛ شکل و پیچیدگی داده |
| `refresh-token.entity.ts` | حافظه نشست‌ها؛ باطل تکی/گروهی و reuse-detection |
| `jwt-auth.guard.ts` | نگهبان؛ تأیید امضا + لیست سیاه، تزریق `req.user` |
