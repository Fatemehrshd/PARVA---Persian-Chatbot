# ماژول Admin بک‌اند — توضیح فایل‌به‌فایل (NestJS)

> محدوده: فقط `backend/src/modules/admin/*`
> (فایل `admin-files.controller.ts` از نظر فیزیکی اینجاست ولی در `FilesModule` ثبت شده — پایین توضیح داده شده)

## نقش کلی ماژول Admin

پنل مدیریت سیستم: **تنظیمات سراسری، مدیریت کاربران، داشبورد آماری،
بازبینی گفتگوها و مدیریت فایل‌ها**. همه روت‌ها با `/admin/*` شروع
می‌شوند و همه با دو گارد پشت سر هم محافظت می‌شوند:
`@UseGuards(JwtAuthGuard, AdminGuard)` یعنی اول «کی هستی؟» بعد «آیا ادمینی؟».

```
Client (پنل ادمین فرانت)
  │ /admin/settings | /admin/users | /admin/dashboard | /admin/conversations | /admin/files
  ▼
4 کنترلر (نازک) ──▶ SettingsService / UsersService / EntitlementService / ریپازیتوری مستقیم
                         │
                         ▼
SystemSetting Entity (جدول key-value) + جدول‌های User/Conversation/Message/...
```

## ۱) `admin.module.ts` — نقشه سیم‌کشی ماژول

**این فایل چیه؟**
کلاس `AdminModule` با `@Module()`؛ مرز دامنه مدیریت در Nest.

**چه کاری انجام می‌ده؟**
- `TypeOrmModule.forFeature([SystemSetting, User, Conversation, Message, AiModel, AiProvider, FileAttachment])` →
  ریپازیتوری این ۷ جدول را داخل همین ماژول injectable می‌کند. به همین دلیل
  کنترلر داشبورد/گفتگو می‌توانند مستقیم `Repository` بگیرند بدون رفتن به
  سرویس ماژول دیگر (خواندن آماری، نه منطق تجاری).
- `JwtModule.register(...)` + `providers: [SettingsService, JwtAuthGuard, AdminGuard]` →
  ساخت نمونه‌های لازم همین‌جا.
- `forwardRef(() => UsersModule)` و `forwardRef(() => SubscriptionsModule)` →
  شکستن چرخه import (چون Users/Subscriptions هم ممکن است به Admin ارجاع دهند).
- `controllers: [Settings, Users, Dashboard, Conversations]` — دقت: `AdminFilesController`
  این لیست **نیست**! (دلیلش در بخش ۶).
- `exports: [SettingsService]` → ماژول‌های دیگر (مثل Chat برای خواندن
  system prompt و سقف توکن) فقط با import این ماژول به تنظیمات می‌رسند.

**چرا در NestJS وجود داره؟**
تعریف scope و reuse: هرچه مدیریتی است یک‌جا جمع، DI کانتینر بداند چه چیزی
کجاست، و سرویس تنظیمات برای کل سیستم قابل مصرف باشد.


## ۲) `admin-settings.controller.ts` — درگاه تنظیمات

**این فایل چیه؟** `@Controller('admin/settings')` با هر دو گارد در سطح کلاس.
**کار:** `GET /` = همه تنظیمات + نقش‌های داینامیک از `users.listDistinctRoles()`؛
`PUT /` با `forbidNonWhitelisted:true` یعنی فیلد اضافه = خطای ۴۰۰ (سخت‌گیرانه‌تر
از auth چون تنظیمات حساس است) → `settings.update(dto)`.
**ارتباط:** SettingsService + UsersService. **چرا در Nest؟** Transport نازک روی Domain.

## ۳) `admin-users.controller.ts` — مدیریت کاربران

**این فایل چیه؟** پرحجم‌ترین کنترلر: لیست/ویرایش/وضعیت/حذف کاربر.
**کار:**
- `GET /admin/users` → شش کوئری موازی (`Promise.all`) + resolve زنده سقف مؤثر
  هر کاربر (شخصی ← اشتراک ← نقش ← سراسری؛ ادمین=نامحدود) با توابع خالص +
  `EntitlementService` (با `@Optional @Inject(forwardRef)` تا بدون آن ماژول نشکند) +
  محاسبه `remainingPercent` و `usedCostUsd` + جست‌وجو/پیجینیشن با `ApiFeatures.applyToArray`.
- `PATCH :userId` → `users.updateByAdmin`؛ `PATCH :userId/status` → فعال/غیرفعال؛
  `DELETE :userId` (۲۰۴) → حذف نرم + ضد خودکشی ادمین (`currentAdmin.sub===id` → ۴۰۰).
**چرا در Nest؟** Controller ارکستراتور: جمع چند منبع در یک DTO غنی، بدون منطق سهمیه.

## ۴) `admin-dashboard.controller.ts` — آمار فقط-خواندنی

## ۵) `admin-conversations.controller.ts` — بازبینی گفتگوها

**این فایل چیه؟** `@Controller('admin/conversations')` با هر دو گارد؛ خواندن و
حذف نرم گفتگوی کاربران برای ممیزی.
**کار:** `GET /` = همه گفتگوهای حذف‌نشده با relation کاربر+پیام، نگاشت به DTO
خلاصه (عنوان، ایمیل/نام کاربر، تعداد پیام حذف‌نشده) + `ApiFeatures`؛
`GET :id` = جزئیات با پیام‌های مرتب صعودی + fallback سه‌مرحله‌ای اگر relation
موجود نبود (با attachments، بی‌attachments، فقط خود گفتگو)؛ `DELETE :id` (۲۰۴) =
حذف نرم گفتگو + حذف نرم همه پیام‌هایش.
**چرا در Nest؟** ممیزی read-heavy با همان الگوی تزریق ریپازیتوری؛ منطق soft-delete
به‌جای delete فیزیکی برای حفظ audit.

## ۶) `admin-files.controller.ts` — مدیریت فایل‌ها (نکته معماری!)

**این فایل چیه؟** `@Controller('admin/files')` با هر دو گارد؛ آمار/لیست/جزئیات/
دانلود/تلاش‌مجدد/حذف فایل‌های همه کاربران.
**کار:** `GET stats` (شمارش total/processing/ready/error + جمع بایت)؛ `GET /` با
QueryBuilder + `ApiFeatures` زنجیره‌ای (filter/search/sort/paginate)؛
`GET :id` جزئیات با ترمیم نام فارسی؛ `GET :id/content` استریم دانلود با
`@Res()` و هدرهای `Content-Disposition` فارسی-safe؛ `POST :id/retry` برگرداندن به
صف پردازش؛ `DELETE :id` (۲۰۴) via `filesService.deleteFile`.
**نکته معماری مهم:** فایل از نظر فیزیکی در پوشه `admin/` است ولی در
`controllers: [FilesController, AdminFilesController]` **داخل `FilesModule`**
ثبت شده، نه `AdminModule`! چرا؟ چون به `FilesService` و `QueueManagerService`
نیاز دارد که در FilesModule ساخته می‌شوند. اگر در AdminModule ثبت می‌شد چرخه
Admin↔Files پیش می‌آمد. پس «مالکیت دامنه‌ای» (admin) از «محل ثبت DI» (files)
جدا شده — تصمیم آگاهانه برای جلوگیری از circular dependency.
**چرا در Nest؟** نمونه حل چرخه ماژول با جابه‌جایی ثبت کنترلر.

## ۷) `settings.service.ts` — مغز تنظیمات (`@Injectable`)

**این فایل چیه؟** سرویس key-value روی جدول `system_settings` + مجموعه‌ای از
توابع خالص (`resolveEffectiveTokenLimit`, `resolveLimitSource`,
`resolveEffectiveMessageLimit`, `computeRemainingPercent`, `resolveModelAccess`)
که بیرون کلاس export شده‌اند تا هم کنترلر ادمین و هم Chat/Frontend منطق یکسان
داشته باشند و به‌راحتی unit-test شوند.
**کار:** `get/set` پایه با default مقاوم (اگر جدول نبود default برمی‌گردد تا
تست/بوت اولیه نشکند)؛ گترهای تایپ‌دار (سقف سراسری، نرخ دلار، system prompt،
سهمیه جست‌وجو، نقش‌ها، ضرایب، modelAccess) با sanitize ورودی خراب (به‌جای throw،
نادیده می‌گیرد تا هرگز جلوی چت را نگیرد)؛ `getAll()` همه تنظیمات یک‌جا؛
`update(dto)` نوشتن تکی + merge نقش‌ها (ویرایش یک نقش بقیه را پاک نکند) و
نرمال‌سازی اعداد فارسی با `normalizeNumericValue`.
اولویت سقف: شخصی (مثبت) ← نقش ← سراسری؛ `0` یعنی نامحدود.
**چرا در Nest؟** Provider تزریق‌پذیر + export برای کل سیستم؛ توابع خالص جدا از
IO برای تست‌پذیری — استاندارد Service چاق.

## ۸) `system-setting.entity.ts` — جدول key-value

**این فایل چیه؟** `@Entity('system_settings')` با کلید اصلی رشته‌ای `key`،
مقدار متنی `value` (همه‌چیز string ذخیره، موقع خواندن parse می‌شود) و
`updatedAt` خودکار.
**چرا key-value و نه ستون جدا؟** تنظیمات جدید بدون migration اضافه می‌شود؛
انعطاف برای پنل ادمین که هر هفته گزینه جدید می‌خواهد. هزینه‌اش parse موقع خواندن.
**چرا در Nest/TypeORM؟** Entity قرارداد کد با جدول؛ همین یک جدول کل پیکربندی
سیستم را نگه می‌دارد.

## ۹) `dto.ts` — قرارداد ورودی ادمین

**این فایل چیه؟** `UpdateSettingsDto` (همه فیلدها `@IsOptional` چون PUT تنظیمی
پارشیال است؛ اعداد با `@Transform(normalizeNumericValue)` تا ارقام فارسی/رشته
هم قبول شود + `@Min` + پیام فارسی)، `UpdateUserAdminDto` (نقش فقط `user|admin`،
ایمیل معتبر، `tokenLimit/messageLimit` قابل null یعنی حذف سقف)،
`UpdateUserStatusDto` (فقط `isActive: boolean` الزامی).
**چرا در Nest؟** مرز Validation؛ ترکیب با `forbidNonWhitelisted` یعنی کلید
ناشناس در تنظیمات = ۴۰۰، چون تنظیم اشتباه از ورودی اشتباه خطرناک‌تر است.

## جمع‌بندی یک‌خطی

| فایل | در یک جمله |
|---|---|
| `admin.module.ts` | سیم‌کشی DI؛ ثبت ۴ کنترلر و export تنظیمات برای کل سیستم |
| `admin-settings.controller.ts` | درگاه key-value؛ GET همه + PUT سخت‌گیرانه |
| `admin-users.controller.ts` | ارکستراتور کاربر؛ سقف مؤثر زنده + ضد خودکشی ادمین |
| `admin-dashboard.controller.ts` | read-model آماری مقاوم؛ یک خرابی همه را نمی‌خواباند |
| `admin-conversations.controller.ts` | ممیزی گفتگو؛ حذف نرم آبشاری |
| `admin-files.controller.ts` | مدیریت فایل ادمین ولی ثبت‌شده در FilesModule (ضد چرخه) |
| `settings.service.ts` | مغز key-value + توابع خالص سهمیه قابل تست |
| `system-setting.entity.ts` | یک جدول برای همه تنظیمات؛ بدون migration برای گزینه جدید |
| `dto.ts` | قرارداد پارشیال با نرمال‌سازی اعداد فارسی |


**این فایل چیه؟** مستقیم به ۵ ریپازیتوری + SettingsService وصل است؛ سرویسی ندارد
چون کارش aggregate است.
**کار:** `GET stats` = یازده کوئری موازی (countها + `SUM(usedTokens)` با fallback جمع
در JS + تنظیمات + لایک/دیسلایک) و `satisfactionRate`؛ هر کوئری `.catch(()=>0)` تا یک
خرابی کل داشبورد را نخواباند. `GET feedback` = آخرین ۳۰ پیام دارای بازخورد با snippet.
**چرا در Nest؟** Read-model جدا: `@InjectRepository` مستقیم استاندارد همین سناریوست.
