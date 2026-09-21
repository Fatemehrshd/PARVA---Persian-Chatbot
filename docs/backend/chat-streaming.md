# مستندات بک‌اند: Chat & Streaming

این بخش شامل جریان اصلی استریم و تولید پیام در سمت بک‌اند است. جریان اصلی شامل دریافت درخواست، اعتبارسنجی توکن‌ها و دسترسی‌ها، مدیریت نشست استریمینگ (Active Stream) و ارتباط با OpenAI Compat Forwarder است.

Function: streamActive
File: chat.controller.ts
Path: d:\codeless_final\backend\src\modules\chat\chat.controller.ts
Purpose: اتصال کلاینت به جریان استریم و ارسال رویدادهای Server-Sent Events (SSE) به سمت کاربر.
Parameters: req (Request), res (Response), id (string)
Return: void (جریان داده را روی پاسخ HTTP می‌نویسد)
Called By: Router (GET /chat/conversations/:id/stream)
Calls: this.chat.subscribeToStream
Used In: دریافت پاسخ به صورت بلادرنگ توسط کلاینت‌ها (در زمان رفرش صفحه یا اتصال مجدد).
Side Effects: مدیریت قطع اتصال کلاینت و پایان جریان.
Database: ندارد
API: GET /chat/conversations/:id/stream

Function: send
File: chat.controller.ts
Path: d:\codeless_final\backend\src\modules\chat\chat.controller.ts
Purpose: دریافت پیام جدید از کاربر، راه‌اندازی فرآیند تولید پاسخ و ارسال جریانی (SSE) کلمات به سمت کاربر.
Parameters: req (Request), res (Response), id (string), d (SendMsgDto)
Return: void (یا JSON در صورت درخواست non-streaming)
Called By: Router (POST /chat/conversations/:id/messages)
Calls: this.chat.generate
Used In: ارسال پیام جدید توسط کاربر در رابط کاربری چت.
Side Effects: توقف جریان قبلی در صورت وجود، ذخیره پیام کاربر، شروع نشست جدید.
Database: ندارد (از طریق سرویس در دیتابیس می‌نویسد)
API: POST /chat/conversations/:id/messages

Function: generate
File: chat.service.ts
Path: d:\codeless_final\backend\src\modules\chat\chat.service.ts
Purpose: هسته اصلی تولید پیام. بررسی محدودیت‌ها، ایجاد نشست استریم، جستجوی وب (در صورت نیاز)، ارسال درخواست به مدل هوش مصنوعی و تولید خروجی به صورت AsyncGenerator.
Parameters: userId (string), id (string), content (string), fileIds (string[]), options (Object)
Return: AsyncGenerator<ChatChunk>
Called By: chat.controller.ts (send method)
Calls: this.assertOwned, this.assertQuota, this.activeStream.startSession, this.webSearch.search, this.forwarder.resolveTarget, this.activeStream.appendToken
Used In: پاسخ‌دهی به پیام‌های کاربران.
Side Effects: کسر سهمیه (Quota)، ایجاد پیام کاربر در دیتابیس، آپدیت وضعیت فایل‌های پیوست، لغو استریم قبلی روی همین چت.
Database: جداول Conversation، Message، FileAttachment
API: ارتباط غیرمستقیم با ارائه‌دهندگان هوش مصنوعی (از طریق OpenAiCompatForwarder).

Function: startSession
File: active-stream.service.ts
Path: d:\codeless_final\backend\src\modules\chat\active-stream.service.ts
Purpose: ایجاد یا بازیابی یک نشست استریم در حافظه برای مدیریت وضعیت تولید مستقل از اتصال HTTP کاربر.
Parameters: conversationId (string), userId (string), userPrompt (string)
Return: ActiveStreamSession
Called By: chat.service.ts (generate method)
Calls: setTimeout (برای مدیریت Timeout)
Used In: مدیریت چرخه حیات استریم‌های در حال اجرا.
Side Effects: ایجاد تایمرهای Watchdog برای جلوگیری از قفل شدن وضعیت thinking.
Database: ندارد
API: ندارد
