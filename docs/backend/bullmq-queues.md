# مستندات سیستم صف (BullMQ) در بک‌اند

در این پروژه به جای استفاده از ماژول استاندارد و دکوریتورهای NestJS (`@nestjs/bull` شامل `@Processor`، `@Process`، `BullModule`، و `@InjectQueue`)، کتابخانه `bullmq` به صورت مستقیم (Raw) درون سرویس `QueueManagerService` مقداردهی و استفاده شده است. این روش برای کنترل دقیق‌تر روی اتصال به Redis و پیاده‌سازی یک Fallback درون‌حافظه‌ای (In-memory) برای زمان‌هایی که Redis در دسترس نیست (مانند محیط‌های CI) انتخاب شده است.

## اطلاعات کلی صف‌ها
- **نام صف‌ها**: `file-processing` و `message-queue`.
- **ارسال کنندگان (Producers)**: متدهای داخل `QueueManagerService` (شامل `enqueueFileProcessing` و `enqueueChatMessage`).
- **کارگرها (Workers)**: در متد `initRedisAndQueues` یک `Worker` برای صف `file-processing` با همزمانی (concurrency) برابر با 5 ساخته می‌شود.
- **تلاش مجدد و Backoff**: در تنظیمات Redis مربوط به IORedis گزینه `maxRetriesPerRequest: null` تنظیم شده است. در صورت در دسترس نبودن Redis، پردازشگر درون‌حافظه‌ای جایگزین به کار می‌رود. منطق Retry برای فایل‌ها به صورت API دستی (در فایل‌های کنترلر) وجود دارد اما BullMQ به صورت ذاتی با backoff پیش‌فرض بدون تعریف خاصی در این سرویس اجرا می‌شود.
- **اطلاعات Payload (داده‌های جاب)**:
  - برای پردازش فایل: `{ fileId: string }`
  - برای پیام‌های چت: `{ conversationId: string; userId: string; content: string; fileIds?: string[] }`

## توابع و متدهای سیستم صف

Function: initRedisAndQueues
File: queue-manager.service.ts
Path: src/modules/files/queue-manager.service.ts
Purpose: راه‌اندازی و اتصال به سرور Redis با IORedis و نمونه‌سازی مستقیم Queue و Worker های BullMQ.
Parameters: None
Return: Promise<void>
Called By: onModuleInit
Calls: new IORedis(), new Queue(), new Worker(), fileProcessor.processFile()
Used In: QueueManagerService
Side Effects: برقراری اتصال شبکه به Redis، مقداردهی به متغیرهای کلاس برای Queue و Worker.
Database: ندارد
API: ندارد

Function: enqueueFileProcessing
File: queue-manager.service.ts
Path: src/modules/files/queue-manager.service.ts
Purpose: اضافه‌کردن یک کار (Job) جدید برای پردازش پس‌زمینه فایل. در صورت عدم دسترسی به Redis، از Fallback درون‌حافظه‌ای با `setImmediate` استفاده می‌کند.
Parameters: fileId: string
Return: Promise<void>
Called By: FilesService.uploadFile, FilesService.retryFileProcessing
Calls: fileQueue.add(), fileProcessor.processFile() (in fallback)
Used In: QueueManagerService
Side Effects: درج کار در Redis یا اجرای فوری با setImmediate.
Database: ندارد
API: ندارد

Function: enqueueChatMessage
File: queue-manager.service.ts
Path: src/modules/files/queue-manager.service.ts
Purpose: درج یک پیام چت جدید در صف `message-queue` به منظور جلوگیری از تداخل در استریمینگ. در صورت عدم دسترسی به Redis، آن را در آرایه `pendingMessageJobs` ذخیره می‌کند.
Parameters: messageData: { conversationId: string; userId: string; content: string; fileIds?: string[]; }, executor: (data: typeof messageData) => Promise<void>
Return: Promise<string> (jobId)
Called By: بخش‌های مرتبط با چت (استنتاج از نام متد)
Calls: messageQueue.add()
Used In: QueueManagerService
Side Effects: درج کار در صف Redis یا ذخیره در حافظه موقت.
Database: ندارد
API: ندارد

Function: processFile
File: file-processor.service.ts
Path: src/modules/files/file-processor.service.ts
Purpose: پردازش نهایی فایل بر اساس نوع آن (استخراج متن از PDF/متن/اکسل یا ساخت داده‌های بینایی برای تصاویر).
Parameters: fileId: string
Return: Promise<void>
Called By: Worker در initRedisAndQueues یا enqueueFileProcessing در صورت نبود Redis.
Calls: processImage, processPdf, processExcel, processText, storage.getBuffer
Used In: FileProcessorService
Side Effects: به‌روزرسانی متادیتا و متن استخراج‌شده فایل در دیتابیس، ثبت تله‌متری (Span).
Database: FileAttachment (TypeORM - Update status and metadata)
API: ندارد
