# مستندات Composables (Frontend)

این فایل شامل مستندات توابع Composable در بخش فرانت‌اند است که منطق قابل استفاده مجدد را فراهم می‌کنند.

## 1. useAsyncAction
Function: useAsyncAction, useLoadingState
File: useAsyncAction.ts
Path: src/composables/useAsyncAction.ts
Purpose: مدیریت وضعیت بارگذاری (loading) و خطاهای عملیات ناهمگام (async)، جهت استفاده برای غیرفعال کردن دکمه‌ها تا زمان اتمام عملیات.
Parameters: `asyncFn` (تابع ناهمگام)، `options` (گزینه‌های اختیاری شامل `onSuccess` و `onError`)
Return: آبجکتی شامل `isLoading`, `error`, `execute`, `reset`
Called By: کامپوننت‌های مختلف فرم، دکمه‌ها و بخش‌هایی که نیاز به لودینگ دارند.
Calls: تابع پاس داده شده `asyncFn`
Used In: فرم‌ها، اکشن‌های رابط کاربری
Side Effects: تغییر مقادیر واکنش‌گرای `isLoading` و `error`
Database: ندارد
API: مستقیماً ندارد، اما معمولاً برای فراخوانی API استفاده می‌شود.

## 2. useDisclosure
Function: useDisclosure
File: useDisclosure.ts
Path: src/composables/useDisclosure.ts
Purpose: مدیریت وضعیت باز و بسته بودن (Open/Close) برای Modal ها، Dropdown ها و Sidebar ها.
Parameters: `initial` (مقدار اولیه بولین، پیش‌فرض false)
Return: آبجکتی شامل `isOpen`, `open`, `close`, `toggle`
Called By: کامپوننت‌های Modal و Layout
Calls: ندارد
Used In: کامپوننت‌های UI که نیاز به تغییر وضعیت نمایش دارند.
Side Effects: تغییر مقدار واکنش‌گرای `isOpen`
Database: ندارد
API: ندارد

## 3. useFileUpload
Function: useFileUpload
File: useFileUpload.ts
Path: src/composables/useFileUpload.ts
Purpose: مدیریت کامل چرخه حیات آپلود فایل‌ها شامل اعتبارسنجی (حجم، فرمت)، آپلود، هندل کردن درگ و دراپ (Drag & Drop)، وضعیت پیشرفت (Progress) و ذخیره موقت در sessionStorage.
Parameters: `conversationIdProvider` (تابعی که شناسه چت فعلی را برمی‌گرداند)
Return: شامل استیت‌های فایل (`attachedFiles`, `limits`, `isDraggingOver` و...) و متدهای کنترل آپلود (`addFiles`, `removeFile`, `retryFile`, `waitForUploads` و...)
Called By: کامپوننت ChatComposer و بخش‌های دریافت فایل
Calls: `filesService.uploadFile`, `filesService.getFileStatus`, `filesService.deleteFile`, `uiStore.showToast`
Used In: ChatComposer
Side Effects: تغییر وضعیت لیست فایل‌ها، تعامل با sessionStorage
Database: ندارد
API: فراخوانی اندپوینت‌های مربوط به فایل از طریق `filesService`

## 4. useFormSubmit
Function: useFormSubmit
File: useFormSubmit.ts
Path: src/composables/useFormSubmit.ts
Purpose: کامپوزابل جامع برای مدیریت ثبت فرم‌ها، هندل کردن خطاهای ولیدیشن کلاس (class-validator) از سرور و نمایش پیام‌های toast.
Parameters: `submitFn` (تابع ارسال فرم)، `options` (تنظیماتی نظیر `successMessage` و هندلرهای موفقیت/خطا)
Return: استیت‌هایی نظیر `isSubmitting`, `error`, `fieldErrors` و متدهای `submit`, `reset`, `setFieldError`
Called By: کامپوننت‌های دارای فرم ورود، ثبت‌نام و پروفایل
Calls: تابع فرم `submitFn`، `uiStore.showToast`
Used In: LoginView و سایر کامپوننت‌های فرم‌دار
Side Effects: مدیریت وضعیت لودینگ و ذخیره خطاهای مربوط به هر فیلد
Database: ندارد
API: هندل کردن پاسخ‌ها و خطاهای API

## 5. useSpeechRecognition
Function: useSpeechRecognition
File: useSpeechRecognition.ts
Path: src/composables/useSpeechRecognition.ts
Purpose: پیاده‌سازی قابلیت تبدیل گفتار به متن (STT) با استفاده از SpeechRecognition API مرورگر.
Parameters: `options` (تنظیمات اختیاری نظیر `lang`, `continuous`, و هندلرها)
Return: `isListening`, `isSupported`, `transcript`, `error`, `start`, `stop`, `toggle`
Called By: دکمه میکروفون در ChatComposer
Calls: Web Speech API (`SpeechRecognition` یا `webkitSpeechRecognition`)
Used In: ChatComposer
Side Effects: استفاده از میکروفون کاربر
Database: ندارد
API: ندارد (مبتنی بر API داخلی مرورگر)

## 6. useTextToSpeech
Function: useTextToSpeech, cleanMarkdownForSpeech
File: useTextToSpeech.ts
Path: src/composables/useTextToSpeech.ts
Purpose: تبدیل متن به گفتار (TTS)؛ تلاش می‌کند ابتدا از سرویس با کیفیت Neural TTS سرور استفاده کند و در صورت خطا به TTS مرورگر فال‌بک می‌کند. همچنین مارک‌داون‌ها را برای خوانش بهتر تمیز می‌کند.
Parameters: تابع `speak` پارامترهای `messageId`, `rawText` و `preferredLang` را می‌پذیرد.
Return: `isSupported`, `isPlaying`, `isLoading`, `currentlyPlayingId`, `speak`, `stop`, `toggle`
Called By: کامپوننت MessageList / MessageItem
Calls: `fetch` برای صدا زدن اندپوینت `/api/v1/tts/synthesize` و در صورت خطا `SpeechSynthesisUtterance`
Used In: المان‌های خواندن متن پیام‌ها
Side Effects: پخش صدا، مدیریت استیت صدای در حال پخش
Database: ندارد
API: فراخوانی مستقیم API سینتز صدا (TTS) در بک‌اند

## 7. useThemeLogo
Function: useThemeLogo
File: useThemeLogo.ts
Path: src/composables/useThemeLogo.ts
Purpose: انتخاب لوگوی متناسب با تم فعلی برنامه (روشن/تاریک) با استفاده از asset های بیلد شده توسط Vite.
Parameters: ندارد
Return: `activeLogo`, `fallbackLogo`, `darkLogoUrl`, `lightLogoUrl`
Called By: کامپوننت‌های Sidebar، Header و Auth
Calls: `useUiStore` برای دریافت تم فعلی
Used In: نمایش لوگو در سرتاسر برنامه
Side Effects: ندارد
Database: ندارد
API: ندارد
