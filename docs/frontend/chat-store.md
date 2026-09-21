# مستندات فرانت‌اند: Chat Store (Pinia)

این استور، مدیریت وضعیت‌های پیچیده چت، صف‌بندی پیام‌ها، و جریان داده‌های SSE را برای رابط کاربری برعهده دارد.

## ساختار State
- `conversations`: لیست گفتگوهای کاربر.
- `currentConversationId`: شناسه گفتگوی فعال.
- `messages`: پیام‌های گفتگوی فعلی.
- `convStreamStates`: یک Map شامل وضعیت مستقل استریم برای هر گفتگو (شامل `isStreaming`, `isThinking`, `currentStreamingText` و...).
- `messageQueue` و `pendingMessageQueue`: صف پیام‌هایی که به دلیل استریم بودن یا پردازش فایل، منتظر ارسال هستند.
- `convFlags`: پرچم‌های مربوط به فعال‌بودن Web Search یا Thinking به ازای هر گفتگو.

## Getters
- `activeConversation`: گفتگوی در حال نمایش را برمی‌گرداند.
- `isStreaming` و `isThinking`: وضعیت استریم گفتگوی فعلی (برای رابط کاربری).
- `streamError`: خطاهای موقت استریم.
- `currentQueuedMessages`: لیست پیام‌های صف‌بندی شده برای گفتگوی فعلی.

## جریان دقیق اجرای پیام (Flow)
۱. کاربر از طریق رابط کاربری تابع `sendMessage` را صدا می‌زند.
۲. بررسی می‌شود که توکن محدود نشده باشد و سلامت سرور تأیید شود.
۳. بررسی فایل‌ها: اگر فایلی در حال پردازش (`processing`) است، پیام با `waitForFilesReadyAndDispatch` در صف انتظار فایل قرار می‌گیرد.
۴. بررسی جریان فعال: اگر استریمی در همان گفتگو در جریان است، پیام از طریق `addToQueue` به صف (`messageQueue`) می‌رود.
۵. اگر شرایط فراهم باشد، تابع `executeMessageStream` فراخوانی می‌شود.
۶. تابع `executeMessageStream` وضعیت‌های استریم را در `convStreamStates` مقداردهی کرده و تایمر نگهبان (Watchdog) را روشن می‌کند.
۷. متد `chatService.sendMessageStream` صدا زده می‌شود.
۸. با دریافت رویدادهای `onToken`، `onThinking` و `onSources` وضعیت‌ها آپدیت شده و در رابط کاربری نمایش داده می‌شوند.
۹. با دریافت `onDone`، تابع `finishStream` فراخوانی می‌شود.
۱۰. `finishStream` پیام کامل را در آرایه `messages` اضافه کرده، وضعیت استریم را پاک می‌کند و تایمرها را متوقف می‌سازد.
۱۱. در نهایت `checkAndProcessQueue` فراخوانی می‌شود تا اگر پیامی در صف بود، به صورت خودکار ارسال گردد.

## توابع و اکشن‌های کلیدی

Function: sendMessage
File: chat.ts
Path: d:\codeless_final\frontend\src\stores\chat.ts
Purpose: نقطه ورود اصلی برای ارسال پیام توسط کاربر؛ مدیریت صف‌ها، صحت فایل‌ها و ذخیره پیام در استور پیش از درخواست سرور.
Parameters: content (string), files? (FileAttachmentItem[]), opts? (Object)
Return: Promise<void>
Called By: رابط کاربری (ChatComposer.vue)
Calls: executeMessageStream, addToQueue, waitForFilesReadyAndDispatch, chatService.createConversation
Used In: ارسال هر پیامی که از کاربر وارد سیستم می‌شود.
Side Effects: اضافه کردن پیام کاربر به آرایه messages، ایجاد موقت یک مکالمه (در صورتی که اولین پیام باشد)، ذخیره در صف.
Database: `localStorage` برای ذخیره صف به صورت لوکال.
API: POST /api/v1/chat/conversations (اگر گفتگوی جدید باشد)

Function: executeMessageStream
File: chat.ts
Path: d:\codeless_final\frontend\src\stores\chat.ts
Purpose: قفل کردن وضعیت ارسال، ریست کردن متغیرهای استریم، و باز کردن ارتباط SSE با سرور برای دریافت جریان کلمات.
Parameters: convId (string), content (string), userMessage (Message), fileIds? (string[]), opts? (Object)
Return: Promise<void>
Called By: sendMessage, processNextInQueue, waitForFilesReadyAndDispatch
Calls: chatService.sendMessageStream, resetWatchdog, finishStream, checkAndProcessQueue
Used In: شروع فرآیند استریم واقعی.
Side Effects: مقداردهی `abortController`، به‌روزرسانی `currentStreamingText` با دریافت هر توکن، تغییر `isStreaming` به true.
Database: ندارد
API: فراخوانی تابع سرویس که درخواست POST ارسال می‌کند.

Function: finishStream
File: chat.ts
Path: d:\codeless_final\frontend\src\stores\chat.ts
Purpose: پایان دادن تمیز به یک استریم، درج پیام نهایی دستیار در حافظه و تحریک پردازش پیام‌های داخل صف.
Parameters: convId (string), messageId (string), isInterrupted (boolean, default=false), overrideContent? (string)
Return: void
Called By: executeMessageStream (onDone, onError کالبک‌ها), reconnectToActiveStream, stopStreaming
Calls: clearWatchdog, checkAndProcessQueue, sortConversations
Used In: هر زمان که جریان پاسخ هوش مصنوعی کامل شده یا با خطا قطع شود.
Side Effects: ثبت پیام assistant در آرایه messages، مرتب‌سازی گفتگوها در سایدبار، تغییر وضعیت `isStreaming` به false.
Database: ندارد
API: ندارد

Function: processNextInQueue
File: chat.ts
Path: d:\codeless_final\frontend\src\stores\chat.ts
Purpose: استخراج پیام بعدی از صف کاربر و اجرای آن در صورتی که محدودیتی وجود نداشته باشد.
Parameters: convId (string)
Return: Promise<boolean>
Called By: checkAndProcessQueue
Calls: sendMessage
Used In: ارسال خودکار پیام‌های روی هم جمع شده بعد از پایان استریم جاری.
Side Effects: حذف آیتم از آرایه `messageQueue` و فراخوانی مجدد `sendMessage`.
Database: آپدیت کردن `localStorage` صف.
API: ندارد
