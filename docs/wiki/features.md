# Features

## Data-Authoritative Identity & Quota Sync (role + session + sidebar)
- منبع حقیقت برای نقش و وضعیت کاربر، دیتابیس است: در مسیرهای حساس مانند لیست مدل‌ها، مسیرهای ادمین و روتینگ فرانت‌اند، نقش با `findById` از دیتابیس دوباره خوانده می‌شود و در صورت نبود، به نقش موجود در JWT به‌عنوان fallback ایمن بازمی‌گردد.
- این تغییر برای سناریوی «تغییر نقش از کاربر عادی به مدیر سیستم با توکن قدیمی» اهمیت دارد: بعد از ارتقاء/تنزل نقش، دسترسی‌ها بدون نیاز به خروج و ورود دوباره با همان توکن قدیمی به‌روزرسانی می‌شوند.
- درصد باقیمانده سهمیه در سایدبار از `GET /chat/quota` برای همان کاربر فعلی می‌آید، نه از snapshot قدیمی localStorage یا محاسبهٔ ثابت اولیه؛ بنابراین بین چند مدیر یا کاربران مختلف، نمایش درصد همیشه مربوط به session واقعی است.
- روتینگ فرانت‌اند برای مسیر `/admin` هم از `identity.role` تازه‌خوانده‌شده استفاده می‌کند و دیگر به `localStorage.user.role` قدیمی اعتماد نمی‌کند.

## Final Provider Rule (provider toggles removed; only default-model protection remains)
- قانون نهاییِ محصول این است که ویژگی فعال/غیرفعال‌کردن ارائه‌دهنده به‌صورت کامل از پنل ادمین و قرارداد API حذف شده است.
- این وضعیت دیگر به‌عنوان کنترل کسب‌وکار برای مدل‌ها یا چت استفاده نمی‌شود و هیچ مسیر فرانت‌اند/بک‌اند نباید روی `provider.isActive` برای مسدودسازی مدل یا چت تکیه کند.
- تنها قاعدهٔ باقیمانده در سطح مدل است: مدل پیش‌فرض نمی‌تواند غیرفعال شود مگر اینکه ابتدا یک مدل پیش‌فرض جدید انتخاب شود؛ و همیشه فقط یک مدل پیش‌فرض در سطح سیستم مجاز است.
- این قاعده به‌صورت سرور-ساید اعمال می‌شود تا هرگونه حالت ناسازگار یا optimistic UI نتواند با غیرفعال‌کردن مدل پیش‌فرض، سیستم را به حالت نامعتبر ببرد.

## Model Access Management (public / commercial / private by user groups)
- هر مدل یک `accessLevel` دارد: **عمومی** (همه کاربران)، **تجاری** (فقط نقش‌های مجاز) و **اختصاصی** (فقط کاربران وایت‌لیست‌شده روی خود مدل در `allowedUserIds`). مدل‌های موجود در migration روی «عمومی» ست شدند تا هیچ کاربری دسترسی از دست ندهد.
- نگاشت «نقش ← سطوح مجاز» در `system_settings` با کلید `model_access` ذخیره می‌شود (پیش‌فرض: `user` فقط عمومی، `admin` همه سطوح؛ نقش `admin` همیشه همه سطوح را دارد). افزودن نقش جدید (مثل `premium`) فقط با تیک «دسترسی به مدل‌های تجاری» در پنل ادمین است — بدون تغییر کد.
- تابع خالص `resolveModelAccess` تنها مرجع تصمیم است و در سه نقطه اعمال می‌شود: `GET /models` (لیست کاربر بر اساس JWT)، `POST/GET /chat/...` (بلاک `create`/`setModel`/`generate` با خطای فارسی «به این مدل دسترسی ندارید») و `GET /models/default` (اگر پیش‌فرض برای کاربر مجاز نبود، اولین مدل مجاز برمی‌گردد).
- **پنل ادمین:** ستون «دسترسی» با بج `ModelAccessBadge` در جدول مدل‌ها؛ در مودال ویرایش/افزودن مدل، `ModelAccessPicker` سطح دسترسی را انتخاب و برای مدل اختصاصی وایت‌لیست کاربران را با جستجو و انتخاب چندتایی مدیریت می‌کند؛ جدول نقش‌ها ستون «دسترسی مدل تجاری» و در مودال نقش سوییچ همان دسترسی را دارد (برای admin قفل است).
- به‌روزرسانی‌ها **optimistic** هستند (ذخیره/حذف/تغییر وضعیت مدل و ذخیره تنظیمات نقش بلافاصله در UI اعمال و در صورت خطا rollback می‌شوند) و بارگذاری اول پنل با **Skeleton خود shadcn** (`AdminTableSkeleton`) نمایش داده می‌شود.

## Soft Delete for All Entities
- تمام حذف‌های سیستم اکنون soft است: به `users`، `ai_models` و `ai_providers` فیلد `isDeleted` اضافه شد و اندپوینت‌های `DELETE /admin/users/:id`, `DELETE /admin/models/:id` و `DELETE /admin/providers/:id` به‌جای حذف فیزیکی، رکورد را فلگ می‌کنند (حذف پرووایدر به‌صورت نرم روی مدل‌هایش هم کسکید می‌شود).
- رکوردهای soft-deleted از همه لیست‌ها/lookupها مخفی‌اند و کاربر حذف‌شده دیگر نمی‌تواند لاگین کند یا از توکنش استفاده کند (`findByEmail`/`findById`/`findByUsername` فیلتر `isDeleted: false` دارند).
- Migration `1761600000000`: کسکیدهای فیزیکی `conversations.userId` و `file_attachments.userId` از `ON DELETE CASCADE` به `SET NULL` تغییر کرد تا حذف فیزیکی آتی (purge) هرگز تاریخچه گفتگوها/فایل‌ها را نابود نکند. گفتگوها، پیام‌ها و فایل‌ها از قبل soft بودند و تغییری نکردند.

## Streaming Auto-Scroll Follow Fix
- هنگام استریم پاسخ مدل، اگر کاربر به بالا اسکرول کند و سپس به پایین برگردد، دنبال‌کردن خودکار استریم دیگر قفل نمی‌شود: با بازگشت به نزدیکی ته صفحه (آستانه ۱۲۰px) اسکرول خودکار از سر گرفته می‌شود.
- اسکرول آروم به بالا هم دیگر با استریم «مقاومت» نمی‌کند: تشخیص بر اساس **جهت اسکرول** است — هر حرکت رو به بالا (`scrollTop < lastScrollTop`) چون اسکرول‌های برنامه‌ای فقط رو به پایین‌اند، قصد کاربر محسوب شده و follow بلافاصله و نرم خلع می‌شود، حتی داخل آستانه ۱۲۰px.
- پیاده‌سازی فقط با listener `scroll` و پرچم `shouldAutoScroll` انجام شد؛ listenerهای `wheel`/`touchstart` و منطق debounce پرچم کاربر حذف شدند.

## Chat History Scroll Fix
- پس از باز شدن یا پایان بارگذاری تاریخچهٔ گفتگو، نمای پیام‌ها به آخرین پیام منتقل می‌شود؛ این رفتار حتی هنگام جایگزینی تاریخچه با همان تعداد پیام نیز حفظ می‌شود.
- اسکرول دستی کاربر و دنبال‌کردن پاسخ استریم همچنان طبق رفتار قبلی کار می‌کنند.

## Admin Numeric Input Normalization
- تمام فیلدهای عددی پنل ادمین، ارقام فارسی، عربی و انگلیسی را می‌پذیرند و جداکنندهٔ اعشار فارسی/عربی نیز به‌درستی تبدیل می‌شود.
- اعداد خروجی در جدول‌ها، pagination، حجم فایل، مدت پردازش و نرخ‌های عددی نیز با رقم فارسی نمایش داده می‌شوند.
- نرمال‌سازی در فرانت‌اند و validation بک‌اند انجام می‌شود؛ مقدار نهایی همچنان `number`/`integer` است و schema یا نوع ستون‌های دیتابیس تغییر نکرده است.

## Task 42: Deep Thinking / Reasoning, Model Capabilities Matrix & Feature Tariffs (v1.4.0)
- **پشتیبانی کامل از تفکر عمیق و استدلال (`Deep Thinking / Reasoning`)**:
  - استریم تفکیک‌شده محتوای استدلال مدل از طریق لایه `StreamAdapter` و `OpenAICompatAdapter` با قابلیت استخراج تگ‌های `<think>...</think>`.
  - کامپوننت باز و بسته شونده `ThinkingBlock.vue` با کورنومتر زنده فارسی (`در حال فکر کردن (۳ ثانیه)...`)، انیمیشن نبض بنفش، کپی استدلال و فرمت‌بندی مارک‌داون.
  - ماندگاری کامل متن استدلال در دیتابیس (`reasoning_content` و `thinking_duration_ms`).
- **ماتریس قابلیت‌های مدل (`Model Capabilities Matrix`)**:
  - ثبت قابلیت‌های چهارگانه هر مدل (`supportsThinking`, `supportsVision`, `supportsDocument`, `thinkingBudgetTokens`) در دیتابیس و پنل ادمین.
  - پنهان‌سازی شرطی گزینه‌های تفکر عمیق در کامپوزر بر اساس پشتیبانی مدل انتخابی و نمایش بج `CapabilityBadge`.
  - گارد و اعتبارسنجی ارسال فایل‌های دیداری (عکس) و اسناد متناسب با قابلیت مدل انتخابی با پیام‌های خطای راهنما به زبان فارسی.
- **تعرفه‌گذاری و محاسبه ضرایب مصرف توکن (`Feature Tariffs`)**:
  - تعیین ضریب مصرف توکن برای جستجوی زنده وب (پیش‌فرض ۱.۲×) و تفکر عمیق (پیش‌فرض ۱.۳×).
  - محاسبه مصرف مرکب توکن در `ChatService` بر اساس استفاده همزمان از قابلیت‌ها.
- **گالری تصاویر ارسالی با لایت‌باکس تعاملی و امکان جابجایی (`Sent Images Gallery & Interactive Lightbox`)**:
  - تصاویر ارسالی کاربر در پیام‌ها به صورت گالری شکیل و مدرن نمایش داده می‌شوند.
  - لایت‌باکس تمام‌صفحه با شمارنده وسط‌چین و ثابت (`.lightbox-counter`)، کنترل‌های کیبورد و جابجایی با تصاویر بندانگشتی.

## Task 41: Real-Time Streaming Synchronization & Elimination of Sudden End Jumps (v1.4.3)
- **همگام‌سازی واقعی استریمینگ فرانت‌اند با بک‌اند و رفع پرش ناگهانی متن‌های طولانی (`Streaming Synchronization`)**:
  - حذف بافر صف کاراکترها و افزودن مستقیم و همگام توکن‌ها به `currentStreamingText` در استور چت، مطابق با پالس ۲۵ میلی‌ثانیه‌ای سرور.

## Task 40: Persian/Arabic File Name & Content Encoding Fix (v1.4.3)
- **اصلاح اساسی و قطعی انکودینگ نام فایل‌های فارسی و عربی (`Mojibake Resolution`)**:
  - بازنویسی `fixUtf8MangledString` با پشتیبانی کامل از جدول کدهای CP1252 و هدر کلاینت `X-Original-Filename` با مایگریشن اصلاح رکوردهای قدیمی دیتابیس.

## Task 39: Conversation Pinning & 3-Dots Action Menu (v1.4.2)
- **منوی عملیات سه‌نقطه در سایدبار و پین کردن گفتگوها**:
  - ستون `isPinned` در دیتابیس، منوی شناور سه‌نقطه در سایدبار، مرتب‌سازی همیشگی گفتگوهای پین‌شده در بالاترین بخش لیست.

## Task 38: Periodic Quotas and Task-Type Cost Multipliers (v1.4.0)
- سهمیه‌های توکن و تعداد پیام با دوره تنبل ساعتی (پیش‌فرض ۶ ساعت) در سطح نقش و کاربر؛ ثبت تفکیک‌شده مصرف انواع کار در `usageByType`.

## Task 37: Per-Role Global Token Limits in Admin Panel (v1.3.3)
- سقف توکن به ازای نقش در تنظیمات سیستم، اولویت سه‌لایه (کاربر ← نقش ← سراسری)، و محاسبه سقف مؤثر زنده روی جدول کاربران.

## Task 36: Show-Once Error Messages, Draft & Upload Persistence, Admin Model Connectivity Ping & Message Likes/UX Dashboard (v1.3.2)
- **نمایش تک‌باره پیام‌های خطا در چت (`Show-Once Dismissible Errors`)**:
  - پیام‌های خطای استریمینگ چت پس از بسته شدن توسط کاربر (کلیک روی ✕) در `sessionStorage` ثبت شده و مجدداً با رفرش صفحه یا اتصال‌های بعدی نمایش داده نمی‌شوند.
  - با ارسال پیام جدید توسط کاربر، تاریخچه خطاهای بسته‌شده آن گفتگو ریست می‌شود تا خطاهای احتمالی جدید به موقع اطلاع‌رسانی گردند.
- **ماندگاری پیش‌نویس متن کاربر در کامپوزر (`Composer Text Draft Persistence`)**:
  - متن تایپ‌شده کاربر به ازای هر گفتگو در `sessionStorage` (کلید `chat_draft_<convId>`) به شکل بلادرنگ ذخیره می‌شود.
  - رفرش مرورگر یا تغییر گفتگوها متن تایپ‌شده را پاک نمی‌کند و با بازگشت به همان گفتگو مجدداً لود می‌گردد. پس از ارسال موفق، پیش‌نویس پاک می‌شود.
- **ماندگاری فایل‌ها و تصاویر آپلودشده (`Uploaded File Persistence`)**:
  - فایل‌ها و تصاویری که آپلود شده و وضعیت `ready` دارند در `sessionStorage` به ازای هر چت ذخیره می‌شوند.
  - با رفرش صفحه یا سوئیچ میان گفتگوها، فایل‌های آپلودشده حفظ شده و نیازی به آپلود مجدد آن‌ها در سرور/MinIO وجود ندارد.
- **تست اتصال و سلامت مدل در پنل ادمین (`Admin Model Connectivity Test`)**:
  - افزودن دکمه «تست اتصال مدل» در مدال ایجاد/ویرایش مدل (`ModelEditorModal.vue`) و اندپوینت اختصاصی `POST /admin/models/test` در بک‌اند.
  - ادمین پیش از ذخیره‌سازی می‌تواند اتصال مدل به پرووایدر، کلید API و شناسه مدل را با یک پینگ سبک اعتبارسنجی کرده و نتیجه را به همراه تاخیر زمانی (ms) و خلاصه پاسخ مشاهده نماید.
- **سیستم لایک و دیس‌لایک پیام‌ها و پایش تجربه کاربر در داشبورد (`Message Feedback & UX Dashboard`)**:
  - افزودن دکمه‌های بازخورد لایک (👍) و دیس‌لایک (👎) به حباب پیام‌های دستیار (`MessageBubble.vue`) با وضعیت فعال و توست فارسی.
  - اندپوینت اختصاصی `PATCH /chat/conversations/:id/messages/:messageId/feedback` و ستون `feedback` در جدول پیام‌ها.
  - کارد آماری پنجم در داشبورد ادمین برای نمایش کلی درصد رضایت کاربران و مجموع لایک‌ها/دیس‌لایک‌ها.
  - بخش اختصاصی «ارزیابی تجربه کاربری و شاخص کلی رضایت» در داشبورد ادمین شامل آمار کل لایک‌ها، دیس‌لایک‌ها و درصد رضایت به صورت تجمیعی (بدون افشای لیست یا محتوای گفتگوهای کاربران).
- **پایش و سلامت سرویس SigNoz APM**:
  - بررسی کانتینرهای داکر SigNoz (پورت ۳۳۰۱ برای وب‌سایت و ۴۳۱۷/۴۳۱۸ برای OpenTelemetry ingester) و تایید سلامت عملکرد لاگ‌ها و تریس‌ها.

## Task 35: Strict Server-Side DataGrid Queries (Search, Filter, Pagination, Sorting) & Fixed Viewport Admin Sidebar (v1.3.1)
- **اتصال قطعی و ۱۰۰٪ سمت سرور برای تمامی جداول و صفحات ادمین (`Strict Server-Side DataGrid Queries`)**:
  - فعال‌سازی پرچم `:serverSide="true"` در تمام بخش‌های ادمین (`AdminUsersSection`, `AdminChatsSection`, `AdminFilesSection`, `AdminModelsSection`, `AdminProvidersSection`).
  - ممانعت از فیلترینگ یا برش آرایه‌ها در فرانت‌اند؛ هرگونه تایپ در کادر جستجو، فیلتر ستونی، تغییر شماره یا اندازه صفحه و کلیک روی هدرهای مرتب‌سازی بلافاصله به صورت کوئری به بک‌اند ارسال می‌شود (`page`, `limit`, `search`, `sortBy`, `sortOrder`, `role`, `status`, ...).
  - پیاده‌سازی کلاس `ApiFeatures` با قابلیت هماهنگ‌سازی اتوماتیک نام ستون‌ها (`name -> originalName`, `size -> fileSize`).
- **سایدبار کاملاً فیکس و مستقل از اسکرول صفحه (`Permanently Fixed Viewport Sidebar`)**:
  - سایدبار با استایل قطعی `position: fixed; top: 0; bottom: 0; right: 0; width: 250px; height: 100vh; overflow-y: auto;` به لبه صفحه قفل شد.
  - پوسته کلی `.admin-shell` به صورت `height: 100vh; width: 100vw; overflow: hidden;` قفل گردید و کل اسکرول عمودی به `.admin-main` با `margin-right: 250px; height: 100vh; overflow-y: auto;` منتقل شد.
  - اسکرول جداول یا محتوای صفحات هیچ اثری روی جایگاه سایدبار نگذاشته و سایدبار همواره در جای خود ثابت می‌ماند.
  - سازگاری واکنش‌گرا در موبایل با دراور بازشو و لایه بلور پس‌زمینه.

## Task 34: Admin Panel Architecture Modularization, Per-Page Routing, Server-Side ApiFeatures & Session Expiration (v1.3.0)
- **تفکیک کامل و ماژولار پنل ادمین به صفحات و مدال‌های مجزا (`Modular Admin Architecture`)**:
  - شکستن فایل ۴٬۳۸۰ خطی مونولیتیک به ۸ صفحه اختصاصی در `frontend/src/views/admin/` و ۵ کامپوننت مدال اختصاصی در `frontend/src/components/admin/modals/`.
- **روتینگ مستقل زیرمسیرهای ادمین در Vue Router (`Nested Admin Sub-routes`)**:
  - تعریف مسیرهای مجزا برای هر بخش (`/admin/dashboard`, `/admin/models`, `/admin/users`, `/admin/providers`, `/admin/prompts`, `/admin/chats`, `/admin/files`, `/admin/file-settings`).
  - بارگذاری تنبل و باندلینگ بهینه کدها (Code Splitting & Lazy Loading).
- **لود ایزوله داده به ازای هر صفحه (Zero Bulk Fetching on Dashboard)**:
  - داشبورد صرفاً آمارهای خود را دریافت می‌کند و هیچ داده سنگینی از سایر بخش‌ها لود نمی‌شود.
- **پردازش سراسری سمت سرور با ApiFeatures**:
  - اتصال تمام ۵ اندپوینت ادمین به `ApiFeatures` برای فیلتر ستونی، سرچ متنی، مرتب‌سازی و پیجینیشن.
- **سایدبار چسبنده و فیکس در دسکتاپ و دراور در موبایل (`Sticky Viewport Sidebar`)**:
  - جلوگیری از اسکرول خوردن سایدبار هنگام مرور جداول طولانی.
- **اتصال قطعی لاگ‌اوت به سرور و ابطال توکن (`Backend Logout & Token Revocation`)**:
  - هندلینگ اندپوینت `POST /api/v1/auth/logout` با لیست سیاه توکن‌ها (`AuthService.revoked`) و ممانعت `JwtAuthGuard` از پذیرش توکن‌های باطل‌شده.
- **پایش ۴ لایه انقضای توکن و خروج خودکار (`Proactive Auto-Logout`)**:
  - ممانعت خودکار از باقی‌ماندن کاربر در صفحه هنگام انقضای JWT یا عدم وجود توکن.

## Task 33: DataGrid Upgrade, Backend ApiFeatures, Image Tokens, SigNoz APM & Bugfixes (v1.2.4 Patch)
- **کلاس سراسری و زنجیره‌ای `ApiFeatures` در بک‌اند (`backend/src/shared/api-features.ts`)**:
  - مدیریت استاندارد و یکپارچه جستجوی متنی روی چندین فیلد (`ILIKE %q%`)، فیلتر ستونی، مرتب‌سازی داینامیک صعودی/نزولی (`sortBy`, `sortOrder`) و صفحه‌بندی هوشمند (`skip`, `take`) برای کوئری‌بیلدرهای TypeORM و آرایه‌های درون‌حافظه.
  - اعمال مستقیم در کنترلرهای ادمین (`/admin/users`, `/admin/files`, `/admin/conversations`).
- **ارتقای کامپوننت جدول به DataGrid کامل (`AdminTable.vue`)**:
  - ردیف فیلتر ستونی شناور زیر هر سرستون (Inline Column Filter Row) مشابه MUI DataGrid با امکان فیلتر مستقل روی هر ستون.
  - دکمه تاگل فیلترهای ستونی و پاک‌سازی سریع فیلترها.
  - امکان مرتب‌سازی ستونی با کلیک روی هدر و نشانگرهای صعودی/نزولی.
  - انتخاب اندازه صفحه (۱۰، ۲۵، ۵۰، ۱۰۰ آیتم در هر صفحه) با ارقام فارسی و صفحه‌بندی هوشمند.
  - جلوگیری قطعی از درهم‌ریختگی جدول در موبایل و تضمین اسکرول افقی روان (`overflow-x: auto; min-width: 720px`).
  - وضعیت خالی درون‌جدولی زیبا (`Empty State` در تگ `<tbody><tr><td :colspan="...">`).
- **شفاف‌سازی فیلدهای تحت جستجو در بالای صفحه (هدر)**:
  - تعیین دقیق دامنه‌ی جستجو برای هر بخش به همراه چیپ‌های فیلدهای مورد جستجو (مثلاً: نام مدل، شناسه API، ارائه‌دهنده).
- **نمایش دایره‌ای محدودیت و مصرف توکن کاربران (Circular Progress Gauge)**:
  - حلقه گرافیکی SVG با قطر ۴۴ پیکسل برای نمایش بصری درصد پر شده سهمیه کاربر (`usedPercent`).
  - تفکیک رنگی هوشمند: سبز برای مصرف کمتر از ۷۰٪، زرد برای ۷۰٪ تا ۹۰٪، قرمز برای بالای ۹۰٪ یا اتمام اعتبار.
  - نمایش مقادیر دلاری و توکنی مصرف‌شده و سقف کل.
- **تثبیت و تغییرناپذیری توکن مصرفی کاربر (`Immutable Used Tokens`)**:
  - توکن‌های مصرف‌شده کاربر (`usedTokens`) فقط‌خواندنی بوده و از پیلودهای ویرایش حذف شدند.
- **اصلاح باگ شارژ کاربر و دکمه‌های شارژ سریع دلاری (`User Credit Recharge Fix & Quick Top-Up`)**:
  - رفع باگ عدم امکان ورود ارقام در ورودی سقف اعتبار با هندلینگ صحیح رویدادها و همگام‌سازی دوطرفه دلار/توکن.
  - دکمه‌های شارژ سریع ۱۰+، ۲۵+، ۵۰+ و ۱۰۰+ دلار برای افزایش فوری سقف اعتبار با یک کلیک.
- **ارسال پیام حاوی فایل بدون نیاز به متن و رفع باگ ماندگاری فایل (`Attachment-Only Messages & File Retention`)**:
  - امکان ارسال پیام فقط با پیوست فایل/تصویر بدون نیاز به تایپ متن (`hasText || hasFiles`).
  - تخصیص عنوان چت بر مبنای نام اولین فایل پیوستی.
  - معافیت و ماندگاری قطعی فایل‌های ارسال‌شده در چت از پاکسازی خودکار ۴۸ ساعته.
- **هشدار فوری و مسدودسازی آنی ارسال در صورت اتمام اعتبار کاربر (`Instant Token Exhaustion Feedback`)**:
  - نمایش پیام دقیق «توکن مصرفی شما به پایان رسید» در بنر کامپوزر و toast و مسدودسازی ارسال در کلاینت.
- **محاسبه توکن تصاویر بر اساس ابعاد و حجم (`Multimodal Image Tokens`)**:
  - فرمول استاندارد کاشی‌های ۵۱۲×۵۱۲ (۱۷۰ توکن هر کاشی + ۸۵ توکن پایه) و فرمول حجمی.
- **جستجوی درون‌گفتگو در پنل ادمین با اسکرول خودکار (`In-Chat Search & Auto-Scroll`)**:
  - نوار جستجوی پیشرفته در پنجره بررسی چت‌های کاربر با هایلایت و اسکرول نرم (`scrollIntoView`).
- **مدیریت کامل فایل‌ها و یکپارچه‌سازی SigNoz APM**:
  - کنترلر اختصاصی `AdminFilesController`، پایش فایل‌ها و اکسپورتر OTel به داشبورد SigNoz (پورت ۳۳۰۱).
- **قالب‌بندی استاندارد تاریخ و زمان رسمی ایران (`Asia/Tehran Date & Time`)**:
  - کتابخانه `src/lib/date.ts` برای نمایش تاریخ و ساعت رسمی ایران با اعداد فارسی.
- **یکپارچه‌سازی تایپوگرافی با فونت «وزیرمتن» (`Universal Vazirmatn Typography`)**:
  - فونت پیش‌فرض سراسر برنامه در `main.css`.

## Task 32: File Uploads, Attachment Preservation on Retry, Gemini 3.5 Flash Vision & Text/Markdown Document Support
- **پشتیبانی از اسناد متنی و مارک‌داون (`TXT` و `MD`)**:
  - امکان آپلود و ارسال انواع فایل‌های متنی ساده (`.txt`) و اسناد ساختاریافته مارک‌داون (`.md`, `.markdown`).
  - پردازشگر آسنکرون اختصاصی جهت استخراج کامل متن با اینکودینگ UTF-8 و ارسال مستقیم به مدل‌های هوش مصنوعی در چت.
  - نمایش اختصاصی کارد پیش‌نمایش با آیکون متنی و نشانگر `TXT` و `MD`.
- **آپلود فایل و تصاویر با پیش‌نمایش و اعتبارسنجی فرانت و بک‌اند**:
  - پشتیبانی از آپلود تصاویر (PNG, JPG, JPEG, WEBP, GIF, JFIF)، اسناد متنی، اسناد PDF و اکسل با اعتبارسنجی سمت کاربر و سرور.
  - پیش‌نمایش مینیمال تصویر با امکان کلیک و باز شدن مدال تمام‌صفحه لایت‌باکس با کیفیت بالا.
  - استریم محتوای فایل‌ها از طریق اندپوینت امن `GET /api/v1/files/:id/content` با پشتیبانی از احراز هویت توکن جهت نمایش پایدار تصاویر حتی در صورت انقضای blob محلی.
- **حفظ تصاویر در تلاش مجدد پیام (`Attachment Preservation on Retry`)**:
  - هنگام کلیک بر روی «تلاش مجدد» (Retry) پیام کاربر، فایل‌های پیوست حذف نمی‌شوند و دوباره در استور چت و پیام کاربر نگهداری می‌شوند.
  - فرآیند تلاش مجدد نیازی به آپلود مجدد تصویر در MinIO ندارد و از همان شناسه فایل آماده استفاده می‌کند.
- **اصلاح چیدمان و رفع تداخل متون هنگام خطای پردازش فایل (`Error Card Layout Fix`)**:
  - رفع کامل همپوشانی نوشته‌های «خطا در پردازش»، دکمه «تلاش مجدد» و متادیتای فایل در حالت راست‌به‌چپ (RTL).
  - انتقال دکمه تلاش مجدد به صورت فرزند Flex درون ردیف متادیتا با فاصله‌گذاری استاندارد و جلوگیری از برخورد با نام فایل.
  - اضافه شدن نشانگر هشدار (`error-badge`) قرمز رنگ روی بندانگشتی تصویر و هندل کردن خطای لود تصویر با سوئیچ نرم به آیکون SVG.
- **قفل کامپوزر و جلوگیری از ارسال پیام جدید یا آپلود فایل در حین پاسخ‌دهی (`Composer Streaming Lock`)**:
  - در زمان تولید استریم یا لودینگ پاسخ (`isStreaming || isThinking`)، دکمه ارسال مخفی شده و صرفاً دکمه توقف (`Stop`) نمایش داده می‌شود.
  - دکمه پیوست فایل (`+`) غیرفعال شده و کشیدن و رها کردن فایل (Drag & Drop)، پیست کردن فایل یا فشردن کلید Enter مسدود می‌شود و پیام هشدار فارسی نمایش می‌یابد.
  - امکان صف‌بندی پیام در زمان استریم غیرفعال شده تا وضعیت چت همواره همگام و پایدار بماند.
- **معماری تک‌منبعی احراز هویت و اتصال در پرووایدر (`Single-Source Provider Credentials`)**:
  - فیلدهای اضافه `آدرس API (Base URL)` و `کلید API (API Key)` از فرم‌های ایجاد و ویرایش مدل در پنل ادمین حذف شدند.
  - ارائه‌دهنده (Provider) به عنوان منبع واحد و معتبر برای نگهداری `baseUrl` و `apiKey` تعیین شد.
  - مدل صرفاً نام نمایشی، ارائه‌دهنده و شناسه مدل در API (`apiIdentifier`) را دریافت کرده و در زمان چت به طور خودکار به آدرس و توکن پرووایدر والد خود متصل می‌شود.
- **یکپارچه‌سازی و پشتیبانی از گوگل جمینای و تحلیل تصویر (`Gemini 3.5 Flash Vision`)**:
  - اضافه شدن ارائه‌دهنده `Google Gemini` و مدل `gemini-3.5-flash` سازگار با استاندارد چت اوپن‌ای‌آی.
  - شبیه‌سازی و تست ارسال تصویر به جمینای و دریافت استریم پاسخ به زبان فارسی با موفقیت ۱۰۰٪.

## Task 31: Version 1.1.0 Release — Admin Chat Viewer, System Prompt Section, Fixed Sidebar, 3s Search Debounce, Uniform Provider Cards & RTL Enhancements
- **مشاهده و بازرسی چت‌ها در پنل ادمین (`Admin Chat Viewer`)**:
  - ایجاد کنترلر اختصاصی `AdminConversationsController` در بک‌اند با اندپوینت‌های `GET /admin/conversations`، `GET /admin/conversations/:id` و `DELETE /admin/conversations/:id` محافظت شده با `AdminGuard`.
  - اضافه شدن تب «گفتگوها» به پنل ادمین همراه با جدول مشخصات، تعداد پیام‌ها، نام کاربر و مدال کامل مشاهده حباب‌های پیام و تاریخچه کامل گفتگو.
- **بخش اختصاصی پرامپت سیستم در پنل ادمین (`System Prompt Section`)**:
  - اضافه شدن تب مستقل «پرامپت سیستم» به سایدبار ادمین با الگوهای آماده (پیش‌فرض، دستیار برنامه‌نویسی، لحن رسمی، خلاصه ساز)، شمارنده زنده حروف/کلمات/خطوط، و قابلیت ذخیره‌سازی پایدار در دیتابیس.
- **سایدبار کاملاً ثابت و بدون اسکرول پنل ادمین (`Fixed Sidebar`)**:
  - تثبیت دائمی سایدبار (`position: fixed; inset-inline-start: 0; height: 100vh; overflow: hidden;`) تا در هیچ شرایطی اسکرول نخورد و محتوای اصلی به صورت مجزا اسکرول شود.
- **هماهنگ‌سازی کامل کاردهای ارائه‌دهنده‌ها (`Uniform Provider Cards`)**:
  - یکسان‌سازی ارتفاع کاردها با `min-height: 250px` و چیدمان منعطف عمودی، بدون تغییر اندازه یا کشیدگی نامتوازن.
  - حذف برچسب «سیستمی» از ارائه‌دهنده‌ها طبق درخواست.
  - نمایش چیپ‌ها و نام مدل‌های متصل به هر ارائه‌دهنده در پایین کارد مربوطه.
- **دیلی ۳ ثانیه‌ای در جستجوها (`3-Second Debounce`)**:
  - اعمال تاخیر ۳ ثانیه‌ای (۳۰۰۰ میلی‌ثانیه) در سرچ سایدبار چت‌ها و سرچ پنل ادمین جهت جلوگیری از درخواست‌های مکرر و بهبود کارایی.
  - حذف نوار جستجو از تب داشبورد و تب پرامپت‌ها.
- **قانون جهت متن در اینپوت برای عبارات ترکیبی فارسی و انگلیسی (`RTL Direction Rule`)**:
  - تنظیم تابع `getActiveTypingDirection` به شکلی که در صورت وجود هرگونه کاراکتر فارسی (حتی در متن‌های ترکیبی فارسی و انگلیسی)، جهت متن حتماً `rtl` باشد و صرفاً در صورت انگلیسی خالص `ltr` شود.
- **رفع تداخل پلیس‌هولدر و حذف سایه مدال‌ها**:
  - حذف کامل `box-shadow` از مدال‌ها (`AdminModal`، `ModelsModal`، `SearchModal`).
  - اصلاح فاصله‌گذاری ورودی سرچ با ویژگی‌های منطقی (`padding-inline-start: 38px`) جهت رفع همپوشانی آیکون و پلیس‌هولدر.

## Task 30: Admin Panel Overhaul, Custom AdminTable, Edit/Delete Modals & Token Quotas (بازطراحی و ارتقای پنل ادمین، کامپوننت جدول، مدال‌های ویرایش/حذف و سهمیه توکن)
- **کاردهای مینیمال با فواصل استاندارد**: بازطراحی کاردهای آماری شاخص‌های کلیدی (KPIs) با فواصل استاندارد ۲۰ پیکسلی (`gap-5`)، حاشیه‌های ظریف، سایه‌های ملایم و پس‌زمینه کارت متوازن در `AdminPanelView.vue`.
- **سایدبار ثابت و چسبان (`Sticky / Fixed Sidebar`)**: ثابت‌سازی سایدبار ادمین (`position: sticky; top: 0; height: 100vh; overflow-y: auto;`) تا در زمان اسکرول کردن محتوا و جداول طولانی همواره در دسترس و ثابت بماند.
- **کامپوننت اختصاصی جداول (`AdminTable.vue`)**: ساخت کامپوننت ماژولار جداول با قابلیت سفارشی‌سازی هدرها، اسلات سطرهای دلخواه، هاور ملایم و حالت خالی با پیام و آیکون فارسی.
- **مدال‌های اختصاصی ویرایش و حذف**:
  - جایگزینی کامل `window.confirm` با `DeleteConfirmModal.vue` همراه با حالت لودینگ و غیرفعال‌سازی دکمه در زمان اجرا.
  - انتقال فرم‌های ایجاد و ویرایش مدل و ارائه‌دهنده به مدال‌های اختصاصی با فیلدهای از پیش پر شده.
  - ساخت مدال اختصاصی ویرایش کاربر با فیلدهای از پیش پر شده (نام، ایمیل، نقش، سقف توکن، و امکان ریست مصرف توکن).
  - **حذف دکمه حذف کاربر**: در جدول کاربران، دکمه حذف کاملاً حذف شده و فقط دکمه ویرایش و سوئیچ فعال/غیرفعال‌سازی وضعیت کاربر در دسترس است.
- **سیستم مدیریت دو سطحی سقف توکن‌ها (`Two-Tier Token Quota System`)**:
  - افزودن ستون `tokenLimit` به جدول کاربران در بک‌اند (`1761200000000-AddUserTokenLimit.ts`) برای تعیین سقف اختصاصی هر کاربر.
  - بررسی اولویت‌دار سهمیه در `chat.service.ts`: ابتدا سقف اختصاصی کاربر بررسی می‌شود (مقدار ۰ به معنای سقف نامحدود) و در صورت عدم تعیین، سقف سراسری سیستم اعمال می‌شود.
  - رفع باگ عدم شمارش توکن در استریمینگ واقعی چت (محاسبه و ذخیره قطعی در بلاک `finally` متد `generate`).
  - تعبیه دکمه و مدال تنظیم سقف توکن سراسری و پرامپت سیستم در داشبورد ادمین.
- **فارسی‌سازی ۱۰۰٪ با فونت وزیرمتن و حذف تمامی عبارات انگلیسی**:
  - حذف کلیه سربرگ‌های انگلیسی بالای صفحات و جداول (`CATALOG`, `REGISTRY`, `ACCESS & USAGE`, `SYSTEM STATUS`, `USAGE`, `PARVA / ADMIN`, `ADMIN CONSOLE`).
  - اعمال یکپارچه فونت وزیرمتن با چینش کاملاً راست‌به‌چپ (`RTL`).
- **جستجوی همه‌جانبه**: فیلتر لحظه‌ای و پویا برای تمامی بخش‌ها (مدل‌ها، ارائه‌دهنده‌ها، کاربران) با دکمه پاک‌کردن سریع جستجو.
- **تست‌ها**: پاس شدن ۱۰۰٪ تمامی ۲۳ فایل تست فرانت‌اند (۱۲۴ تست سبز شامل تست جدید `AdminTable.spec.ts`) و ۱۸ فایل تست بک‌اند (۱۲۷ تست سبز).

## Task 29: Admin Panel Restoration & Direct Navigation (بازگردانی کامل پنل و داشبورد ادمین و هدایت مستقیم بدون مدال)
- **بازگردانی کامل پنل مدیریت (`AdminPanelView.vue`)**: بازگردانی کامل داشبورد مدیریتی شامل ۴ تب مجزا: داشبورد (کارت‌های KPI، مصرف توکن، مدل‌های فعال، وضعیت ارائه‌دهندگان)، مدیریت ارائه‌دهندگان (Providers)، مدل‌ها (Models)، و کاربران (Users با قابلیت تغییر نقش و غیرفعال‌سازی).
- **هدایت مستقیم بدون باز شدن مدال**: حذف باز شدن پاپ‌آپ/مدال ادمین هنگام کلیک روی دکمه‌های «ادمین» یا «پنل مدیریت» در سایدبار (`AppSidebar.vue`)، هدر (`AppHeader.vue`) و منوی پروفایل (`ProfileMenu.vue`)؛ در تمام این بخش‌ها کاربر مستقیماً از طریق روتر به `/admin/models` هدایت می‌شود.
- **حفظ ۱۰۰٪ قابلیت‌های متنی تسک ۲۸**: تمامی قابلیت‌های تایپ دوطرفه پویا، چینش خط-به-خط پیام‌های کاربر و مارک‌داون هیبرید حفظ شده و با پنل مدیریت همگام است.
- **تست‌ها**: پاس شدن ۱۰۰٪ تست‌های فرانت‌اند (۲۲ فایل تست، ۱۲۱ تست سبز) و بک‌اند (۱۸ فایل تست، ۱۲۶ تست سبز).

## Task 28: Hybrid & Dynamic Bidirectional Text Direction (چپ‌چین و راست‌چین هوشمند و هیبرید)
- **پویاسازی جهت در اینپوت (`ChatComposer.vue`)**: با تایپ هر کاراکتر و جابجایی مکان‌نما، جهت ورودی به صورت بلادرنگ تنظیم می‌شود (تایپ انگلیسی $\rightarrow$ چپ‌چین؛ تایپ فارسی $\rightarrow$ راست‌چین؛ تایپ مجدد انگلیسی $\rightarrow$ چپ‌چین) و با پاک شدن ورودی یا ارسال پیام بلافاصله به پیش‌فرض فارسی (`rtl`) برمی‌گردد.
- **چینش هیبرید خط-به-خط در پیام‌های کاربر (`MessageBubble.vue`)**: خطوط پیام کاربر به صورت مستقل بررسی شده و خطوط انگلیسی در سمت چپ و خطوط فارسی در سمت راست قرار می‌گیرند (`.user-msg-line.rtl` و `.user-msg-line.ltr`).
- **جهت‌گیری مستقل اجزای Markdown در پاسخ دستیار (`MarkdownContent.vue`)**: بلوک‌های مارک‌داون، آیتم‌های لیست (`li`)، نقل‌قول‌ها (`blockquote`)، و خطوط پاراگراف با `<br>` هر کدام جهت مستقل خود را حفظ می‌کنند.
- **تست‌ها**: افزودن تست‌های جامع واحد در `textDirection.spec.ts`، `ChatComposer.spec.ts` و `MessageBubble.spec.ts` (تمام ۱۲۰ تست فرانت‌اند و ۱۲۵ تست بک‌اند سبز).

## Task 27: Per-Conversation Independent Streaming State
- Refactored `chat.ts` Pinia store to replace all global streaming state refs with a `Map<convId, ConvStreamState>`.
- Each conversation now has its own `isStreaming`, `isThinking`, `streamError`, `currentStreamingText`, `abortController`, and `lastUserPrompt`.
- Backward-compatible computed aliases expose the active conversation's state to all components without code changes in `ChatComposer.vue`, `MessageList.vue`, etc.
- Switching conversations no longer aborts an ongoing background stream — both conversations continue independently.
- `AppSidebar.vue`: Animated pulsing dot badge shown next to any conversation currently streaming in the background (visible in both expanded and icon-only sidebar modes).
- Updated 3 test files (`MessageList.spec.ts`, `ChatComposer.spec.ts`, `NetworkAndRetry.spec.ts`) to use `convStreamStates` Map for test setup.

## Task 1: Full-Stack Project Initialization
- Initialized Vue 3 + Vite + TypeScript frontend with Vue Router 4 and Pinia state management.
- Initialized NestJS + TypeScript backend with Express platform adapter and CORS enabled.
- Added environment variable support (`.env` and `.env.example`) for both frontend and backend.
- Added `.gitignore` to prevent secret and build artifact leakage.

## Task 2: UI Overhaul & Responsiveness
- Installed and configured **Tailwind CSS** and **shadcn-vue** for the frontend.
- Added **Vazirmatn** font face to the project, ensuring proper Persian (RTL) typography.
- Made the frontend fully responsive.

## Task 3: Auth Page & Shadcn UI Integration
- Replaced modal authentication with dedicated `/login` and `/signup` routes using shadcn-vue components (`Card`, `Button`, `Input`, `Label`).
- Fixed ESM compatibility for `tailwind.config.js` and PostCSS bundling in `vite.config.ts`.
- Configured CSS variables and opacity tokens for shadcn-vue.
- Added comprehensive unit tests for `LoginView.vue`.

## Task 4: In-Form Model Picker & Admin Panel Access
- Relocated model selection dropdown from `AppHeader` to the chat composer input form (`ChatComposer.vue`), allowing users to switch models directly where they compose messages.
- Added popover dropdown with upward orientation in composer footer.
- Added direct access links to the Admin Panel (`/admin/models`) in Header, Sidebar, and inside the Models Modal.
- Added unit tests for in-form model selection in `ChatComposer.spec.ts`.

## Task 5: Admin Dashboard Overhaul & Global App Scrolling
- Transformed `/admin/models` into a full-featured Admin Dashboard with KPI metric cards (Total Models, Active Status, Connected Providers, Total Sessions).
- Added interactive toolbar with search filter and provider tabs (All, OpenAI, Anthropic, Google, Meta, Local).
- Built structured data table with status badges and quick actions (Set Default, Delete).
- Fixed root layout in `main.css` (`overflow-y: auto`, `#app min-height: 100vh`) so any page overflowing viewport height scrolls naturally.
- Added unit tests for Admin Dashboard in `AdminModelsView.spec.ts`.

## Task 6: Browser Autocomplete / Autofill Dark Theme Preservation
- Configured `-webkit-autofill` and `:autofill` CSS rules with inset box-shadow and text fill overrides to prevent browsers (Chrome, Edge, Safari, Firefox) from replacing input background and text colors with light yellow/white during autocomplete.

## Task 7: Global Async Loading & Form Control Disabling
- Created global composables `useAsyncAction` and `useLoadingState` (`src/composables/useAsyncAction.ts`) to orchestrate asynchronous execution with automatic `isLoading`, `error` handling, cancellation guards, and cleanup.
- Enhanced `<Button>` with `:loading` and `:disabled` props, rendering an inline SVG spinner and disabling pointer events during loading.
- Enhanced `<Input>` with explicit `disabled` and `loading` props and visual opacity transitions.
- Integrated `useAsyncAction` into AI model registration (both in `AdminModelsView.vue` and `ModelsModal.vue`), automatically disabling all form inputs (`name`, `provider`, `apiIdentifier`), secondary buttons (`cancel`), and the submission button while rendering an active loading spinner until completion.
- Integrated `useAsyncAction` into `LoginView.vue` for sign-in and sign-up flows.
- Added comprehensive unit test suite in `tests/useAsyncAction.spec.ts` and updated `AdminModelsView.spec.ts` and `LoginView.spec.ts`.

## Task 8: Frontend-Backend API Connection & Dedicated Service Layer
- Connected frontend to backend in accordance with OpenAPI specification (`api-contract.yaml`).
- Established clear separation of concerns: Presentation (`views/`, `components/`) -> State/Business Logic (`stores/`) -> Domain API Clients (`services/`) -> Base HTTP Client (`api.ts`).
- Created dedicated, strongly-typed services: `authService`, `chatService` (with SSE token streaming reader and JSON fallback), and `modelsService`.
- Standardized error handling, automatic JWT Bearer injection, and response parsing in `api.ts`.
- Added unit test suites for all API services in `tests/services/` (total 38 tests passing across 10 test suites).
- Created dedicated frontend documentation in `docs/frontend/README.md` and `docs/frontend/services-architecture.md`.

## Task 9: Standardized API Response Envelope `{ success, message, data }`
- Updated OpenAPI contract (`api-contract.yaml`) to standardize all endpoint responses inside an envelope: `{ success: boolean, message: string, data: any }`.
- Built `ResponseEnvelopeInterceptor` in NestJS backend (`backend/src/shared/response-envelope.interceptor.ts`) registered globally and in `AppModule`.
- Updated `HttpExceptionFilter` to format errors with `success: false` and `data: null`.
- Enhanced frontend `api.ts` base client to unwrap `data` automatically when an envelope is detected.
- Verified test suite: 100% passing tests (38 backend tests across 8 suites, 39 frontend tests across 10 suites).
- Both frontend and backend production builds compile with 0 errors.

## Task 10: Hybrid Form Handling, Auth Route Guards & Model Admin Security
- **Universal Form Composable (`useFormSubmit`)**: Built a reusable composable (`frontend/src/composables/useFormSubmit.ts`) managing submission lifecycle (`isSubmitting`), form errors, field-specific validation mappings from NestJS `class-validator` arrays, and toast integration.
- **Global Network & Auth Interceptor (`api.ts`)**: Implemented automatic 401 session expiry handling (clears localStorage, notifies with toast, redirects to `/login`) and 500 server error notifications.
- **Root-Cause Resolution for Model Registration**: Eliminated silent offline fallbacks from `models.ts` and `auth.ts` that previously masked backend 403 Forbidden responses.
- **Route Navigation Guards (`router.beforeEach`)**: Protected `/` and `/chat/:id` with `requiresAuth`, `/admin/models` with `requiresAuth` and `requiresAdmin`, and `/login` & `/signup` with `guestOnly`.
- **Role-Based UI Gating**: Hidden admin entry points (e.g. Admin Panel button in `AppHeader.vue`) behind `v-if="authStore.isAdmin"`.
- **Reactive Toast Notification System**: Added floating, animated toast alerts in `ToastContainer.vue` powered by `uiStore.toasts`.
- **Test Coverage**: Added `tests/useFormSubmit.spec.ts`, bringing frontend unit tests to 45 passing tests across 11 test suites. Backend tests remain at 38/38 passing. Production builds for both frontend and backend compile cleanly with 0 errors.

## Task 11: OpenAI-Compatible Engine, Admin Decluttering, Light/Dark Modes & Grok Gradient
- **OpenAI-Compatible Endpoints & Outbound LLM Forwarding**:
  - Enhanced `AiModel` entity with `apiKey` and `baseUrl` columns.
  - `ChatService` dynamically connects to custom OpenAI-compatible endpoints (`${baseUrl}/chat/completions`) using provided API keys, passing conversation history and handling streamed/non-streamed generation with mock/offline fallbacks.
  - Exposes standard inbound OpenAI-compatible endpoints `GET /v1/models` and `POST /v1/chat/completions` supporting standard format and Server-Sent Events (SSE).
  - Masked API key storage and delivery (`sk-...last4`) preventing credential exposure.
  - Added model active/inactive status control (`isActive`) with `PATCH /admin/models/:modelId/status`, preventing chat interaction with deactivated models.
- **Decluttered Admin Dashboard (`AdminModelsView.vue`)**:
  - Replaced oversized KPI metric cards with sleek, minimalist stat badges, preserving required test selectors while eliminating visual bloat.
  - Streamlined table with instant interactive active/inactive toggle switches and quick actions.
  - Added optional `baseUrl` and `apiKey` fields to model creation forms.
- **Light & Dark Theme Engine (`SettingsModal.vue`, `uiStore`)**:
  - Centralized theme state in `useUiStore` (`'dark' | 'light'`) with auto-persistence in `localStorage` and `html.dark` class sync.
  - Interactive theme selection cards in the Settings modal with real-time visual feedback.
  - Refined theme CSS variables in `main.css` for both Obsidian Dark mode and clean Light mode.
- **Grok-Style Animated Aurora Background (`GrokAurora.vue`)**:
  - Hardware-accelerated fluid multi-color cosmic gradient background.
  - Ambient fluid animation on `/login` with loading pulse during sign-in.
  - Smooth entrance animation on `/chat` across both light and dark themes.
- **Conversation Management & Navigation Refinements**:
  - Added `DELETE /chat/conversations/:id` endpoint in backend with strict ownership verification (returns 404 for other users' conversations, 204 on success).
  - Wired frontend `chatService.deleteConversation` and `chatStore.deleteConversation` to sync deletion with backend.
  - Cleaned up `AppSidebar.vue` by removing the redundant Admin Panel section, keeping the sidebar focused solely on chat history.
  - Admin access is role-gated and accessible via the Header button (`v-if="authStore.isAdmin"`) and Settings modal.
- **Verification**:
  - 100% test pass rate: 41 backend tests and 45 frontend tests passing cleanly.

## Task 12: Conversation Rename & Delete Modals, Toast Right-Alignment & Theme Adaptivity
- **Conversation Rename & Deletion Modals**:
  - `EditConversationModal.vue`: Dedicated component dialog for renaming conversation titles with autofocus, trim validation, cancel, and save actions.
  - `DeleteConversationModal.vue`: Dedicated confirmation modal dialog requiring explicit user confirmation before conversation deletion, with warning icon and danger button styling.
  - Quick Action Buttons in `AppSidebar.vue`: Edit (pencil) and Delete (trash) action buttons appear seamlessly on conversation item hover.
  - Backend integration: `PATCH /chat/conversations/:id` renames conversation with ownership enforcement (404 for unauthorized) and title validation. `DELETE /chat/conversations/:id` removes conversation and its messages.
- **Right-Aligned & Theme-Adaptive Toasts**:
  - `ToastContainer.vue`: Anchored to the top-right screen edge (`right-4 items-end`), ensuring toast alerts are consistently displayed on the right.
  - Dynamic theme styling: Crisp light backgrounds (`bg-white/95 text-slate-900 border-slate-200/80 shadow-md`) in light mode and dark obsidian backgrounds (`bg-slate-900/95 text-slate-100 border-slate-700/60`) in dark mode.
## Task 13: Sidebar Bottom Logout & RTL/LTR Modal Button Layout
- **Sidebar Bottom Logout Flow**:
  - Removed direct logout trigger button from navbar (`AppHeader.vue`) and decoupled it from the user card in the sidebar.
  - Positioned a dedicated full-width logout button (`.logout-footer-btn`) sticking to the very bottom of the sidebar (`AppSidebar.vue`), clearly separated from user profile information.
- **RTL/LTR Left-Right Modal Button Layout**:
  - Standardized action buttons across all modals (`LogoutModal.vue`, `DeleteConversationModal.vue`, `EditConversationModal.vue`, and `ModelsModal.vue`) to occupy both the left and right edges (`justify-between`).
  - Buttons adapt dynamically to layout direction:
    - **RTL (Persian)**: Primary action button (e.g. `تأیید و خروج`, `حذف قطعی گفتگو`, `ذخیره عنوان`, `ثبت مدل`) positioned on the **Right** (start), and `انصراف` (Cancel) positioned on the **Left** (end).
    - **LTR (English)**: `Cancel` positioned on the **Left** (start), and Primary action button positioned on the **Right** (end).
- **Verification**:
  - 100% test pass rate: 44 backend tests and 47 frontend unit tests passing cleanly (91/91 total).

## Task 14: Provider Registry, Real Model Streaming & User Model Switching (backend only)
- **Provider entities**: `GET/POST /admin/providers`, `PATCH /admin/providers/:id` (rename, baseUrl, key rotation), `PATCH /:id/status` (enable/disable), `PATCH /:id/default` (per-provider default model), `DELETE /:id` (cascade-deletes its models; platform default auto-repromoted if swallowed). Keys stored in DB, write-only over the API, masked `sk-...last4` everywhere. `npm run seed:providers` backfills provider rows from legacy free-text labels.
- **Real streaming chat**: replies are streamed token-by-token from any OpenAI-compatible upstream (`stream:true`, global `fetch`, no new dependency). Resolution order model → provider → env fallback; offline `Echo` remains ONLY when no key exists anywhere (with WARN). Provider failure: 502 envelope before the first token; partial reply persisted + normal `event: done` mid-stream.
- **User model switching**: `PATCH /chat/conversations/:id` now accepts `{ modelId }` (and `{ title }` — both optional, at least one required). `GET /models` returns chat-usable (active model of active provider) models to every authenticated user.
- **Hardening**: `/v1/models` + `/v1/chat/completions` now require a bearer token (they can spend real credits) and forward to real models (unknown model → 404).
- **Contract**: `api-contract.yaml` → 0.5.0. **Tests**: 74 backend tests passing (44 pre-existing kept green + 30 new).

## Task 15: User Profile, MinIO Avatars & Credential Changes (backend only)
- **Profile endpoints**: `GET/PATCH /users/me` — `displayName` and unique lowercased `username` (409 on conflict; `bio`/language/theme/timezone/defaultModelId were later removed by product decision — see `CHANGELOG`). Shipped via dedicated TypeORM migrations (`AddUserProfileAndPreferences` then `DropUserProfileAndPreferences`; run with `npm run migration:run`, local dev still auto-syncs with `DB_SYNC=true`).
- **Avatars on MinIO** (new `StorageModule` + `minio` dependency): `POST /users/me/avatar` (multipart field `file`; only `image/png|jpeg|webp`; ≤ 2 MB → honest 413 by multer; replaces + deletes the previous object), `DELETE /users/me/avatar`. Files are served publicly at `GET /static/avatars/{userId}/{file}` (opaque random keys, streamed from MinIO). Without `MINIO_*` env, upload endpoints return **503** — no silent disk fallback.
- **Credential changes with re-auth**: `POST /users/me/email` (requires the current password → 401 if wrong; 409 if the email exists; applies immediately) and `POST /users/me/password` (requires current password; bcrypt re-hash). No forgot-password/reset flow (product decision).
- **Contract**: `Users` tag + `/users/me*` + `/static/avatars/...` paths in `api-contract.yaml`. Tests: `backend/test/profile.spec.ts`. Frontend untouched.

## Task 16: Search Modal, Parva Branding, Stream Interruption & Spacing
- **ChatGPT-Style Search Modal (Full-Stack)**:
  - Backend: `GET /chat/conversations/search?q=...` searches conversation titles and message contents with snippet extraction.
  - Frontend: `SearchModal.vue` with live debounced search, `Ctrl+K` / `Cmd+K` keyboard shortcut, keycap badges, and conversation selection.
- **Backend Empty Conversation Prevention**:
  - `ChatService.create` checks the user's latest conversation: if it has 0 messages, it reuses and returns that empty conversation instead of creating a blank duplicate.
- **Personalized Animated Greeting**:
  - `EmptyState.vue` displays a typewriter animation greeting the user by name with smooth cursor blinking.
- **Chat Spacing & UX Refinements**:
  - `MessageList.vue` added top clearance (`58px` on mobile, `24px` on desktop) preventing overlap with floating hamburger button.
  - `MessageBubble.vue` displays single retry button on last message when interrupted or failed.
  - Rebranded platform to **«پروا» (Parva)** with `logo.jpg` integration and dark mode logo variant support.

  ## Task 17: Chat Resilience Audit
  - Added [Chat Resilience documentation](chat-resilience.md) covering the current handling of Offline/Online state, retry, URL-based conversation restoration, persisted history, and partial Streaming replies.
  - Recorded the previous gap explicitly: the previous implementation persisted partial text but did not support durable generation state or true resume from a cursor after reconnect.

## Task 18: Resumable & Persistent Streaming Across Refreshes + AI Auto-Title Generation
- **Resilient & Resumable Streaming (Full-Stack)**:
  - **Backend Decoupled Stream Architecture (`ActiveStreamService`)**:
    - Background LLM generation sessions are maintained independently of individual client HTTP connections.
    - If the user refreshes the page or experiences a network interruption, the generation continues uninterrupted in the background instead of aborting upstream.
    - `ActiveStreamSession` maintains buffered tokens (`accumulatedText`), status (`thinking` / `streaming` / `completed`), subscribers, and abort controllers.
    - `GET /chat/conversations/:id/active-stream`: Returns current generation status, accumulated tokens, and title.
    - `GET /chat/conversations/:id/stream`: Server-Sent Events (SSE) reconnection endpoint. Dispatches `event: sync` with accumulated text and continues streaming incoming tokens in real time.
    - `POST /chat/conversations/:id/messages/:messageId/resume`: Continues interrupted assistant responses directly from where they stopped with prior context and continuation prompt.
    - `POST /chat/conversations/:id/stop` & `POST /chat/conversations/:id/messages/:messageId/stop`: Allows explicit user-initiated stream cancellation.
  - **Frontend Stream Reconnection & Persistence (`chatService`, `useChatStore`)**:
    - On page refresh or conversation selection, `chatStore` checks for active background streams via `chatService.getActiveStream`.
    - If active, the UI immediately restores `isStreaming = true`, populates `currentStreamingText` with accumulated content, renders the typing animation, and attaches to the live stream via `subscribeActiveStream`.
    - Automatic retry with exponential backoff on transport disconnects.
    - Streamed content never vanishes or jumps abruptly on refresh.
- **AI-Powered Automatic Conversation Titling (Auto-Title)**:
  - `OpenAiCompatForwarder.complete`: Lightweight non-streaming method for fast one-turn completions.
  - Upon receiving the first user message in a new conversation, triggers a concurrent, non-blocking AI prompt to generate a 3-5 word concise title in the same language.
  - Persists title to PostgreSQL (`conversations.title`) and emits `event: title` over SSE stream.
  - Frontend updates the active conversation title in the sidebar in real time without requiring a page reload.
  - Includes offline heuristic fallback (clean keyword boundary trimming up to 35 chars) if the AI provider is unreachable or unconfigured.
- **Verification**:
  - 100% test pass rate across both projects: 109 backend tests (15 test suites) and 77 frontend tests (16 test suites) — 186/186 total passing tests.

## Task 19: ChatGPT-Style Chat Layout Refactor & Rich Markdown Engine (Code, Tables, Readme)
- **ChatGPT-Style Layout Refactoring**:
  - Refactored chat presentation to modern turn-based layout:
    - User prompt anchored cleanly at the top of each turn with user avatar, name badge, and timestamp.
    - Assistant response positioned directly underneath the user prompt, unfolding across the full width of the central reading container (`max-w-3xl` / `max-w-4xl`).
    - Clean visual rhythm with Tailwind CSS utility classes, smooth spacing (`gap-3.5`, `py-6`), and seamless responsiveness across desktop and mobile.
    - Obsidian Dark theme and Warm Cream Light theme full compatibility.
  - Assistant response box has zero border and completely transparent background color, integrating seamlessly with the page surface.
  - Removed sender/chatbot name text ("شما" / "دستیار هوشمند پروا") for a decluttered, authentic conversation flow.
  - Replaced "در حال نوشتن..." textual label with a minimal 3-dot bouncing pulse indicator.
  - Localized timestamps to Persian digits with explicit «قبل‌ازظهر» / «بعدازظهر» indicators.
  - Added copy button to user messages as well, allowing users to copy their own prompts instantly.
  - Arranged login view with brand artwork on the left pane and authentication form on the right pane.
- **Rich Markdown Engine (`MarkdownContent.vue`)**:
  - Powered by `marked` with custom GFM renderers:
    - **Code Blocks**: Formatted in `dir="ltr"` with JetBrains Mono, language header badge (e.g. `TYPESCRIPT`, `PYTHON`, `SQL`), and an interactive copy button with instant feedback («کپی» -> «کپی شد ✓»).
    - **Responsive Tables**: Full GFM markdown tables wrapped in an overflow container (`table-responsive`) with zebra rows, themed borders, and horizontal scrolling on mobile.
    - **README & Typography**: Headers (`h1`-`h6`), nested ordered/unordered lists (`ul`, `ol`), blockquotes with accent left border, inline code pills (`code`), links opening in safe new tabs, and task checkboxes.
    - **Bidirectional Support (BiDi)**: Automatic text direction detection via `getTextDirection` — Persian paragraphs rendered in RTL, while code blocks and tables strictly maintain LTR formatting.
    - **Streaming-Friendly**: Dynamically closes unclosed fences during active stream generation.
- **Verification**:
  - 100% test pass rate: **109 backend tests** (15 test suites) + **82 frontend tests** (17 test suites, including new unit tests in `MarkdownContent.spec.ts`) — 191/191 total passing tests.
  - Production build (`vue-tsc -b && vite build`) compiles with zero errors.

## Task 23: Responsive Admin Console (Frontend)
- Replaced the model-only admin screen with a theme-aware admin console while preserving `/admin/models`.
- Added a responsive sidebar with Dashboard, Providers, Models, and Users & Usage sections plus a mobile drawer.
- Connected dashboard statistics, provider CRUD/status/default actions, model CRUD/status/default actions, and user token usage/status to the existing API contract.
- Added typed frontend admin services and regression coverage for navigation, filtering, model creation, and loading states.

## Task 26: Admin Console Mobile Tables & Modals (Frontend)
- Mobile-first card layout for all admin tables (`AdminTable.vue`): below 768px the header row hides and each row becomes a stacked card whose cells are labeled from the column labels via a `data-label` contract (set by the table for default rows and by each parent row template in `AdminPanelView.vue`).
- Filled the 768–1080px layout gap: KPI grid collapses to 2 columns, forms/dashboard grids collapse to a single column below 1080px; `provider-grid` keeps its intrinsic `auto-fill` responsiveness.
- Modal hardening: `DeleteConfirmModal` action buttons stack full-width on narrow screens; `ModelsModal` card gains viewport-bounded max-height with internal scroll.
- Fixed pre-existing branch issues to restore the green gate: removed duplicate `UpdateUserStatusDto` in backend `admin/dto.ts`, removed two unused imports (ProfileModal `DialogDescription`, AdminPanelView `authStore`), and updated stale test expectations in `LoginView.spec.ts` / `SettingsModal.spec.ts` to the current Persian UI strings.
- Verification: frontend suite 126/126 green (23 files) and production build (`vue-tsc -b && vite build`) passes.
- Mobile layout fix: below 768px the admin sidebar goes off-canvas, so `margin-inline-start: 260px` on `.admin-main` is now reset (it previously stayed applied, pushing all admin content sideways on phones); topbar and content padding are also compacted on small screens.

## Task 27: Immediate Avatar Sync on Login (Frontend)
- The auth (login/signup) response carries no `avatarUrl`, so the sidebar avatar only appeared after the profile modal was opened (which fetches `/users/me`).
- `authStore` now refreshes the full profile right after login/signup (fire-and-forget, session already usable) and on store init when a saved session exists (page refresh / direct URL).
- Failure-safe: a failed profile refresh keeps the session untouched (401 is handled globally with auto-logout).
- Covered by `tests/AvatarSync.spec.ts` (login path, refresh path, failure path).

## Task 28: New Chat Gating & Sidebar Visibility (Frontend)
- "New Chat" is now disabled both when no conversation is selected at all and when the current conversation is still empty (previously only the latter), so duplicate empty conversations can no longer be created.
- A chat typed directly into the composer (without selecting a conversation) stays OFF the sidebar until the assistant's first token arrives — same contract as `createNewConversation` (see `executeMessageStream`'s first-token hook).
- Covered by `tests/NewChatGating.spec.ts` (button gating x2, sidebar visibility on first token).
- Known pre-existing issue on this branch (unchanged): `stores/chat.ts` carries merged-in dead stream code inside `deleteMessage` (~35 pre-existing tsc errors; `deleteMessage` would throw at runtime after its toast) — needs a separate cleanup task.

## Task 29: Admin Dashboard Polish & Smooth Word-Paced Streaming (Frontend & Backend)
- Admin dashboard "connected providers" rows now use a fixed 4-column grid so the model-count column lines up vertically across all rows (was flex with competing auto margins).
- Admin sidebar navigation icons unified on lucide (`LayoutDashboard`, `Network`, `Boxes`, `Users`, `Sparkles`, `MessageSquare`, `FileText`); the per-theme PNG/SVG image icons were removed along with their imports.
- Dashboard "top token consumers" list is now sorted by usage (highest first, capped at 5) via a `topTokenConsumers` computed; token value column is fixed-width left-aligned and the panel heading action button sits flush with the panel edge.
- Admin sidebar back button: label shortened to «بازگشت» and its arrow now points outward (right in RTL).
- Streaming pacing: the backend now splits provider chunks into word/whitespace pieces and paces each non-whitespace piece (~25ms in dev/prod, 0 in tests), in both `generate()` and `resume()`. Clients render a smooth word-by-word flow instead of sudden bulk text. Auto-scroll-follow behavior in `MessageList` is untouched (user scroll-up still pauses following).
- Message list bottom breathing room increased globally (`padding-bottom: clamp(10rem, 22vh, 14rem)`; streaming row margin-bottom bumped) so the last message's time/copy row and the streaming line never sit flush against the composer.
- Verification: backend `tsc --noEmit` clean; frontend type-check unchanged vs branch baseline (only the pre-existing 37 errors in MessageBubble/chat.ts). Tests intentionally deferred (user request).

## Task 30: Chat Deletion & Send 404 Fixes (Frontend & Backend)
- Root cause chain: deletion is soft (`isDeleted`), but `ConversationService.create()` reused the user's latest empty conversation WITHOUT the `isDeleted` filter — so right after deleting a chat, creating a new one returned the soft-deleted conversation's id, and sending to it hit `assertOwned` (which filters `isDeleted: false`) → 404 with no model reply.
- Fix: `create()` now filters `isDeleted: false` on both the latest-conversation lookup and its message count (the earlier fix filtered `list()` the same way).
- Frontend hardening: if a local placeholder conversation (`c-*`) cannot be persisted before streaming, `sendMessage` fails fast with a Persian toast/inline error instead of firing a request that is guaranteed to 404.
- Verification: backend `tsc --noEmit` clean; frontend type-check unchanged vs branch baseline. Tests deferred per user request.
- Follow-up (Task 30b): the client 35s stream timeout is now INACTIVITY-based (re-armed on every received SSE chunk via an `onActivity` hook in `readSseStream`) instead of total-duration — long word-paced answers no longer get aborted mid-way and dumped as one bulk sync. Composer gains a permanent 14px top gap above the input box.

## Task 31 (Phase 1): Live Web Search with Sources & Citations (UNCOMMITTED WIP)
- New self-contained backend module `web-search/` (`WebSearchService` + `WebSearchModule`, Serper.dev via `SERPER_API_KEY`, 10s timeout, max 8 https-only sources) consumed by `ChatService.generate` through optional DI — old callers (incl. `/v1/*`) unchanged.
- Admin kill-switch: `web_search_enabled` in `system_settings` (default ON) via `GET/PUT /admin/settings { webSearchEnabled }` (`SettingsService.getWebSearchEnabled`).
- Opt-in per message: `SendMsgDto.useWebSearch` → `generate(..., { useWebSearch })`; searches BEFORE the LLM call, injects a numbered `[n]` sources block into the system prompt; new `ChatChunk`s + SSE events `search-status`/`sources`/`sources-error` on BOTH `POST messages` and `GET stream` paths; `ActiveStreamService` replays sources to late subscribers and re-arms the 35s thinking watchdog around search.
- Persistence: `Message.sources` (nullable jsonb) + migration `1761300000000-AddMessageSources`; search-failure flag is live-only, but the Persian failure note is streamed AND saved inside `content` so history stays honest.
- Frontend: `WebSource` types; `dispatchSseEvent` (unit-tested) drives `readSseStream` + reconnect path; per-conversation flags in `convFlags` (+localStorage, `__new__`→real-id migration); 🌐 toggle with reusable `BaseToggle` in the + menu; `SourcesBlock` (Tailwind + shadcn `Button` only, no new CSS) under stored AND streaming answers; `[n]` markers become links via `linkCitationsInHtml` (unit-tested).
- Verification: backend full suite green (21 suites/144 tests incl. `web-search.spec`, `chat-search-flow.spec`); frontend specs green (16 tests); `vue-tsc` error set IDENTICAL to branch baseline (pre-existing errors only, incl. known dead `deleteMessage` regenerate block — untouched).
- Manual checklist for reviewer: toggle on → cards + clickable [n]; toggle off → old behavior; admin off → skipped; no SERPER_API_KEY → failure note, answer continues; refresh mid-stream → sources replay.
- **Bugfix — sources hidden for user-stopped messages**: پیام متوقف‌شده توسط کاربر (Abort) دیگر منابع وب را نمایش نمی‌دهد. بک‌اند `isInterrupted=true` و `stoppedByUser=true` را ست می‌کند و `sources=null` ذخیره می‌شود. فرانت‌اند `SourcesBlock` را فقط برای پیام کامل (غیرمتوقف) رندر می‌کند. تست موجود `chat-stop-sources.spec.ts` این رفتار را تایید می‌کند.

## Task 32: Serper Quota Display in Admin Panel (UNCOMMITTED WIP)
- Serper publishes no credits API (balance is dashboard-only), so usage is counted locally: `WebSearchService` atomically increments `web_search_used_credits` (+1 per successful search; failures uncounted) via `ON CONFLICT DO UPDATE` — counting can never break searching (try/catch + warn).
- `SettingsService.getWebSearchUsage() → { used, total, remaining }` (defaults 0/2500, clamped, garbage-safe); included in `GET /admin/settings` + dashboard stats; `PUT` accepts `webSearchQuotaTotal` (min 1) and `webSearchUsedCredits` (min 0, for one-time calibration with the Serper dashboard).
- Admin settings modal: «اعتبار جستجوی وب» section with remaining/total, Tailwind progress bar, <10% low warning, and the two editable numbers — same existing classes, no new CSS.
- Verification: backend 23 suites/152 green (counter-once, counter-failure resilience, quota math, update persistence); frontend 152 green; vue-tsc identical to baseline.

## Admin Optimistic Updates (UNCOMMITTED WIP)
- علت: اکشن‌های پنل ادمین لیست را رفرش می‌کردند ولی شمارنده‌های داشبورد (`stats`) تا رفرش صفحه کهنه می‌ماند (مثلاً غیرفعال‌کردن مدل، تعداد «مدل‌های فعال» را عوض نمی‌کرد).
- فیکس فقط در فرانت: هلپر خالص `utils/stats.ts#adjustStat` + `bumpStat`/`refreshStats` در `AdminPanelView`. تاگل مدل/پروایدر/کاربر: تغییر instant سطر و KPI با rollback при خطا؛ add/edit/delete: رفرش موجود + `refreshStats()` برای تطبیق (cascade پروایدر هم پوشش داده می‌شود). هیچ تغییری در بک‌اند یا منطق چت داده نشد.
- Verification: `tests/stats.spec.ts` جدید؛ فول سوئیت فرانت ۱۵۵ سبز؛ vue-tsc دقیقاً برابر خط مبنا.

## Global Default Model with Optimistic Updates (UNCOMMITTED WIP)
- شکاف: تابع `setPlatformDefault` در پنل ادمین تعریف شده بود ولی هیچ دکمه‌ای آن را صدا نمی‌زد (خطای `never read` در تایپ‌چک!) — ادمین عملاً نمی‌توانست دیفالت را عوض کند. همچنین ورودی چت، انتخابِ باقی‌مانده از مکالمه قبلی را نشان می‌داد نه دیفالت پلتفرم.
- فیکس فقط فرانت: دکمه ستاره «پیش‌فرض سراسری» در ردیف هر مدل (فقط وقتی دیفالت نیست) با بج لحظه‌ای + rollback при خطا (هلپر تست‌پذیر `markDefaultModel`)؛ چت جدید همیشه با دیفالت فعلی پلتفرم شروع می‌شود (با re-sync مدل‌ها موقع ساخت، پس تغییر ادمین بدون رفرش صفحه اعمال می‌شود) و ورودی هم همان را نشان می‌دهد؛ انتخاب دستی داخل هر مکالمه دست‌نخورده ماند. حذف آخرین گفتگو هم ورودی را به دیفالت برمی‌گرداند.
- Verification: ۴ تست جدید (`model-default.spec`, `chat-newchat-default.spec`)؛ فول سوئیت ۱۵۹ سبز؛ vue-tsc یک خطا کمتر از مبنا شد (همان never-read پاک شد).

## User-Facing Default Model Endpoint (UNCOMMITTED WIP)
- شکاف: کلاینت دیفالت را فقط از روی فلگ لیست `GET /models` حدس می‌زد؛ اندپوینت صریحی نبود.
- اندپوینت جدید `GET /models/default` (با JWT همه کاربرها): مدل flagged را فقط وقتی برمی‌گرداند که فعال و پروایدرش فعال باشد (کلید maskشده)؛ در غیر این صورت 404 و کلاینت به منطق لیستی برمی‌گردد. هیچ رفتار قبلی عوض نشد.
- فرانت: `createNewConversation` اول همین اندپوینت را می‌زند (ارزان و دقیق) و فلگ‌های محلی + ورودی را با آن همگام می‌کند؛ فقط при خطا/404 به fetchModels+لیست برمی‌گردد.
- Verification: ۳ تست بک‌اند + ۱ تست فرانت جدید؛ بک‌اند ۱۵۹ سبز + lint؛ فرانت ۱۶۰ سبز؛ تایپ‌چک بدون خطای جدید.
