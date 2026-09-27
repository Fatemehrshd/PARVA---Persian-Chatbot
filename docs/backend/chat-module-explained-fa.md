# ماژول Chat بک‌اند — توضیح فایل‌به‌فایل (NestJS)

> محدوده: فقط `backend/src/modules/chat/*` (۱۱ فایل)

## نقش کلی ماژول Chat

قلب محصول: **CRUD گفتگو و پیام + تولید استریمی پاسخ با SSE + سهمیه‌بندی مصرف +
اشتراک‌گذاری عمومی + نمای سازگار با OpenAI**. بزرگ‌ترین ماژول پروژه است و با
۶ ماژول دیگر حرف می‌زند (Admin, ModelsAdmin, AI, Files, Users, Subscriptions).

```
Client
 │ /chat/conversations* (CRUD + SSE) | /chat/quota | /chat/shares* | /v1/*
 ▼
ChatController (+ChatQuotaController) ── DTO ──▶ ChatService ──┬──▶ ModelsAdminService (مدل فعال؟ دسترسی؟)
 │ SSE: POST :id/messages (event: token/thinking/title/done)   ├──▶ OpenAiCompatForwarder (استریم از پروایدر واقعی)
 │                                                              ├──▶ SettingsService + EntitlementService (سهمیه)
ChatShareController ──▶ ChatShareService (لینک عمومی + fork)    ├──▶ UsersService (سقف شخصی/دوره)
OpenAiCompatController (نمای /v1 برای ابزار خارجی)              ├──▶ WebSearchService + Files (جست‌وجو/فایل)
ActiveStreamService (سشن زنده در حافظه؛ تحمل رفرش مرورگر) ◀────┘
```

## ۱) `chat.module.ts` — نقشه سیم‌کشی ماژول

**این فایل چیه؟** کلاس `ChatModule` با `@Module()`؛ مرز دامنه گفتگو.
**کار:**
- `forFeature([Conversation, Message, FileAttachment, ChatShare, AiModel])` →
  ۵ ریپازیتوری داخل همین ماژول.
- ماژول‌های همسایه: `ModelsAdminModule, AiModule, WebSearchModule` مستقیم؛
  `AdminModule, UsersModule, FilesModule, SubscriptionsModule` با `forwardRef`
  (چهار چرخه بالقوه — چت به همه نیاز دارد و همه به چت ارجاع می‌دهند).
- `controllers: [ChatController, ChatQuotaController, ChatShareController,
  OpenAiCompatController]` — هر چهار درگاه همین‌جا ثبت‌اند.
- `providers: [..., QuotaInterceptor]` و `exports: [ChatService, ChatShareService,
  ActiveStreamService]` → `ResponseEnvelopeInterceptor` سراسری و ماژول ادمین
  (برای `getQuotaState` در هدر X-User-Quota) از همین سرویس‌ها استفاده می‌کنند.
**چرا در Nest وجود داره؟** پراتصال‌ترین Module پروژه؛ بدون forwardRef اصلاً بالا
نمی‌آید. محل ثبت DI از مالکیت دامنه‌ای جداست (مثل AdminFiles که در FilesModule ثبت شد).

## ۲) `chat.controller.ts` — درگاه HTTP + استریم SSE

**این فایل چیه؟** دو کلاس: `ChatController` روی `@Controller('chat/conversations')`
و `ChatQuotaController` روی `@Controller('chat')`. هر دو
`@UseGuards(JwtAuthGuard)` + `@UseInterceptors(QuotaInterceptor)` در سطح کلاس
دارند (احراز + مهر سهمیه روی هر پاسخ؛ همان هدری که سایدبار می‌خواند).
**اندپوینت‌ها:**
- `GET /` لیست (limit/page)؛ `GET search?q=` جست‌وجو؛ `POST /` ساخت با
  `CreateConvDto`؛ `PATCH :id` ویرایش عنوان/مدل/پین (حداقل یکی الزامی وگرنه ۴۰۰)؛
  `PATCH :id/pin` تاگل؛ `DELETE :id` (۲۰۴) حذف نرم؛ `DELETE :id/messages/:messageId`
  حذف پیام؛ `PATCH .../feedback` لایک/دیسلایک (فقط like/dislike/null)؛
  `GET :id/messages` تاریخچه؛ `GET :id/active-stream` وضعیت سشن زنده؛
  `POST :id/stop` توقف.
- `POST :id/messages` (مهم‌ترین): بادی `SendMsgDto`؛ اگر `Accept: application/json`
  بود کل استریم بافر و یک JSON برمی‌گردد (برای تست/ابزار)، وگرنه SSE با
  `Content-Type: text/event-stream` و ایونت‌ها: `sync, search-status, sources,
  thinking-status, thinking, token, title, done, error`. قطع اتصال کلاینت
  (`req.on('close')`) فقط نوشتن را متوقف می‌کند، نه تولید را (تولید در
  ActiveStreamService زنده می‌ماند).
- `GET :id/stream` اتصال مجدد به استریم فعال (resume بعد از رفرش)؛
  `POST :id/messages/:messageId/resume` ادامه از پیام ناتمام؛
  `POST :id/messages/:messageId/stop` توقف تکی.
- `ChatQuotaController: GET /chat/quota` → `chat.getQuotaState(userId)`؛ همان
  منبعی که سایدبار موقع لود اولیه می‌خواند.

## ۳) `chat.service.ts` — مغز ماژول (۱۳۶۴ خط، `@Injectable`)

**این فایل چیه؟** بزرگ‌ترین فایل بک‌اند؛ همه قوانین چت: مالکیت، سهمیه، تولید،
عنوان، فیدبک، توقف، resume. چند تابع خالص هم export می‌کند تا unit-test شوند.
**بخش‌بخش:**
- **وابستگی‌ها:** ریپازیتوری Conversation/Message/FileAttachment + پنج سرویس
  (ModelsAdmin, Settings, Users, WebSearch, Entitlements — آخری Optional) +
  `OpenAiCompatForwarder` (پل به پروایدر واقعی) + `ActiveStreamService` (سشن زنده).
- **توابع خالص exportشده:** `calculateEffectiveTokens` (ضرب ضرایب جست‌وجو/تفکر)،
  `resolveAttachmentMultiplier`، `calculateAttachmentTokens` (عکس: کاشی ۵۱۲ + ۱۷۰
  توکن؛ سند: هر ۵۰۰ بایت ≈ ۱۰۰ توکن؛ با ضرایب ادمین)، `QuotaExceededException`
  (بدنه `{error:'QUOTA_EXCEEDED', reason, resetAt}`).
- **CRUD + مالکیت:** `list/create/history/updateTitle/setModel/setPinned/togglePin/
  delete/deleteMessage/setMessageFeedback` — همه با `assertOwned(userId, id)` یعنی
  هیچ کاربری به گفتگوی دیگری نمی‌رسد؛ حذف‌ها نرم (`isDeleted=true`).
- **سهمیه (`resolveQuota/assertQuota/getQuotaState`):** آبشار شخصی ← اشتراک
  (EntitlementService) ← نقش ← سراسری؛ `syncPeriod` شمارنده دوره را تازه می‌کند؛
  ادمین نامحدود. `assertQuota` قبل از تولید ۴۰۰ می‌دهد؛ `getQuotaState` همان
  درصد سایدبار (min توکن/پیام) + `blocked/reason/resetAt` برمی‌گرداند.
- **تولید (`*generate`):** جنراتور `AsyncGenerator<ChatChunk>`: چک سهمیه ← ذخیره
  پیام کاربر ← ساخت/بازیابی سشن در ActiveStreamService ← بیلد تاریخچه (سقف ۲۰ پیام)
  + system prompt از تنظیمات ← جست‌وجوی وب (اختیاری، با sources) ← استریم توکن از
  forwarder (یا echo آفلاین در dev) ← تولید عنوان خودکار (`generateTitle`: اول با
  مدل واقعی، fallback برش ۳۵ کاراکتری) ← ذخیره پیام دستیار + ثبت مصرف
  (`incrementUsage` با taskType) ← انتشار `done`. خطا به‌صورت chunk خطا، نه throw
  (تا SSE نمیرد).
- **`generateTitle`:** اول با خود LLM (پرامپت ۳-۵ کلمه‌ای هم‌زبان)، شکست → برش
  هوشمند؛ هرگز null برنمی‌گرداند.
**چرا در Nest؟** Service چاق استاندارد: تمام تصمیم‌ها قابل inject و قابل تست،

## ۴) `active-stream.service.ts` — سشن زنده در حافظه (`@Injectable`)

**این فایل چیه؟** رجیستری `Map<conversationId, Session>` جدا از سوکت HTTP؛ دلیل
وجودی‌اش یک جمله کامنت بالای کلاس است: «اگر کاربر رفرش کند یا اینترنت لحظه‌ای
قطع شود، تولید بی‌وقفه ادامه می‌یابد».
**کار:** `startSession` (اگر سشن thinking/streaming هست همان را بده، نه سشن جدید —
ضد تولید موازی) + تایمر ۳۵ثانیه‌ای گیرکردن در thinking؛ `publishToken/publishThinking/
completeSession/failSession/abortSession` انتشار به `subscribers:Set` (هر تب یک
subscriber)؛ `subscribe` برمی‌گرداند unsubscribe؛ `getActiveStatus` برای اتصال
مجدد (متن انباشته + وضعیت)؛ `scheduleCleanup` حذف سشن ۱۵-۶۰ ثانیه بعد از اتمام
(با `unref` تا تست‌ها گیر نکنند). `AbortController` هر سشن دکمه stop را واقعی
می‌کند.
**ارتباط:** فقط ChatService از آن استفاده می‌کند (ساخت/انتشار/پایان) و کنترلر
از طریق `subscribeToStream/getActiveStreamStatus` می‌خواند؛ به DB دست نمی‌زند.
**چرا در Nest؟** جدا کردن عمر تولید از عمر اتصال — بدون این، هر رفرش = سوختن
هزینه LLM و شروع دوباره. Stateful بودن آگاهانه و محدود (حافظه، نه DB).

## ۵) `chat-share.controller.ts` + ۶) `chat-share.service.ts` — اشتراک عمومی

**چی‌ان؟** کنترلر `@Controller('chat')` نازک (۵ روت) + سرویس `@Injectable` با ۴
ریپازیتوری (Share/Conversation/Message/AiModel).
**کار کنترلر:** `POST conversations/:id/share` ساخت/به‌روزرسانی (با گارد)،
`GET .../share` وضعیت لینک مالک (با گارد)، `DELETE .../share` باطل‌کردن،
`GET shares/:shareCode` **عمومی بدون گارد** (تنها اندپوینت بی‌احراز کل ماژول)،
`POST shares/:shareCode/fork` کپی به حساب خودم (با گارد).
**کار سرویس:** چک مالکیت (غیرمالک → ۴۰۳)؛ گفتگوی خالی → ۴۰۰؛ ساخت `shareCode`
۱۲کاراکتری با `crypto.randomBytes`؛ **اسنپ‌شات frozen در `jsonb`** — پیام‌های بعدی
گفتگوی اصلی هرگز روی لینک اثر ندارند؛ `viewCount` با increment ناهمزمان؛ `revoke`
فقط `isActive=false` (لینک می‌میرد ولی رکورد می‌ماند)؛ `forkShare` گفتگوی جدید
«(نسخه کپی)» با کپی پیام‌ها می‌سازد.
**چرا در Nest؟** تفکیک لینک عمومی از گفتگوی خصوصی: یک جفت Controller/Service
مستقل با مرز احراز متفاوت (عمومی در برابر خصوصی) — تمیزترین راه بدون آلوده‌کردن
ChatService.

## ۷) `openai-compat.controller.ts` — نمای `/v1` برای ابزار خارجی

**این فایل چیه؟** `@Controller('v1')` با `@UseGuards(JwtAuthGuard)`؛ وانمود می‌کند
این پلتفرم خودش OpenAI است تا ابزارهای بیرونی (کلاینت‌های OpenAI) بدون تغییر کد
وصل شوند. فقط دو مسیر مستند: `GET /v1/models` و `POST /v1/chat/completions`.
**کار:** `listModels` از `listActive()` با شکل `{object:'list', data:[{id:apiIdentifier,
owned_by:provider,...}]}`؛ `chat/completions` مدل درخواستی را با `apiIdentifier`
تطبیق (نبود → ۴۰۴)، target را از forwarder می‌گیرد، اگر `stream:true` چانک‌های
`chat.completion.chunk` + `data: [DONE]` وگرنه آبجکت کامل + `usage` تخمینی
(طول/۴) برمی‌گرداند؛ بدون هیچ credential (dev) همان echo آفلاین.
پاسخ‌ها شکل خام OpenAI دارند چون envelope سراسری مسیرهای `/v1` را skip می‌کند.
**ارتباط:** `ModelsAdminService` (کدام مدل فعال است) + `OpenAiCompatForwarder`
(استریم واقعی)؛ به Conversation/Message دست نمی‌زند (stateless، بدون ذخیره چت).
**چرا در Nest؟** Facade/Adapter: قرارداد بیرونی (OpenAI) از مدل داخلی جدا؛
ابزار خارجی لازم نیست API اختصاصی ما را یاد بگیرد.

## ۸) `dto.ts` — قرارداد ورودی چت

**این فایل چیه؟** سه کلاس: `CreateConvDto` (modelId اختیاری UUID، title اختیاری)،
`UpdateConvDto` (title/modelId/isPinned — حداقل یکی در کنترلر چک می‌شود)،
`SendMsgDto` (نکته: `content` با `@ValidateIf(بدون فایل)` اجباری است — یعنی پیام
فقط-فایلی مجاز است؛ `fileIds` آرایه؛ `useWebSearch/useThinking` بولین).
پیام‌ها فارسی از `FA`.
**چرا در Nest؟** مرز Validation مثل ماژول‌های دیگر؛ `whitelist:true` جلوی تزریق
فیلد اضافه به generate را می‌گیرد.

## ۹) `conversation.entity.ts` + ۱۰) `message.entity.ts` — جدول‌های اصلی

**چی‌ان؟** `@Entity('conversations')` و `@Entity('messages')` با رابطه
OneToMany/ManyToOne (حذف گفتگو → CASCADE پیام‌ها؛ حذف کاربر → SET NULL).
**ستون‌های کلیدی Conversation:** `title/modelId/userId` + `isDeleted` (حذف نرم) +
`isPinned` (سنجاق) + createdAt/updatedAt.
**ستون‌های کلیدی Message:** `role/content(conversationId` + `isInterrupted/
stoppedByUser` (توقف وسط تولید) + `isDeleted` + `sources(jsonb)` (منابع جست‌وجو) +
`reasoning_content` و `thinkingDurationMs` (تفکر عمیق) + `feedback(like/dislike)`
(همان که داشبورد ادمین می‌شمارد) + relation فایل‌ها.
**چرا در Nest/TypeORM؟** دو جدول، کل تاریخچه محصول؛ jsonb برای sources چون
اسکیمای ثابت ندارد و کوئری ساخت‌یافته رویش لازم نیست.

## ۱۱) `chat-share.entity.ts` — جدول لینک‌ها

**این فایل چیه؟** `@Entity('chat_shares')` با `shareCode` یکتای ۳۲کاراکتری
(ایندکس unique)، `snapshotMessages: jsonb` (فریز کامل پیام‌ها با sources و
reasoning)، `isActive` (باطل‌پذیری بدون حذف)، `viewCount`، و relationها
(حذف گفتگو → SET NULL تا لینک نمیرد؛ حذف کاربر → CASCADE).
**چرا جدول جدا؟** یک گفتگو حداکثر یک لینک فعال دارد ولی تاریخچه لینک‌ها و
viewCount باید مستقل از پیام‌ها بماند؛ jsonb چون اسنپ‌شات immuttable است و join
نمی‌خواهد.

## جمع‌بندی یک‌خطی

| فایل | در یک جمله |
|---|---|
| `chat.module.ts` | پراتصال‌ترین سیم‌کشی؛ ۴ forwardRef برای ۴ چرخه |
| `chat.controller.ts` | درگاه CRUD + SSE با ۹ نوع ایونت + سهمیه روی هر پاسخ |
| `chat.service.ts` | مغز ۱۳۶۴خطی؛ مالکیت، سهمیه، تولید، عنوان، مصرف |
| `active-stream.service.ts` | حافظه سشن زنده؛ رفرش مرورگر تولید را نمی‌کشد |
| `chat-share.controller.ts` | ۵ روت لینک؛ تنها مسیر بی‌احراز ماژول اینجاست |
| `chat-share.service.ts` | اسنپ‌شات frozen + fork + باطل بدون حذف |
| `openai-compat.controller.ts` | نقاب OpenAI؛ ابزار بیرونی بدون تغییر وصل می‌شود |
| `dto.ts` | قرارداد؛ پیام فقط-فایلی مجاز است |
| `conversation/message.entity.ts` | تاریخچه محصول؛ حذف نرم + thinking + feedback |
| `chat-share.entity.ts` | لینک مستقل با viewCount و اسنپ‌شات immuttable |

مستقل از SSE/HTTP؛ کنترلر فقط لوله‌کشی ایونت است.

**ارتباط:** DTO از `dto.ts`، منطق از `ChatService`، مهر سهمیه از QuotaInterceptor.
**چرا در Nest؟** Transport نازک؛ منطق SSE (هدر/ایونت/قطعی) در Controller و تولید
توکن در Service — تعریف‌شده‌ترین مرز استریم در Nest (کنترلر `@Res()` خام می‌گیرد).
