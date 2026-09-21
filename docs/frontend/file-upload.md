# مستندات آپلود فایل در فرانت‌اند

آپلود فایل در فرانت‌اند با استفاده از یک کامپوزبل (Composable) به نام `useFileUpload` واقع در `src/composables/useFileUpload.ts` مدیریت می‌شود. این فایل وضعیت آپلود (آرایه `attachedFiles`) را نگهداری کرده، آپلودهای همزمان را به صورت واکنشی (Reactive) آپدیت می‌کند و محدودیت‌های آپلود را بررسی می‌نماید. داده‌ها با فراخوانی API به بک‌اند ارسال می‌شوند و سپس کامپوزبل به طور دوره‌ای (Polling) وضعیت پردازش فایل را با استفاده از متد `getFileStatus` از بک‌اند بررسی می‌کند. 

برای تصاویر از طریق `URL.createObjectURL()` یک Preview محلی نیز ساخته می‌شود که تا پایان عمر کامپوننت کاربرد دارد.

## توابع و متدهای آپلود فایل در فرانت‌اند

Function: addFiles
File: useFileUpload.ts
Path: src/composables/useFileUpload.ts
Purpose: دریافت لیستی از فایل‌ها (FileList یا File Array)، اعتبارسنجی آن‌ها و ساخت آبجکت‌های محلی و ایجاد درخواست آپلود برای هرکدام به صورت موازی.
Parameters: files: FileList | File[]
Return: Promise<void>
Called By: handleDrop و یا رویدادهای انتخاب فایل از رابط کاربری
Calls: validateFiles, resolveFileType, URL.createObjectURL, startUpload, uiStore.showToast
Used In: useFileUpload
Side Effects: تغییر state واکنشی `attachedFiles`، ایجاد Blob URLs موقت در حافظه مرورگر.
Database: ندارد
API: ندارد

Function: validateFiles
File: useFileUpload.ts
Path: src/composables/useFileUpload.ts
Purpose: بررسی فایل‌ها برای تطابق با محدودیت‌های اندازه، تعداد کل و فرمت‌های مجاز تعیین شده توسط بک‌اند.
Parameters: newFiles: File[]
Return: { valid: boolean; message?: string }
Called By: addFiles
Calls: isFileTypeSupported
Used In: useFileUpload
Side Effects: ندارد
Database: ندارد
API: ندارد

Function: startUpload
File: useFileUpload.ts
Path: src/composables/useFileUpload.ts
Purpose: اجرای عملیات بارگذاری یک فایل منفرد با شبیه‌سازی بصری نوار پیشرفت محلی، و در صورت موفقیت، فراخوانی تابع Poll برای بررسی پردازش فایل.
Parameters: item: FileAttachmentItem, file: File
Return: Promise<void>
Called By: addFiles, retryFile
Calls: filesService.uploadFile, pollFileStatus, uiStore.showToast
Used In: useFileUpload
Side Effects: تغییر درصد پیشرفت و وضعیت `item` در `attachedFiles`، برقراری درخواست HTTP آپلود فایل.
Database: ندارد
API: فراخوانی لایه service فرانت‌اند برای زدن POST /files/upload

Function: pollFileStatus
File: useFileUpload.ts
Path: src/composables/useFileUpload.ts
Purpose: بررسی مکرر وضعیت فایل در سمت بک‌اند (تا حداکثر 90 ثانیه) تا زمانی که از وضعیت `processing` به وضعیت `ready` یا `error` برسد.
Parameters: item: FileAttachmentItem
Return: Promise<void>
Called By: startUpload, retryFile
Calls: filesService.getFileStatus, saveToStorage, uiStore.showToast
Used In: useFileUpload
Side Effects: تغییر وضعیت `item`، ذخیره فایل‌های آماده در `sessionStorage` از طریق `saveToStorage`.
Database: ندارد
API: فراخوانی لایه service فرانت‌اند برای زدن GET /files/:id/status

Function: waitForUploads
File: useFileUpload.ts
Path: src/composables/useFileUpload.ts
Purpose: توقفی کوتاه برای اطمینان از اتمام ارسال تمامی فایل‌هایی که در صف آپلود سمت کلاینت قرار دارند پیش از ارسال پیام اصلی.
Parameters: None
Return: Promise<boolean>
Called By: کنترلرهای سطح رابط کاربری برای ارسال پیام (مانند ارسال چت)
Calls: None
Used In: useFileUpload
Side Effects: انتظار (Wait) مبتنی بر زمان تا زمانی که `hasUploadingFiles` فالس شود یا تایم‌اوت 20 ثانیه‌ای رخ دهد.
Database: ندارد
API: ندارد
