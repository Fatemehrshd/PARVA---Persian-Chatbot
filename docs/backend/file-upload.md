# مستندات آپلود فایل در بک‌اند

روند آپلود فایل در بک‌اند از کنترلر `FilesController` (با استفاده از `FileInterceptor` و `FilesInterceptor` مربوط به Multer) آغاز می‌شود. فایل‌ها به سرویس `FilesService` منتقل شده و از آنجا پس از اعتبارسنجی حجم و فرمت، و اسکن بدافزار، بر روی MinIO توسط `StorageService` ذخیره می‌شوند. سپس یک رکورد در دیتابیس (جداول TypeORM) درج می‌گردد و شناسه آن برای پردازش استخراج متن یا متادیتا به صف `BullMQ` (توسط `QueueManagerService`) ارسال می‌شود.

علاوه بر این، آپلود آواتار کاربران در `UsersController` مدیریت می‌شود و با ذخیره‌سازی در حافظه موقت `memoryStorage()`، مستقیما به MinIO ارسال می‌شود.

## توابع و متدهای کنترلر و سرویس آپلود فایل

Function: uploadSingle
File: files.controller.ts
Path: src/modules/files/files.controller.ts
Purpose: دریافت درخواست آپلود یکتای فایل از کلاینت و انتقال آن به سرویس مربوطه.
Parameters: req: any, file: Express.Multer.File, conversationId?: string
Return: Promise<UploadedFileInfo>
Called By: HTTP POST /files/upload
Calls: filesService.uploadFile
Used In: FilesController
Side Effects: ندارد
Database: ندارد
API: POST /files/upload

Function: uploadMultiple
File: files.controller.ts
Path: src/modules/files/files.controller.ts
Purpose: دریافت و پردازش آپلود دسته‌جمعی فایل‌ها با رعایت محدودیت‌های سقف تعداد و حجم کل تنظیم شده در دیتابیس.
Parameters: req: any, files: Express.Multer.File[], conversationId?: string
Return: Promise<UploadedFileInfo[]>
Called By: HTTP POST /files/upload-multiple
Calls: filesService.getUploadLimits, filesService.uploadFile
Used In: FilesController
Side Effects: ندارد
Database: ندارد
API: POST /files/upload-multiple

Function: getContent
File: files.controller.ts
Path: src/modules/files/files.controller.ts
Purpose: دریافت محتوای باینری فایل از MinIO و بازگرداندن آن به صورت استریم یا فایل دانلودی در HTTP Response.
Parameters: req: any, id: string, res: Response
Return: Promise<void>
Called By: HTTP GET /files/:id/content
Calls: filesService.getFileRecord, filesService.getFileBuffer, fixUtf8MangledString
Used In: FilesController
Side Effects: تنظیم هدرهای HTTP و اتمام چرخه درخواست
Database: ندارد (ارسال به سرویس)
API: GET /files/:id/content

Function: uploadFile
File: files.service.ts
Path: src/modules/files/files.service.ts
Purpose: هسته اصلی آپلود و ذخیره‌سازی فایل. شامل اعتبارسنجی، اسکن بدافزار، ذخیره در MinIO، ثبت در دیتابیس و قرار دادن در صف BullMQ.
Parameters: userId: string, file: Express.Multer.File, conversationId?: string, overrideOriginalName?: string
Return: Promise<UploadedFileInfo>
Called By: uploadSingle, uploadMultiple
Calls: getUploadLimits, resolveFileType, scanner.scanBuffer, storage.put, fileRepo.create, fileRepo.save, queue.enqueueFileProcessing
Used In: FilesService
Side Effects: آپلود باینری به MinIO، درج یک رکورد فایل در دیتابیس، ثبت کار (Job) در صف Redis
Database: FileAttachment (TypeORM - Insert)
API: ندارد

Function: resolveFileType
File: files.service.ts
Path: src/modules/files/files.service.ts
Purpose: دسته‌بندی فایل به یکی از انواع (image, pdf, excel, text) بر اساس mimeType و پسوند نام فایل.
Parameters: mimeType: string, filename: string
Return: FileAttachmentType
Called By: uploadFile
Calls: None
Used In: FilesService
Side Effects: ندارد
Database: ندارد
API: ندارد

Function: uploadAvatar
File: users.controller.ts
Path: src/modules/users/users.controller.ts
Purpose: دریافت تصویر آواتار در حافظه و ارسال آن به ProfileService جهت تغییر پروفایل کاربری. (محدود به 2 مگابایت با Multer memoryStorage).
Parameters: user: any, file?: Express.Multer.File
Return: Promise<any> (Profile JSON)
Called By: HTTP POST /users/me/avatar
Calls: profile.setAvatar
Used In: UsersController
Side Effects: ندارد
Database: ندارد
API: POST /users/me/avatar

Function: setAvatar
File: profile.service.ts
Path: src/modules/users/profile.service.ts
Purpose: جایگزین‌کردن تصویر آواتار کاربر در MinIO و دیتابیس و حذف تصویر قبلی (برای جلوگیری از هرز رفتن فضای ذخیره‌سازی).
Parameters: userId: string, file: { buffer?: Buffer; mimetype?: string } | undefined
Return: Promise<any> (Profile JSON)
Called By: uploadAvatar
Calls: mustFind, storage.put, storage.publicUrl, users.save, storage.remove
Used In: ProfileService
Side Effects: ذخیره فایل در MinIO، پاک کردن فایل قدیمی از MinIO، بروزرسانی فیلد آواتار در دیتابیس.
Database: User (TypeORM - Update)
API: ندارد
