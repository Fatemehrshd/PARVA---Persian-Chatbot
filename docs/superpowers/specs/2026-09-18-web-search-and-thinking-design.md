# طراحی: جستجوی زنده وب + تفکر عمیق (دو قابلیت چت)

تاریخ: 2026-09-18
وضعیت: تایید شده توسط کاربر در گفتگوی طراحی
مسیر: Architectural - قرارداد SSE مشترک بک/فرانت تغییر می‌کند؛ دو فاز مستقل با اولویت Search.

## 1. تصمیم‌های قطعی

- پروایدر جستجو: Serper.dev (Google) - کلید از env با نام SERPER_API_KEY
- محل اجرای جستجو: سمت بک‌اند، ماژول جدید web-search
- UI منابع: کارت منابع زیر پاسخ به صورت جمع‌شونده + استنادهای شماره‌دار [1] کلیک‌پذیر درون متن
- محدودیت پروتکل: فقط مدل‌های OpenAI-compatible (مسیر chat/completions) پشتیبانی می‌شود؛ reasoning فقط از اکستنشن‌های دلتای همین پروتکل (reasoning_content/reasoning) خوانده می‌شود. نیازی به فرمت‌های اختصاصی (Responses API و...) نیست.
- محتوای کادر تفکر: فقط reasoning واقعی مدل از دلتای OpenAI-compatible. هیچ متن ساختگی تولید نمی‌شود.
- ذخیره‌سازی: منابع در ستون jsonb روی Message؛ متن تفکر در ستون thinkingText (به‌همراه thinkingDurationMs) ذخیره می‌شود و بعد از رفرش به‌صورت جمع‌شده نمایش داده می‌شود.
- تاگل‌ها در منوی + داخل فیلد ورودی: جستجوی وب و تفکر عمیق
- کلید سراسری ادمین برای جستجو: پیش‌فرض روشن
- ترتیب اجرا: دو فاز جدا، اول Search بعد Thinking
- شکست جستجو: ادامه پاسخ بدون منابع + یادداشت «جستجوی وب ناموفق بود؛ این پاسخ بدون استفاده از منابع وب تولید می‌شود»
- محل کارت منابع: زیر پاسخ
- رفتار کادر تفکر: استریم زنده + جمع‌شدن خودکار + نمایش مدت زمان تفکر
- دامنه تفکر: فقط وقتی تاگل روشن است
- دامنه جستجو: فقط وقتی کلید ادمین روشن و تاگل کاربر روشن است
- ماندگاری انتخاب: برای همان گفتگو حفظ می‌شود، پس از رفرش بازیابی می‌گردد، گفتگوی جدید هر دو خاموش
- مدل ناسازگار با تفکر: گزینه غیرفعال با توضیح، بدون تغییر خودکار مدل

## 2. معماری فعلی مبنا

- ChatComposer -> chat store executeMessageStream -> chatService.sendMessageStream (SSE POST)
- رویدادهای فعلی SSE: token, sync, title, done, error
- بک: ChatController.send -> ChatService.generate (AsyncGenerator ChatChunk)
- OpenAiCompatForwarder.stream فقط delta.content را استخراج می‌کند
- ActiveStreamService نشست مستقل از کلاینت با بافر accumulatedText
- Message entity: id, conversationId, role, content, isInterrupted, stoppedByUser, isDeleted
- ThinkingIndicator فعلی فقط سه‌نقطه انتظار است

## 3. فاز 1: Web Search

### 3.1 بک‌اند

ماژول جدید: backend/src/modules/web-search/

- web-search.module.ts: providers = [WebSearchService], exports = [WebSearchService]
- web-search.service.ts:
  - search(query: string): Promise<SearchResult[]>
  - ورودی: query تمیز شده، حداکثر 8 نتیجه
  - خروجی: [{ title, url, snippet }]
  - timeout داخلی 10 ثانیه، خطا به کالر پرتاب می‌شود تا generate آن را به sources-error تبدیل کند
  - کلید: process.env.SERPER_API_KEY، اگر خالی بود خطای شفاف بده
- ChatService.generate امضا گسترش می‌یابد:
  - generate(userId, id, content, fileIds?, options?: { useWebSearch?: boolean })
- ترتیب داخل generate وقتی useWebSearch true و کلید ادمین روشن:
  1. yield { searchStatus: 'searching' }
  2. فراخوانی WebSearchService.search
  3. موفق: yield { sources: [...] } و تزریق بلوک منابع به system prompt + دستور ارجاع [n]
  4. شکست: yield { searchFailed: true } و ادامه بدون منابع + متن یادداشت در پاسخ نهایی ذخیره شود
- ChatChunk گسترش: { searchStatus?: 'searching', sources?: Source[], searchFailed?: boolean }
- ChatController.send و streamActive: رویدادهای جدید SSE:
  - event: search-status { state: 'searching' }
  - event: sources { sources: [...] }
  - event: sources-error { message }
- SendMsgDto: دو فیلد optional جدید:
  - useWebSearch?: boolean
- Settings: کلید system_settings با key = web_search_enabled، مقدار text برابر true/false، پیش‌فرض true. متد getWebSearchEnabled در SettingsService.
- Message entity + migration:
  - ستون sources از نوع jsonb nullable
  - فقط title, url, snippet ذخیره شود
  - هنگام save پیام assistant در generate، sources ست شود؛ در حالت searchFailed مقدار sources برابر null است. پرچم searchFailed فقط وضعیت زنده استریم است و در DB ذخیره نمی‌شود؛ برای صادق بودن تاریخچه، متن یادداشت شکست داخل content ذخیره می‌شود تا پس از رفرش هم دیده شود.
- ActiveStreamService:
  - session.sources?: Source[]
  - متد setSources(conversationId, sources)
  - رویداد sync برای کلاینت دیرنده باید sources را هم بدهد تا کارت منابع پس از reconnect دیده شود

### 3.2 فرانت‌اند

- types/index.ts:
  - WebSource { title: string, url: string, snippet?: string }
  - Message.sources?: WebSource[]
  - Message.searchFailed?: boolean
  - SendMessageRequest.useWebSearch?: boolean
- ChatComposer منوی +:
  - دو آیتم تاگل: جستجوی وب، تفکر عمیق (در فاز 1 فقط جستجو فعال؛ تفکر غیرفعال یا مخفی تا فاز 2؟ تصمیم: آیتم تفکر در فاز 1 اضافه نشود تا UI ناقص ندهیم)
  - انتخاب per-conversation در chat store نگه‌داری شود و پس از رفرش از localStorage/sessionStorage بازیابی شود
- chat store executeMessageStream:
  - کال‌بک‌های جدید onSources, onSearchStatus, onSourcesError
  - state استریم: streamingSources, isSearching
- chat.service.ts readSseStream:
  - parse رویدادهای sources, search-status, sources-error
- MessageBubble:
  - بخش جمع‌شونده «منابع» زیر پاسخ
  - نمایش چند کارت اولیه + دکمه نمایش همه
  - استناد [n] درون MarkdownContent به لینک تبدیل شود (فاز 1: حداقل با رندر ساده لینک‌دار؛ اگر marked annotation ندارد، پس‌پردازش متن)
- تاریخچه: GET messages باید sources را برگرداند؛ MessageBubble از همان استفاده می‌کند

### 3.3 تست فاز 1

- بک: integration تست generate با WebSearchService فیک: happy path (sources تزریق + yield) + خطا (ادامه بدون منابع + searchFailed)
- فرانت: unit تست MessageBubble با sources + تست readSseStream برای رویداد sources
- دستی: toggle روشن/خاموش، کلید ادمین خاموش، قطع Serper، رفرش وسط استریم

## 4. فاز 2: Thinking

### 4.1 اصل صداقت

- کادر تفکر فقط چیزی را نشان می‌دهد که پروایدر برگردانده است (reasoning_content delta یا reasoning summary).
- مخفی بودن کادر به معنی خاموش شدن هزینه reasoning نیست.
- اگر مدل delta reasoning نفرستد، کادر ظاهر نمی‌شود حتی اگر تاگل روشن باشد.

### 4.2 بک‌اند

- OpenAiCompatForwarder.stream (پروتکل فقط OpenAI-compatible):
  - علاوه بر choices[0].delta.content، فیلدهای choices[0].delta.reasoning_content و reasoning را هم بخواند
  - نوع خروجی داخلی از AsyncGenerator<string> به AsyncGenerator<StreamPiece> تغییر کند که { type: 'content' | 'reasoning', text: string } باشد؛ یا دو ژنراتور جدا. برای عدم شکستن کالرهای فعلی، سازگاری حفظ شود: کالر قدیمی فقط content را بگیرد.
- ChatService.generate options گسترش:
  - options?: { useWebSearch?: boolean, useThinking?: boolean }
- وقتی useThinking true:
  - yield { thinkingStatus: 'thinking', startedAt }
  - به ازای هر reasoning piece: yield { thinking: piece } + بافر در session.reasoningText (حافظه، برای reconnect)
  - پایان reasoning: yield { thinkingDone: true, durationMs }
  - هنگام save پیام assistant: thinkingText و thinkingDurationMs روی رکورد ست شود (حتی اگر پاسخ ناقص/منقطع شد، هرچه تا آن لحظه آمده ذخیره شود)
- Message entity + migration (همگام با DB_SYNC):
  - ستون thinkingText از نوع text و nullable
  - ستون thinkingDurationMs از نوع int و nullable
  - history باید این دو فیلد را هم برگرداند
- ActiveStreamService:
  - session.reasoningText?: string، session.thinkingStartedAt?: number
  - متدهای appendReasoning, completeThinking
  - reconnect: sync باید reasoningText ناقص را هم بدهد تا کلاینت دیرنده کادر را ببیند
- SSE رویدادهای جدید:
  - event: thinking { content }
  - event: thinking-status { state: 'thinking' | 'done', durationMs? }
- SendMsgDto: useThinking?: boolean optional
- AiModel: آیا پرچم supportsThinking لازم است؟ تصمیم کاربر: غیرفعال با توضیح برای مدل ناسازگار. پس نیاز به دانستن پشتیبانی داریم. راه ساده فاز 2: لیست allowlist در فرانت/بک بر اساس apiIdentifier (مثل deepseek-reasoner, qwq, o1, gpt-5). اگر مدل در لیست نیست، تاگل غیرفعال با توضیح. این لیست در یک ثابت مشترک نگه‌داری شود، نه migration.

### 4.3 فرانت‌اند

- منوی +: آیتم «تفکر عمیق» اضافه شود؛ اگر مدل جاری ناسازگار است disabled + tooltip
- chat store:
  - state: streamingThinking, isThinkingActive, thinkingDurationMs, thinkingStartedAt
  - کال‌بک onThinking, onThinkingStatus
- MessageList streaming-row:
  - کادر «در حال تفکر...» با استریم زنده قبل از پاسخ؛ پس از done جمع خودکار + نمایش «تفکر انجام شد (x ثانیه)»
  - دکمه باز/بسته دستی
- MessageBubble (پیام ذخیره‌شده با thinkingText):
  - کادر «روند تفکر» به‌صورت جمع‌شده + مدت‌زمان؛ کلیک برای بازکردن متن کامل
  - اگر thinkingText خالی است، کادر اصلاً رندر نشود
- MarkdownContent تفکر: متن ساده (نه لینک‌دار) با استایل متمایز

### 4.4 تست فاز 2

- بک: forwarder با payload شامل reasoning_content → reasoning piece جدا از content؛ تست generate با useThinking
- فرانت: تست استریم thinking + جمع‌شدن خودکار + مدت زمان
- دستی: مدل reasoning‌دار و بدون reasoning، reconnect وسط thinking

## 5. ملاحظات مشترک

- Timeoutها: جستجو حداکثر 10s؛ thinkingTimer سرور (35s) نباید با تاخیر جستجو+تفکر خطا بدهد — هنگام search/thinking تایمر ریست شود. watchdog کلاینت با رویدادهای جدید re-arm شود.
- هزینه: toggleها پیش‌فرض خاموش؛ هر درخواست جستجو یک کوئری Serper مصرف می‌کند.
- امنیت: URL منابع اعتبارسنجی http/https؛ snippet کوتاه شود؛ هیچ کلیدی به فرانت نرود.
- قانون طلایی: همه فیلدها optional؛ کلاینت/سرور قدیمی بدون رویدادهای جدید کار می‌کند.
- مستندات: docs/wiki/features.md و architecture.md و api-reference پس از هر فاز.
- Migration: هر تغییر entity + فایل migration دستی همگام با DB_SYNC.

## 6. ترتیب اجرای پیشنهادی (خلاصه برای پلن)

فاز 1 Search:
1. بک: web-search module + service + تست
2. بک: Message.sources + migration + Settings key
3. بک: generate + controller SSE + ActiveStream sources
4. فرانت: types + service SSE + store
5. فرانت: composer toggle + MessageBubble sources
6. تست سبز + wiki

فاز 2 Thinking:
7. بک: forwarder reasoning (دلتای OpenAI-compatible) + generate thinking + SSE
8. بک: ستون‌های thinkingText/thinkingDurationMs روی Message + migration + بازگشت در history
9. فرانت: toggle تفکر + کادر استریم زنده + مدت زمان
10. فرانت: کادر جمع‌شده تفکر در MessageBubble برای پیام‌های ذخیره‌شده
11. تست سبز + wiki
