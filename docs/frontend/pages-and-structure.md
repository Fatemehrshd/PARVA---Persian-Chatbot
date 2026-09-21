# مستندات معماری، صفحات و اتصال به API در Frontend

## اتصال Frontend به Backend APIs

ارتباط با APIها به صورت متمرکز در سرویس `src/services/api.ts` پیاده‌سازی شده است. 
ویژگی‌های کلیدی اتصال به API:
- **Base URL:** آدرس پایه از مت متغیر محیطی `VITE_API_BASE_URL` خوانده می‌شود.
- **تزریق Token:** توکن JWT خوانده شده از `localStorage` در هدر `Authorization` قرار می‌گیرد.
- **مدیریت خودکار توکن (Refresh Token Rotation):** در صورت دریافت ارور 401، تابع `api.ts` به صورت نامحسوس اقدام به گرفتن توکن جدید از اندپوینت `/auth/refresh` کرده و درخواست شکست‌خورده را مجدداً ارسال می‌کند.
- **Quota Management:** اگر هدر `x-user-quota` در پاسخ‌ها وجود داشته باشد، سهمیه کاربری رمزگشایی شده و به `AuthStore` تزریق می‌شود.
- **هندل کردن سراسری خطاها:** خطاهای شبکه، قطعی اینترنت و خطاهای 500 سرور به شکل کاربرپسند پردازش شده و به صورت Toast نمایش داده می‌شوند. ساختار خطاهای برگشتی با `ApiError` استانداردسازی شده‌اند (که از معماری OpenAPI پیروی می‌کند).

تمامی سرویس‌های مجزا (مثل `chat.service.ts`, `auth.service.ts`, `models.service.ts` و غیره) صرفاً توابع کمکی هستند که برای ارتباط با بک‌اند، کاملاً بر پایه `request` در این فایل (`api.ts`) استوارند.

---

## بررسی صفحات (Views / Pages)

### ChatView
Function: ChatView Component
File: ChatView.vue
Path: src/views/ChatView.vue
Purpose: صفحه اصلی محیط چت که شامل Sidebar کناری، لیست مکالمات و صفحه چت جاری (Composer) است.
Parameters: دریافت آیدی مکالمه از طریق `route.params.id`
Return: رندر قالب Vue
Called By: Router (مسیر `/chat/:id` یا `/chat`)
Calls: `chatStore.loadConversations`, `modelsStore.fetchModels`, `chatStore.selectConversation`, `uiStore.initNetworkListeners`
Used In: Router configuration
Side Effects: تغییر استیت مکالمات در Pinia، تغییر URL در صورت ایجاد چت جدید
Database: ندارد
API: درخواست دریافت اطلاعات چت از طریق استورها و سرویس‌ها

### LoginView
Function: LoginView Component
File: LoginView.vue
Path: src/views/LoginView.vue
Purpose: صفحه ورود و ثبت نام کاربر (احراز هویت).
Parameters: ندارد
Return: رندر فرم‌های لاگین/عضویت
Called By: Router (مسیر `/login`)
Calls: `authStore.login`, `authStore.register`, `useFormSubmit`
Used In: Router configuration
Side Effects: تغییر استیت Auth و ذخیره توکن‌ها
Database: ندارد
API: فراخوانی اندپوینت‌های auth از طریق استورها

### AdminPanelView
Function: AdminPanelView Component
File: AdminPanelView.vue
Path: src/views/AdminPanelView.vue
Purpose: پنل مدیریت برای مشاهده وضعیت سیستم، مدیریت کاربران و سایر تنظیمات سطح ادمین.
Parameters: ندارد
Return: رندر داشبورد مدیریتی
Called By: Router (مسیر `/admin`)
Calls: `admin.service` و متدهای آماری/کاربران
Used In: Router configuration
Side Effects: دریافت لاگ‌ها و داده‌های ادمین
Database: ندارد
API: درخواست به روت‌های محافظت‌شده `/api/v1/admin/*`

### HomeView
Function: HomeView Component
File: HomeView.vue
Path: src/views/HomeView.vue
Purpose: صفحه لندینگ پیش‌فرض.
Parameters: ندارد
Return: رندر قالب
Called By: Router
Calls: ندارد
Used In: Router configuration
Side Effects: ندارد
Database: ندارد
API: ندارد

*(سایر صفحات شامل `SubscriptionView` برای مدیریت اشتراک‌ها، `SharedChatView` برای نمایش چت‌های اشتراک گذاشته شده، `PaymentResultView` برای بازگشت از درگاه پرداخت و `SandboxGatewayMockView` برای شبیه‌سازی درگاه پرداخت می‌باشد)*

---

## ساختار لایه‌ها (Components, Stores, Utils)

- **Components (`src/components/`):**
  کدها به زیرپوشه‌های منطقی تقسیم شده‌اند:
  - `admin/`: ماژول‌های پنل ادمین
  - `auth/`: فرم‌های ورود و ثبت نام
  - `chat/`: بخش‌های مربوط به چت مانند `MessageList`, `ChatComposer`, `MessageBubble`
  - `layout/`: ساختار اصلی صفحه مانند `AppSidebar`, `SettingsModal`
  - `subscription/`: کامپوننت‌های پلن‌ها و صورتحساب
  - `ui/`: کامپوننت‌های گرافیکی و عمومی مستقل مانند دکمه‌ها، دراپ‌داون‌ها و افکت‌های بصری (`GrokAurora`)

- **Stores (`src/stores/`):**
  مدیریت استیت سراسری با Pinia:
  - `auth.ts`: نگهداری اطلاعات کاربر لاگین‌شده و Quota.
  - `chat.ts`: مدیریت مکالمات، پیام‌ها و استریم کانتنت‌ها.
  - `ui.ts`: کنترل تم (روشن/تاریک)، نمایش Toastها، و وضعیت Sidebar.
  - `models.ts`: نگهداری لیست مدل‌های هوش مصنوعی فعال.

- **Utils (`src/utils/`):**
  توابع کمکی و مستقل:
  - `errorMessages.ts`: ترجمه خطاهای بازگشتی از سرور و شبکه.
  - `textDirection.ts`: تشخیص جهت متن (RTL/LTR) برای بهبود رابط کاربری.
  - `citations.ts`: پردازش و پارس کردن رفرنس‌ها در پیام‌های AI.
