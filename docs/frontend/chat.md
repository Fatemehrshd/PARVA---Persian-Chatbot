# مستندات فرانت‌اند: Chat API Service

این سرویس وظیفه مدیریت ارتباطات شبکه با بک‌اند را در بخش چت بر عهده دارد، به خصوص برای پشتیبانی از SSE.

Function: sendMessageStream
File: chat.service.ts
Path: d:\codeless_final\frontend\src\services\chat.service.ts
Purpose: ارسال پیام کاربر به سرور با استفاده از `fetch` و دریافت رویدادهای SSE به صورت جریانی برای نمایش بلادرنگ پاسخ.
Parameters: conversationId (string), content (string), onToken (Function), onDone (Function), onError (Function), signal (AbortSignal), onTitle (Function), onSync (Function), fileIds (string[]), onSearchStatus (Function), onSources (Function), onSourcesError (Function), opts (Object), onThinking (Function), onThinkingStatus (Function)
Return: Promise<void>
Called By: chat.ts Store (executeMessageStream)
Calls: fetch, dispatchSseEvent
Used In: ارسال پیام متنی و فایل‌ها و دریافت پاسخ مدل.
Side Effects: ارسال درخواست POST به سرور و ایجاد شنونده روی جریان `ReadableStream`.
Database: ندارد
API: POST /api/v1/chat/conversations/{conversationId}/messages

Function: subscribeActiveStream
File: chat.service.ts
Path: d:\codeless_final\frontend\src\services\chat.service.ts
Purpose: اتصال مجدد به جریانی که قبلاً در سرور آغاز شده است (مثلاً بعد از رفرش صفحه).
Parameters: conversationId (string), onSync (Function), onToken (Function), onDone (Function), onError (Function), signal (AbortSignal), onTitle (Function), onSearchStatus (Function), onSources (Function), onSourcesError (Function), onThinking (Function), onThinkingStatus (Function)
Return: Promise<void>
Called By: chat.ts Store (reconnectToActiveStream)
Calls: fetch, dispatchSseEvent
Used In: بازیابی وضعیت استریم در هنگام بارگذاری مجدد برنامه.
Side Effects: اتصال به اندپوینت GET جریانی.
Database: ندارد
API: GET /api/v1/chat/conversations/{conversationId}/stream

Function: dispatchSseEvent
File: chat.service.ts
Path: d:\codeless_final\frontend\src\services\chat.service.ts
Purpose: توزیع یک رویداد خام SSE دریافت شده از سرور به کالبک مربوطه در فرانت‌اند.
Parameters: currentEvent (string), data (any), cb (SseCallbacks)
Return: 'done' | 'error' | void
Called By: sendMessageStream, subscribeActiveStream, resumeMessage
Calls: کالبک‌های پاس داده شده (onToken, onThinking, ...)
Used In: پارس کردن جریان SSE و هدایت منطق استور.
Side Effects: فراخوانی توابع استور.
Database: ندارد
API: ندارد
