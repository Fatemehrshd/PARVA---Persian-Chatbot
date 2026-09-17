# Web Search + Thinking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add live web search (Serper, sources + inline citations) and deep-thinking display (real model reasoning only) to chat, in two independently shippable phases: Phase 1 Search, Phase 2 Thinking.

**Architecture:** New self-contained `web-search` NestJS module (controller-less, exported service) consumed by `ChatService.generate` via optional injection; new SSE events (`search-status`, `sources`, `sources-error`, `thinking`, `thinking-status`) written on both SSE paths and replayed through `ActiveStreamService` for reconnects; `Message` gains `sources` (jsonb, Phase 1) and `thinkingText`/`thinkingDurationMs` (Phase 2); frontend extends `readSseStream`, chat store, `ChatComposer` + menu, `MessageBubble`/`SourcesBlock`, and a `citations` util.

**Tech Stack:** NestJS 10 + TypeORM + PostgreSQL (backend); Vue 3 + Vite + Pinia + marked (frontend); Serper.dev REST (POST https://google.serper.dev/search); OpenAI-compatible chat-completions deltas only (`reasoning_content`/`reasoning`).

**Spec:** `docs/superpowers/specs/2026-09-18-web-search-and-thinking-design.md`

## Global Constraints

- Every new DTO/API/SSE field is OPTIONAL — old clients and old servers keep working (golden rule: new features never break previous ones).
- Entity change ⇒ hand-written migration in `backend/src/migrations/` following the `IF NOT EXISTS` pattern (prod runs migrations; dev uses `DB_SYNC=true`).
- Secrets only from env (`SERPER_API_KEY`); never hardcoded, never sent to the frontend.
- Validation error messages in Persian (like existing `FA.*` / inline Persian strings).
- SSE event names are fixed: `search-status`, `sources`, `sources-error`, `thinking`, `thinking-status`.
- Frontend is Persian RTL; streaming must render incrementally (never wait for full response).
- UI styling rule (partner constraint): Tailwind utilities + existing shadcn-vue/reusable components ONLY (`ui/Card`, `ui/Button`, `BaseToggle`, …). Define NO new CSS classes in `<style>` blocks. Reuse existing classes (e.g. `.attachment-menu-item`) where they fit. `data-testid` attributes are not styling and are allowed. Precedent: `MarkdownContent.vue` link renderer already styles anchors with inline Tailwind classes.
- Backend gates per task: `cd backend && npm run lint` (tsc --noEmit) and `npx jest test/<spec>.spec.ts --runInBand`.
- Frontend gates per task: `cd frontend && npx vitest run tests/<spec>.spec.ts` and `npm run build`.
- After each phase: update `docs/wiki/features.md` (+ `architecture.md` / `api-reference.md` since the SSE contract changes) and keep both suites green.

---

## File Structure

```
backend/src/modules/web-search/
  web-search.service.ts      ← Serper client: search(query) → WebSource[]
  web-search.module.ts       ← providers/exports WebSearchService (no controller)
backend/test/
  web-search.spec.ts         ← TDD test for the service (fake fetch)
  chat-search-flow.spec.ts   ← generate() with fake WebSearchService (both outcomes)
  chat-thinking-flow.spec.ts ← generate() thinking flow with fake forwarder (Phase 2)
  forwarder-reasoning.spec.ts← delta.reasoning_content parsing (Phase 2)
backend/src/modules/chat/
  chat.service.ts            ← options param, search + thinking yields, save new columns
  chat.controller.ts         ← write the 5 new SSE events on BOTH send() and streamActive()
  active-stream.service.ts   ← session.sources/reasoningText, setSources/appendReasoning/
                               completeThinking, touchThinkingTimer, replay in attachToActiveStream
  dto.ts                     ← SendMsgDto.useWebSearch / .useThinking (both @IsOptional)
  message.entity.ts          ← sources (jsonb, Ph1) + thinkingText/thinkingDurationMs (Ph2)
  chat.module.ts             ← import WebSearchModule
backend/src/modules/admin/
  settings.service.ts        ← WEB_SEARCH_ENABLED_KEY + getWebSearchEnabled() + getAll/update
  dto.ts                     ← UpdateSettingsDto.webSearchEnabled
backend/src/migrations/
  1761300000000-AddMessageSources.ts   ← Phase 1
  1761300000001-AddMessageThinking.ts  ← Phase 2
backend/.env.example         ← SERPER_API_KEY documented
frontend/src/
  types/index.ts             ← WebSource, Message.sources/searchFailed/thinkingText/
                               thinkingDurationMs, SendMessageRequest flags
  utils/citations.ts         ← linkCitationsInHtml(html, sources)
  services/chat.service.ts   ← parse 5 new SSE events, onActivity already re-arms timer
  stores/chat.ts             ← convFlags per-conversation, stream state fields, new callbacks,
                               sendMessage(content, files?, opts?)
  components/chat/ChatComposer.vue    ← + menu toggle items (web first, thinking in Ph2)
  components/chat/MessageBubble.vue   ← SourcesBlock + stored-thinking box + pass sources
                                        to MarkdownContent
  components/chat/SourcesBlock.vue    ← NEW: collapsible card list under answer (NEW file)
  components/chat/MarkdownContent.vue ← optional sources prop + text-renderer citation links
  components/chat/MessageList.vue     ← live thinking box in streaming-row (Phase 2)
frontend/tests/
  citations.spec.ts          ← util tests
  SourcesBlock.spec.ts       ← component test
  MessageBubble.sources.spec.ts ← render test with sources
  chat-thinking.spec.ts      ← live thinking box behavior (Phase 2)
```

---

### Task 1: WebSearchService + module (TDD)

**Files:**
- Create: `backend/src/modules/web-search/web-search.service.ts`
- Create: `backend/src/modules/web-search/web-search.module.ts`
- Test: `backend/test/web-search.spec.ts` + `backend/test/web-search-module.spec.ts` (Nest DI regression: module must compile and resolve the service)

**Interfaces:**
- Consumes: `process.env.SERPER_API_KEY`, global `fetch`
- Produces: `export interface WebSource { title: string; url: string; snippet?: string }`, `WebSearchService.search(query: string): Promise<WebSource[]>`, `WebSearchModule` (exports `WebSearchService`)

- [ ] **Step 1: Write the failing test**

```ts
// backend/test/web-search.spec.ts
import { WebSearchService } from '../src/modules/web-search/web-search.service';

function fakeFetchImpl(payload: any, ok = true) {
  return async () =>
    ({ ok, status: ok ? 200 : 500, json: async () => payload }) as any;
}

it('maps serper organic results to WebSource and caps at 8', async () => {
  const organic = Array.from({ length: 10 }, (_, i) => ({
    title: `t${i}`, link: `https://e.com/${i}`, snippet: `s${i}`,
  }));
  const svc = new WebSearchService();
  const out = await svc.search('test query', fakeFetchImpl({ organic }) as any);
  expect(out).toHaveLength(8);
  expect(out[0]).toEqual({ title: 't0', url: 'https://e.com/0', snippet: 's0' });
});

it('throws a clear Persian error when SERPER_API_KEY is missing', async () => {
  const old = process.env.SERPER_API_KEY;
  delete process.env.SERPER_API_KEY;
  const svc = new WebSearchService();
  await expect(svc.search('q', fakeFetchImpl({ organic: [] }) as any)).rejects.toThrow('کلید جستجوی وب تنظیم نشده است');
  process.env.SERPER_API_KEY = old;
});

it('throws on non-https URLs being dropped, keeps https only', async () => {
  const svc = new WebSearchService();
  await expect(
    svc.search('q', fakeFetchImpl({ organic: [{ title: 'x', link: 'ftp://e.com/a', snippet: '' }] }) as any),
  ).resolves.toEqual([]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest test/web-search.spec.ts --runInBand`
Expected: FAIL with "Cannot find module '../src/modules/web-search/web-search.service'"

- [ ] **Step 3: Write minimal implementation**

```ts
// backend/src/modules/web-search/web-search.service.ts
import { Injectable, Logger } from '@nestjs/common';

export interface WebSource {
  title: string;
  url: string;
  snippet?: string;
}

const SEARCH_TIMEOUT_MS = 10000;
const MAX_SOURCES = 8;

@Injectable()
export class WebSearchService {
  private readonly logger = new Logger(WebSearchService.name);

  // NOTE: `fetcher` stays OUT of the constructor on purpose — a ctor-injected
  // `fetch` breaks Nest startup ("can't resolve dependencies of the
  // WebSearchService"). It is an explicit per-call ambient capability instead.
  async search(query: string, fetcher: typeof fetch = fetch): Promise<WebSource[]> {
    const apiKey = process.env.SERPER_API_KEY;
    if (!apiKey) throw new Error('کلید جستجوی وب تنظیم نشده است (SERPER_API_KEY)');
    const q = (query || '').trim().slice(0, 300);
    if (!q) return [];
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), SEARCH_TIMEOUT_MS);
    try {
      const res = await fetcher('https://google.serper.dev/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-KEY': apiKey },
        body: JSON.stringify({ q, num: MAX_SOURCES }),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`خطا در سرویس جستجوی وب (${res.status})`);
      const data: any = await res.json();
      const organic: any[] = Array.isArray(data?.organic) ? data.organic : [];
      return organic.slice(0, MAX_SOURCES).flatMap((r) => {
        const url = String(r?.link ?? r?.url ?? '');
        if (!/^https:\/\//i.test(url)) return [];
        return [{ title: String(r?.title ?? url), url, snippet: String(r?.snippet ?? '') }];
      });
    } finally {
      clearTimeout(timer);
    }
  }
}
```

```ts
// backend/src/modules/web-search/web-search.module.ts
import { Module } from '@nestjs/common';
import { WebSearchService } from './web-search.service';

@Module({
  providers: [WebSearchService],
  exports: [WebSearchService],
})
export class WebSearchModule {}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx jest test/web-search.spec.ts --runInBand`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/web-search backend/test/web-search.spec.ts
git commit -m "feat(web-search): add Serper-backed WebSearchService and module"
```

---

### Task 2: Wire module + admin kill-switch setting

**Files:**
- Modify: `backend/src/modules/chat/chat.module.ts` (add `WebSearchModule` to imports)
- Modify: `backend/src/modules/chat/chat.service.ts` (constructor: append `@Optional() private webSearch?: WebSearchService`)
- Modify: `backend/src/modules/admin/settings.service.ts` (key + getter + getAll/update)
- Modify: `backend/src/modules/admin/dto.ts` (`UpdateSettingsDto.webSearchEnabled`)
- Test: extend `backend/test/chat-search-flow.spec.ts` later (this task: no behavior change; verify compile)

**Interfaces:**
- Consumes: `WebSearchModule`, `system_settings` row `web_search_enabled`
- Produces: `SettingsService.getWebSearchEnabled(): Promise<boolean>` (default `true`)

- [ ] **Step 1: Add setting plumbing**

```ts
// settings.service.ts additions
export const WEB_SEARCH_ENABLED_KEY = 'web_search_enabled';

async getWebSearchEnabled(): Promise<boolean> {
  const v = await this.get(WEB_SEARCH_ENABLED_KEY, 'true');
  return v !== 'false';
}
```

In `getAll()` return type add `webSearchEnabled: boolean;`, destructure one more entry:

```ts
webSearchEnabled,
...
webSearchEnabled: (await this.getWebSearchEnabled()),
```

In `update()`:

```ts
if (dto.webSearchEnabled !== undefined) {
  await this.set(WEB_SEARCH_ENABLED_KEY, dto.webSearchEnabled ? 'true' : 'false');
}
```

In `backend/src/modules/admin/dto.ts`:

```ts
@IsOptional()
@IsBoolean({ message: 'وضعیت جستجوی وب باید boolean باشد' })
webSearchEnabled?: boolean;
```

(`IsBoolean` is already imported in that file.)

In `chat.module.ts` imports add `WebSearchModule` (+ import line). In `chat.service.ts` constructor append:

```ts
@Optional() private webSearch?: WebSearchService,
```

with `import { WebSearchService } from '../web-search/web-search.service';`. (`@Optional` and `WebSearchService`-less old constructions like `new ChatService(conv, msg, models, forwarder)` in existing tests keep working.)

- [ ] **Step 2: Verify no behavior change**

Run: `cd backend && npm run lint`
Expected: clean (no errors)

Run: `cd backend && npx jest test/chat-real-stream.spec.ts --runInBand`
Expected: PASS (existing suite untouched)

- [ ] **Step 3: Commit**

```bash
git add backend/src/modules/chat/chat.module.ts backend/src/modules/chat/chat.service.ts backend/src/modules/admin/settings.service.ts backend/src/modules/admin/dto.ts
git commit -m "feat(web-search): wire module and admin kill-switch setting (default on)"
```

---

### Task 3: Message.sources column + migration (Phase 1)

**Files:**
- Modify: `backend/src/modules/chat/message.entity.ts`
- Create: `backend/src/migrations/1761300000000-AddMessageSources.ts`
- Test: manual via lint + existing suite (entity additive/nullable)

**Interfaces:**
- Consumes: nothing new
- Produces: `Message.sources?: { title: string; url: string; snippet?: string }[] | null`

- [ ] **Step 1: Add nullable jsonb column**

```ts
// message.entity.ts — add after isDeleted:
/** Web-search sources attached to this assistant reply (null when unused). */
@Column({ type: 'jsonb', nullable: true, default: null })
sources?: { title: string; url: string; snippet?: string }[] | null;
```

```ts
// backend/src/migrations/1761300000000-AddMessageSources.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

/** Stores web-search sources alongside the assistant message that cited them. */
export class AddMessageSources1761300000000 implements MigrationInterface {
  name = 'AddMessageSources1761300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "messages"
        ADD COLUMN IF NOT EXISTS "sources" jsonb NULL DEFAULT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "messages" DROP COLUMN IF EXISTS "sources"`);
  }
}
```

- [ ] **Step 2: Verify**

Run: `cd backend && npm run lint`
Expected: clean

- [ ] **Step 3: Commit**

```bash
git add backend/src/modules/chat/message.entity.ts backend/src/migrations/1761300000000-AddMessageSources.ts
git commit -m "feat(web-search): persist sources jsonb on Message with migration"
```

---

### Task 4: generate() search flow + ChatChunk + dto (TDD)

**Files:**
- Modify: `backend/src/modules/chat/chat.service.ts` (`ChatChunk`, `generate` signature + search block + save `sources`)
- Modify: `backend/src/modules/chat/dto.ts` (`SendMsgDto.useWebSearch`)
- Test: `backend/test/chat-search-flow.spec.ts`

**Interfaces:**
- Consumes: `WebSearchService.search`, `SettingsService.getWebSearchEnabled`
- Produces: `ChatChunk` gains `{ searchStatus?: 'searching'; sources?: WebSource[]; searchFailed?: boolean }`; `generate(userId, id, content, fileIds?, options?: { useWebSearch?: boolean })`

- [ ] **Step 1: Write the failing test** (follow `test/chat-real-stream.spec.ts` fake-repo style; `svcWith` gains `webSearch` + `settings` fakes passed as 5th/6th ctor args)

```ts
// backend/test/chat-search-flow.spec.ts
import { ChatService } from '../src/modules/chat/chat.service';

function makeRepos() {
  const savedMsgs: any[] = [];
  let seq = 0;
  return {
    // NOTE: ChatService ctor order is (conv, msg, models, forwarder, settings?,
    // users?, activeStream?, fileRepo?, webSearch?) — the webSearch fake MUST be
    // the 9th argument (after an explicit fileRepo undefined), not the 8th.
    conv: { findOne: async () => ({ id: 'c1', userId: 'u1', modelId: 'm1' }), save: async (c: any) => c, create: (o: any) => o, update: async () => {} },
    msg: {
      create: (o: any) => ({ ...o }),
      save: async (o: any) => { const m = { id: `s-${++seq}`, ...o }; savedMsgs.push(m); return m; },
      find: async () => [...savedMsgs],
      findOne: async () => null,
      count: async () => 1,
    },
    savedMsgs,
  };
}

const base = {
  models: { getRawById: async () => null, getDefault: async () => null, resolveProvider: async () => null },
  forwarder: { resolveTarget: () => null },
};

it('emits searching → sources, injects sources into the prompt, saves sources', async () => {
  const { conv, msg, savedMsgs } = makeRepos();
  let seenMessages: any[] = [];
  const svc: any = new ChatService(conv, msg,
    { ...base.models, getDefault: async () => ({ id: 'm1', isActive: true }) },
    { resolveTarget: () => ({ apiIdentifier: 'x', apiKey: 'k', baseUrl: 'http://x' }), stream: async function* (_t: any, m: any[]) { seenMessages = m; yield 'hi'; } },
    { getWebSearchEnabled: async () => true, getGlobalTokenLimit: async () => 0, getSystemPrompt: async () => 'sys' } as any,
    undefined, undefined, undefined,
    { search: async () => [{ title: 't', url: 'https://e.com', snippet: 's' }] } as any,
  );
  const chunks: any[] = [];
  for await (const c of svc.generate('u1', 'c1', 'news?', undefined, { useWebSearch: true })) chunks.push(c);
  expect(chunks[0]).toEqual({ searchStatus: 'searching' });
  expect(chunks.find((c) => c.sources)).toEqual({ sources: [{ title: 't', url: 'https://e.com', snippet: 's' }] });
  const sys = seenMessages.find((m) => m.role === 'system')?.content ?? '';
  expect(sys).toContain('https://e.com');
  expect(savedMsgs.find((m) => m.role === 'assistant')?.sources).toHaveLength(1);
});

it('on search failure continues without sources and notes it in the reply', async () => {
  const { conv, msg, savedMsgs } = makeRepos();
  const svc: any = new ChatService(conv, msg,
    { ...base.models, getDefault: async () => ({ id: 'm1', isActive: true }) },
    { resolveTarget: () => ({ apiIdentifier: 'x', apiKey: 'k', baseUrl: 'http://x' }), stream: async function* () { yield 'hi'; } },
    { getWebSearchEnabled: async () => true, getGlobalTokenLimit: async () => 0, getSystemPrompt: async () => 'sys' } as any,
    undefined, undefined, undefined,
    { search: async () => { throw new Error('boom'); } } as any,
  );
  const chunks: any[] = [];
  for await (const c of svc.generate('u1', 'c1', 'news?', undefined, { useWebSearch: true })) chunks.push(c);
  expect(chunks).toContainEqual({ searchFailed: true });
  const saved = savedMsgs.find((m) => m.role === 'assistant');
  expect(saved?.sources ?? null).toBeNull();
  expect(saved?.content).toContain('جستجوی وب ناموفق بود');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest test/chat-search-flow.spec.ts --runInBand`
Expected: FAIL (generate ignores options; no searchStatus chunk)

- [ ] **Step 3: Implement search block in generate()**

In `ChatChunk` add:

```ts
searchStatus?: 'searching';
sources?: { title: string; url: string; snippet?: string }[];
searchFailed?: boolean;
```

Signature: `async *generate(userId: string, id: string, content: string, fileIds?: string[], options?: { useWebSearch?: boolean })`.

Insert AFTER `const session = this.activeStream?.startSession(...)` (line ~288) and BEFORE user-message dedup save:

```ts
let webSources: { title: string; url: string; snippet?: string }[] | null = null;
let webSearchFailed = false;
const wantSearch = options?.useWebSearch === true;
if (wantSearch) {
  const enabled = this.settings && typeof (this.settings as any).getWebSearchEnabled === 'function'
    ? await (this.settings as any).getWebSearchEnabled()
    : true;
  if (enabled && this.webSearch) {
    yield { searchStatus: 'searching' };
    // resetThinkingTimer/setSources land in Task 5 — the `as any` keeps
    // Task 4 compiling until then (optional chaining keeps fakes safe).
    (this.activeStream as any)?.resetThinkingTimer?.(id);
    try {
      webSources = await this.webSearch.search(rawContent || 'تحلیل فایل پیوست');
      (this.activeStream as any)?.setSources?.(id, webSources);
      yield { sources: webSources };
    } catch (err) {
      webSearchFailed = true;
      this.logger.warn(`Web search failed, continuing without sources: ${err instanceof Error ? err.message : String(err)}`);
      yield { searchFailed: true };
    }
  }
}
```

(`rawContent` is defined at line ~287 before session start — place the block after `rawContent` is computed; keep `rawContent` usage, fall back to the file-analysis prompt when empty.)

When building `messages` (after `activeSystemPrompt`, line ~398), append when sources exist:

```ts
const systemContent = webSources && webSources.length > 0
  ? `${activeSystemPrompt}\n\n[منابع وب (در پاسخ با ‎[n]‎ به شماره منبع ارجاع بده)]:\n${webSources.map((s, i) => `[${i + 1}] ${s.title} — ${s.url}\n${s.snippet ?? ''}`).join('\n')}`
  : activeSystemPrompt;
const messages: ChatMessage[] = [{ role: 'system', content: systemContent }, ...];
```

At assistant save (line ~458 `this.msg.create({ conversationId: id, role: 'assistant', ... })`), add:

```ts
sources: webSources,
...(webSearchFailed ? { content: `${full}\n\n(جستجوی وب ناموفق بود؛ این پاسخ بدون استفاده از منابع وب تولید می‌شود.)` } : {}),
```

Note: `full` is built from streamed tokens; the failure note is appended to the SAVED content. Also append the same note to the streamed text? The live client already got `sources-error`; the note in DB keeps history honest. To keep live and saved identical, yield the note as a final token when failed:

```ts
if (webSearchFailed) {
  const note = '\n\n(جستجوی وب ناموفق بود؛ این پاسخ بدون استفاده از منابع وب تولید می‌شود.)';
  full += note;
  this.activeStream?.appendToken(id, note);
  yield { token: note };
}
```

(place before `savedAssistant` creation, inside the same `finally` where `full` is final — restructure minimally: put it right before the `if (full && !savedAssistant)` block and drop the content-override spread above; then `sources: webSources` (null when failed) suffices.)

In `dto.ts`:

```ts
import { IsString, IsOptional, MinLength, IsUUID, IsArray, ValidateIf, IsBoolean } from 'class-validator';
...
export class SendMsgDto {
  ...
  @IsOptional()
  @IsBoolean({ message: 'گزینه جستجوی وب باید boolean باشد' })
  useWebSearch?: boolean;
}
```

In `chat.controller.ts send()`: `const gen = this.chat.generate(req.user.sub, id, d.content, d.fileIds, { useWebSearch: d.useWebSearch === true });`

- [ ] **Step 4: Run tests**

Run: `cd backend && npx jest test/chat-search-flow.spec.ts test/chat-real-stream.spec.ts --runInBand`
Expected: PASS

Run: `cd backend && npm run lint`
Expected: clean

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/chat/chat.service.ts backend/src/modules/chat/dto.ts backend/src/modules/chat/chat.controller.ts backend/test/chat-search-flow.spec.ts
git commit -m "feat(web-search): search flow in generate with sources persistence"
```

---

### Task 5: SSE writing + ActiveStream replay for sources

**Files:**
- Modify: `backend/src/modules/chat/active-stream.service.ts` (types, session fields, `setSources`, `resetThinkingTimer`, status, replay)
- Modify: `backend/src/modules/chat/chat.service.ts` (`attachToActiveStream` subscribe + initial sync)
- Modify: `backend/src/modules/chat/chat.controller.ts` (both `send()` loop and `streamActive()` loop)

**Interfaces:**
- Consumes: Task 4 chunks
- Produces: SSE `search-status` / `sources` / `sources-error`; `ActiveStreamStatus` gains `sources?`; late subscribers receive `{ sources }` replay

- [ ] **Step 1: ActiveStream changes**

```ts
// StreamEvent union — append:
| { type: 'sources'; sources: { title: string; url: string; snippet?: string }[] };

// ActiveStreamSession — add:
sources?: { title: string; url: string; snippet?: string }[];

// ActiveStreamStatus — add:
sources?: { title: string; url: string; snippet?: string }[];
```

Add methods (next to setTitle):

```ts
setSources(conversationId: string, sources: { title: string; url: string; snippet?: string }[]): void {
  const session = this.sessions.get(conversationId);
  if (!session) return;
  session.sources = sources;
  this.resetThinkingTimer(conversationId);
  const event: StreamEvent = { type: 'sources', sources };
  for (const sub of session.subscribers) {
    try { sub(event); } catch (err) { this.logger.warn(`Subscriber error on sources emit: ${err}`); }
  }
}

/** Re-arms the 35s thinking watchdog (long search/reasoning must not trip it). */
resetThinkingTimer(conversationId: string): void {
  const session = this.sessions.get(conversationId);
  if (!session || (session.status !== 'thinking' && session.status !== 'streaming')) return;
  if (session.thinkingTimer) clearTimeout(session.thinkingTimer);
  session.thinkingTimer = setTimeout(() => {
    if (session.status === 'thinking' && !session.accumulatedText) {
      this.logger.warn(`Session ${conversationId} timed out in thinking state`);
      this.failSession(conversationId, 'زمان انتظار برای پردازش پیام به پایان رسید (Timeout)');
    }
  }, 35000);
  if (session.thinkingTimer && typeof session.thinkingTimer.unref === 'function') {
    session.thinkingTimer.unref();
  }
}
```

In `getActiveStatus` return add `sources: session.sources`.

In `chat.service.ts attachToActiveStream`: after the `accumulatedText` sync yield, add:

```ts
if (session.sources) {
  yield { sources: session.sources };
}
```

and in the subscriber callback add:

```ts
} else if (event.type === 'sources') {
  queue.push({ sources: event.sources });
}
```

(Note: `generate()` calls `this.activeStream?.setSources?.(id, ...)` and `?.resetThinkingTimer?.(id)` with optional chaining so unit fakes without these methods keep working.)

- [ ] **Step 2: Controller SSE writers** — in BOTH `send()` (after the `chunk.sync` branch) and `streamActive()` add:

```ts
if (chunk.searchStatus && !clientDisconnected && !res.writableEnded) {
  try {
    res.write(`event: search-status\ndata: ${JSON.stringify({ state: chunk.searchStatus })}\n\n`);
  } catch { clientDisconnected = true; }
}
if (chunk.sources && !clientDisconnected && !res.writableEnded) {
  try {
    res.write(`event: sources\ndata: ${JSON.stringify({ sources: chunk.sources })}\n\n`);
  } catch { clientDisconnected = true; }
}
if (chunk.searchFailed && !clientDisconnected && !res.writableEnded) {
  try {
    res.write(`event: sources-error\ndata: ${JSON.stringify({ message: 'جستجوی وب ناموفق بود؛ پاسخ بدون منابع ادامه می‌یابد' })}\n\n`);
  } catch { clientDisconnected = true; }
}
```

- [ ] **Step 3: Verify**

Run: `cd backend && npm run lint && npx jest test --runInBand`
Expected: lint clean, full backend suite green

- [ ] **Step 4: Commit**

```bash
git add backend/src/modules/chat/active-stream.service.ts backend/src/modules/chat/chat.service.ts backend/src/modules/chat/chat.controller.ts
git commit -m "feat(web-search): SSE sources events and active-stream replay"
```

---

### Task 6: Frontend contract — types, SSE parsing, store

**Files:**
- Modify: `frontend/src/types/index.ts`
- Modify: `frontend/src/services/chat.service.ts` (`readSseStream` + `sendMessageStream` signature/callbacks)
- Modify: `frontend/src/stores/chat.ts` (convFlags, stream state fields, callbacks, `sendMessage` opts)
- Test: `frontend/tests/chat-service-sse.spec.ts` (NEW — unit-test the SSE parser via a fake Response)

**Interfaces:**
- Consumes: new SSE events
- Produces: `WebSource`; `Message.sources?/searchFailed?`; store `convFlags: Record<string, { web: boolean }>` + `setConvFlag(convId, 'web', v)`; stream state `{ streamingSources, isSearching, searchFailed }`; `sendMessage(content, files?, opts?: { useWebSearch?: boolean })`

- [ ] **Step 1: Types**

```ts
// types/index.ts — append to Chat Schemas
export interface WebSource {
  title: string
  url: string
  snippet?: string
}
// Message — add:
sources?: WebSource[] | null
searchFailed?: boolean
// SendMessageRequest — add:
useWebSearch?: boolean
```

- [ ] **Step 2: Failing parser test**

```ts
// frontend/tests/chat-service-sse.spec.ts
import { describe, it, expect } from 'vitest'
import { parseSseEventsForTest } from '../src/services/chat.service'
```

Problem: `readSseStream` is module-private. To keep it testable without refactor risk, export a thin pure helper from `chat.service.ts`:

```ts
export function dispatchSseEvent(currentEvent: string, data: any, cb: {
  onToken?: (t: string) => void; onSync?: (c: string) => void; onTitle?: (t: string) => void;
  onDone?: (m: string) => void; onError?: (e: any) => void;
  onSearchStatus?: (s: string) => void; onSources?: (s: any[]) => void; onSourcesError?: (m: string) => void;
}) {
  if (currentEvent === 'token' && data.content !== undefined) cb.onToken?.(data.content)
  else if (currentEvent === 'sync' && data.content !== undefined) cb.onSync?.(data.content)
  else if (currentEvent === 'title' && data.title) cb.onTitle?.(data.title)
  else if (currentEvent === 'done' && data.messageId) cb.onDone?.(data.messageId)
  else if (currentEvent === 'search-status' && data.state) cb.onSearchStatus?.(data.state)
  else if (currentEvent === 'sources' && Array.isArray(data.sources)) cb.onSources?.(data.sources)
  else if (currentEvent === 'sources-error') cb.onSourcesError?.(data.message || 'خطا در جستجو')
  else if (currentEvent === 'error') cb.onError?.(new Error(data.error || data.message || 'خطا در برقراری ارتباط'))
}
```

and `readSseStream` calls it for every parsed `data:` line (replacing its inline if-chain; keep the non-JSON fallback for token/error as-is). Test:

```ts
it('dispatches sources events', () => {
  const seen: any = {}
  dispatchSseEvent('sources', { sources: [{ title: 't', url: 'https://e.com' }] }, { onSources: (s) => (seen.s = s) })
  expect(seen.s).toHaveLength(1)
  dispatchSseEvent('search-status', { state: 'searching' }, { onSearchStatus: (s) => (seen.st = s) })
  expect(seen.st).toBe('searching')
  dispatchSseEvent('sources-error', { message: 'm' }, { onSourcesError: (m) => (seen.e = m) })
  expect(seen.e).toBe('m')
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd frontend && npx vitest run tests/chat-service-sse.spec.ts`
Expected: FAIL (no such export)

- [ ] **Step 4: Implement** — add `dispatchSseEvent`, rewire `readSseStream` to use it, extend `sendMessageStream` signature with `onSearchStatus?, onSources?, onSourcesError?` callbacks and pass them through (both direct stream and `subscribeActiveStream` reconnect path). Extend POST payload: `if (opts?.useWebSearch) payload.useWebSearch = true` (add `opts?` param at end).

Store (`stores/chat.ts` — exact anchors: `ConvStreamState` lines 11-21, `makeDefaultState` 27-39, `finishStream` 1019-1051, `sendMessage` 713+):
- Line 3 import: add `WebSource` to the type import from `'../types'`.
- `ConvStreamState` interface: append `streamingSources: WebSource[] | null`, `isSearching: boolean`, `searchFailed: boolean`. `makeDefaultState()`: append `streamingSources: null, isSearching: false, searchFailed: false`.
- Flags block (place next to the stream-state map):

```ts
const convFlags = ref<Record<string, { web: boolean }>>({})
function persistConvFlags() {
  try { localStorage.setItem('chat_conv_flags', JSON.stringify(convFlags.value)) } catch {}
}
function getConvFlag(convId: string) {
  return convFlags.value[convId] ?? { web: false }
}
function setConvFlag(convId: string, patch: Partial<{ web: boolean }>) {
  convFlags.value[convId] = { ...getConvFlag(convId), ...patch }
  persistConvFlags()
}
try {
  const raw = localStorage.getItem('chat_conv_flags')
  if (raw) convFlags.value = JSON.parse(raw)
} catch {}
```

return/getters: expose `convFlags, getConvFlag, setConvFlag` from the store (ChatComposer uses them).
- `executeMessageStream(convId, content, userMessage, fileIds?, opts?: { useWebSearch?: boolean })`: pass `opts?.useWebSearch` into the service payload (service change in this task) and wire the three new service callbacks (`onSearchStatus/onSources/onSourcesError`) to set `isSearching/streamingSources/searchFailed` + `resetWatchdog(convId, 25000)` each (same call the token handler at line ~570 makes).
- `finishStream` push (lines 1037-1044): extend the pushed object with `sources: s.streamingSources, searchFailed: s.searchFailed || undefined`; after the push add `s.streamingSources = null; s.isSearching = false; s.searchFailed = false` before the state reset at line 1047.
- `sendMessage(content, files?, opts?: { useWebSearch?: boolean })`: after `let convId = currentConversationId.value!` (line 730) resolve `const useWebSearch = opts?.useWebSearch ?? getConvFlag(convId).web`; after the temp→real migration block (line 797, `convId = created.id`) migrate a pre-send flag: `if (convFlags.value['__new__']) { convFlags.value[convId] = { ...getConvFlag(convId), ...convFlags.value['__new__'] }; delete convFlags.value['__new__']; persistConvFlags() }`. At the existing `executeMessageStream(convId, content, userMessage, fileIds)` call, append `{ useWebSearch }` (re-resolve after migration: `getConvFlag(convId).web || useWebSearch`). Retry path (`retryLastMessage` → `sendMessage(prompt, files)` with no opts) therefore inherits the stored per-conversation flag.

- [ ] **Step 5: Verify**

Run: `cd frontend && npx vitest run tests/chat-service-sse.spec.ts`
Expected: PASS

Run: `cd frontend && npx vue-tsc -b`
Expected: clean (this is the `npm run build` type gate minus bundling)

- [ ] **Step 6: Commit**

```bash
git add frontend/src/types/index.ts frontend/src/services/chat.service.ts frontend/src/stores/chat.ts frontend/tests/chat-service-sse.spec.ts
git commit -m "feat(web-search): frontend SSE contract, store flags and stream state"
```

---

### Task 7: ChatComposer + menu toggle (web)

**Files:**
- Modify: `frontend/src/components/chat/ChatComposer.vue`
- Test: manual + existing frontend suite (add `frontend/tests/ChatComposer.flags.spec.ts` asserting toggle flips store flag)

**Interfaces:**
- Consumes: store `getConvFlag/setConvFlag`
- Produces: + menu item «🌐 جستجوی وب» with active state; `sendMessage(text, files, { useWebSearch })`

- [ ] **Step 1: Failing component test**

```ts
// frontend/tests/ChatComposer.flags.spec.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ChatComposer from '../src/components/chat/ChatComposer.vue'
import { useChatStore } from '../src/stores/chat'

describe('ChatComposer web-search toggle', () => {
  beforeEach(() => { setActivePinia(createPinia()); localStorage.clear() })
  it('flips the per-conversation web flag', async () => {
    const wrapper = mount(ChatComposer, { global: { stubs: { teleport: true } } })
    const chatStore = useChatStore()
    chatStore.currentConversationId = 'c1'
    const btn = wrapper.find('[data-testid="toggle-web-search"]')
    expect(btn.exists()).toBe(true)
    expect(chatStore.getConvFlag('c1').web).toBe(false)
    await btn.trigger('click')
    expect(chatStore.getConvFlag('c1').web).toBe(true)
  })
})
```

(Mount may need more stubs — modelsStore/uiStore are used by the composer; if mount fails on missing setup, stub `useModelsStore`/`useUiStore` via `vi.mock` in the spec. The executor adapts stubs until the single assertion runs; the assertion itself is fixed.)

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && npx vitest run tests/ChatComposer.flags.spec.ts`
Expected: FAIL (no `[data-testid="toggle-web-search"]`)

- [ ] **Step 3: Implement** — inside `.attachment-dropdown` (after the documents button, `ChatComposer.vue:456`), add:

```vue
<button
  type="button"
  class="attachment-menu-item"
  data-testid="toggle-web-search"
  :class="chatStore.getConvFlag(activeConvId).web ? 'bg-primary/10 text-primary' : ''"
  @click="toggleWebSearch"
>
  <svg width="16" ...><!-- globe icon --></svg>
  <span>جستجوی وب</span>
  <BaseToggle
    size="sm"
    :modelValue="chatStore.getConvFlag(activeConvId).web"
    @click.stop
    @update:modelValue="toggleWebSearch"
  />
</button>
```

(Styling rule: existing `.attachment-menu-item` class + Tailwind active utilities + reusable `BaseToggle` (`ui/BaseToggle.vue`: `modelValue`, `size="sm"`, `update:modelValue`). No new CSS. Import `BaseToggle` in the composer script.)

Script:

```ts
const activeConvId = computed(() => chatStore.currentConversationId ?? '__new__')
function toggleWebSearch() {
  const cur = chatStore.getConvFlag(activeConvId.value).web
  chatStore.setConvFlag(activeConvId.value, { web: !cur })
  attachmentMenuOpen.value = false
}
```

And change `chatStore.sendMessage(text, files)` (line 248) to:

```ts
chatStore.sendMessage(text, files, { useWebSearch: chatStore.getConvFlag(activeConvId.value).web })
```

Reuse `.attachment-menu-item` styles + add `.is-active` highlight in the existing `<style>` block. New conversation (`__new__` key): after the backend creates the real id, migrate the flag — in `sendMessage` flow the store knows the mapping (tempId → created.id at line ~784); move `convFlags[tempId]` to `convFlags[created.id]` there and persist.

- [ ] **Step 4: Verify**

Run: `cd frontend && npx vitest run tests/ChatComposer.flags.spec.ts tests/chat-service-sse.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/chat/ChatComposer.vue frontend/src/stores/chat.ts frontend/tests/ChatComposer.flags.spec.ts
git commit -m "feat(web-search): composer toggle in + menu with per-conversation memory"
```

---

### Task 8: Sources UI — citations util, SourcesBlock, MessageBubble (TDD)

**Files:**
- Create: `frontend/src/utils/citations.ts`
- Create: `frontend/src/components/chat/SourcesBlock.vue`
- Create: `frontend/tests/citations.spec.ts`, `frontend/tests/SourcesBlock.spec.ts`
- Modify: `frontend/src/components/chat/MarkdownContent.vue` (optional `sources` prop + `text` renderer)
- Modify: `frontend/src/components/chat/MessageBubble.vue` (render SourcesBlock + failure note + pass sources)

**Interfaces:**
- Consumes: `WebSource[]`
- Produces: `linkCitationsInHtml(html, sources): string`; `<SourcesBlock :sources :failed />`

- [ ] **Step 1: Write failing util tests**

```ts
// frontend/tests/citations.spec.ts
import { describe, it, expect } from 'vitest'
import { linkCitationsInHtml } from '../src/utils/citations'

const srcs = [{ title: 't1', url: 'https://a.com/1' }, { title: 't2', url: 'https://b.com/2' }]

describe('linkCitationsInHtml', () => {
  it('links [1] and [2] to the right urls', () => {
    const out = linkCitationsInHtml('<p>see [1] and [2]</p>', srcs)
    expect(out).toContain('href="https://a.com/1"')
    expect(out).toContain('href="https://b.com/2"')
    expect(out).toContain('target="_blank"')
  })
  it('leaves out-of-range markers untouched', () => {
    expect(linkCitationsInHtml('<p>x [9]</p>', srcs)).toContain('[9]')
  })
  it('escapes quotes in urls', () => {
    const out = linkCitationsInHtml('<p>[1]</p>', [{ title: 't', url: 'https://a.com/"q' }])
    expect(out).not.toContain('href="https://a.com/"q"')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && npx vitest run tests/citations.spec.ts`
Expected: FAIL (no such module)

- [ ] **Step 3: Implement util + components**

```ts
// frontend/src/utils/citations.ts
import type { WebSource } from '../types'

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}

export function linkCitationsInHtml(html: string, sources: WebSource[] | null | undefined): string {
  if (!html || !sources || sources.length === 0) return html
  return html.replace(/\[(\d+)\]/g, (m, n) => {
    const idx = Number(n) - 1
    if (idx < 0 || idx >= sources.length) return m
    const url = escapeAttr(sources[idx].url)
    return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="citation-link">[${n}]</a>`
  })
}
```

`SourcesBlock.vue`: props `{ sources: WebSource[] | null, failed?: boolean }`; NO `<style>` block — Tailwind utilities with theme tokens only (`border-border/50`, `bg-muted/30`, `text-muted-foreground`, …). Structure: container `div.rounded-xl.border.border-border/50.bg-muted/30.p-3`; header row with shadcn `Button` (`ui/button/Button.vue`: `variant="ghost" size="sm"`) toggling internal `open` ref (default `true`) labeled «منابع (n)»; rows (v-show first 3 + rest behind «نمایش همه» ghost button): index badge `span` with `bg-primary/10 text-primary rounded-md px-1.5 py-0.5 text-[11px] font-semibold`, title `<a target="_blank" rel="noopener noreferrer" class="text-primary font-medium hover:underline">` (same classes as the existing `MarkdownContent` link renderer), snippet `p.text-xs.text-muted-foreground`; when `failed`: warning line `text-xs text-amber-600 dark:text-amber-400` «جستجوی وب ناموفق بود؛ این پاسخ بدون منابع تولید شده است». RTL-friendly. Citation anchors from `linkCitationsInHtml` use the same `text-primary font-medium hover:underline` classes (no `.citation-link` class).

`MarkdownContent.vue`: add `sources?: WebSource[] | null` prop; in the `markedInstance.use({ renderer })` add:

```ts
text({ text }: { text: string }) {
  return linkCitationsInHtml(escapeHtml(text), (this as any).__sources ?? null)
},
```

Problem: renderer needs access to prop. Simplest reliable wiring: create the computed HTML as today (`renderedHtml`), then post-process: `const finalHtml = computed(() => linkCitationsInHtml(renderedHtml.value, props.sources ?? null))` and bind `v-html="finalHtml"`. (Find the existing computed/v-html binding in MarkdownContent.vue lines 121-377 and wrap it — no renderer change needed.) This avoids marked-internals risk entirely.

`MessageBubble.vue`: after the assistant bubble content (`<MarkdownContent :content="message.content" />`), add:

```vue
<SourcesBlock
  v-if="!isUser && (message.sources?.length || message.searchFailed)"
  :sources="message.sources ?? null"
  :failed="!!message.searchFailed"
/>
```

and pass `:sources="message.sources ?? null"` into `MarkdownContent`. Streaming row in `MessageList.vue`: show `<SourcesBlock :sources="chatStore streaming sources" />` above the streaming text when present (read the streaming-row block lines 239-263 and insert; state field from Task 6).

- [ ] **Step 4: Verify**

Run: `cd frontend && npx vitest run tests/citations.spec.ts tests/SourcesBlock.spec.ts tests/MessageList.spec.ts`
Expected: PASS (`SourcesBlock.spec.ts`: mount with 2 sources → 2 links; with `failed` → warning line; empty → renders nothing.)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/utils/citations.ts frontend/src/components/chat/SourcesBlock.vue frontend/src/components/chat/MarkdownContent.vue frontend/src/components/chat/MessageBubble.vue frontend/src/components/chat/MessageList.vue frontend/tests/citations.spec.ts frontend/tests/SourcesBlock.spec.ts
git commit -m "feat(web-search): sources cards and inline citations UI"
```

---

### Task 9: Phase 1 close-out — env, history check, wiki, green suites

**Files:**
- Modify: `backend/.env.example`, `docs/wiki/features.md`, `docs/wiki/architecture.md`, `docs/wiki/api-reference.md`

- [ ] **Step 1: .env.example** — append:

```
# --- Live web search (Serper.dev) ---
# Required for the 🌐 web-search toggle; without it, search requests fail
# gracefully and answers continue without sources.
SERPER_API_KEY=
```

- [ ] **Step 2: Verify history returns sources (no code change expected)** — `history()` (`chat.service.ts:127-135`) uses entity-wide `msg.find`, and `ResponseEnvelopeInterceptor` (`shared/response-envelope.interceptor.ts:59-64`) wraps `data` without stripping fields, so `sources` rides along automatically. Verify by running the backend suite (Task 5 gate) + manual GET `/api/v1/chat/conversations/:id/messages` on a searched conversation; only if a field is missing, add it explicitly and note why.

- [ ] **Step 3: Wiki** — `features.md`: Phase 1 web-search (toggle location, admin `PUT /admin/settings { webSearchEnabled }`, failure behavior). `architecture.md` + `api-reference.md`: document SSE events `search-status/sources/sources-error`, `SendMsgDto.useWebSearch`, `Message.sources`.

- [ ] **Step 4: Full gates**

Run: `cd backend && npm run lint && npx jest test --runInBand`
Expected: clean + green

Run: `cd frontend && npx vitest run && npm run build`
Expected: green + build passes

Manual: toggle on → sources cards + clickable [n]; toggle off → old behavior; admin sets `webSearchEnabled:false` → search skipped; kill Serper key → failure note, no crash; refresh mid-stream → sources replay via sync.

- [ ] **Step 5: Commit**

```bash
git add backend/.env.example docs/wiki/features.md docs/wiki/architecture.md docs/wiki/api-reference.md
git commit -m "docs(web-search): phase 1 env, wiki and contract docs"
```

Phase 1 is shippable here. Stop and demo before Phase 2.

---

### Task 10: Forwarder reasoning parsing — OpenAI-compatible deltas only (TDD, Phase 2)

**Files:**
- Modify: `backend/src/modules/ai/openai-compat.forwarder.ts` (`stream` yields `string | ReasoningPiece`)
- Test: `backend/test/forwarder-reasoning.spec.ts`

**Interfaces:**
- Consumes: upstream SSE `choices[0].delta.{content, reasoning_content, reasoning}`
- Produces: `export interface ReasoningPiece { reasoning: string }`; `stream()` yields content strings (unchanged) plus `{ reasoning }` objects. Old string-only mocks keep working because `generate` type-narrows.

- [ ] **Step 1: Write the failing test**

```ts
// backend/test/forwarder-reasoning.spec.ts
import { OpenAiCompatForwarder } from '../src/modules/ai/openai-compat.forwarder';

function sseBody(lines: string[]) {
  const enc = new TextEncoder();
  return {
    getReader: () => {
      let i = 0;
      return {
        read: async () =>
          i < lines.length
            ? { done: false, value: enc.encode(lines[i++]) }
            : { done: true, value: undefined },
        cancel: async () => {},
      };
    },
  };
}

it('yields reasoning pieces separately from content', async () => {
  const fwd = new OpenAiCompatForwarder();
  const target: any = { apiIdentifier: 'deepseek-reasoner', apiKey: 'k', baseUrl: 'http://x' };
  const think = `data: ${JSON.stringify({ choices: [{ delta: { reasoning_content: 'let me think' } }] })}\n`;
  const tok = `data: ${JSON.stringify({ choices: [{ delta: { content: 'answer' } }] })}\n`;
  const done = `data: [DONE]\n`;
  (global as any).fetch = async () => ({ ok: true, body: sseBody([think, tok, done]) });
  const out: any[] = [];
  for await (const p of (fwd as any).stream(target, [{ role: 'user', content: 'hi' }])) out.push(p);
  expect(out).toContainEqual({ reasoning: 'let me think' });
  expect(out).toContain('answer');
  delete (global as any).fetch;
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && npx jest test/forwarder-reasoning.spec.ts --runInBand`
Expected: FAIL (reasoning delta dropped; `{ reasoning }` never yielded)

- [ ] **Step 3: Implement** — in `stream()`, where `delta` is parsed, also read:

```ts
const raw = (() => { try { return JSON.parse(payload)?.choices?.[0]?.delta; } catch { return null; } })();
const content = typeof raw?.content === 'string' ? raw.content : null;
const reasoning = typeof raw?.reasoning_content === 'string' ? raw.reasoning_content
  : typeof raw?.reasoning === 'string' ? raw.reasoning : null;
if (typeof reasoning === 'string' && reasoning) yield { reasoning };
if (typeof content === 'string' && content) { emitted = true; yield content; }
```

(keep the existing `delta` extraction shape; add the reasoning branch beside it. Update the method return type to `AsyncGenerator<string | ReasoningPiece>` and export the interface.)

Also in `chat.service.ts resume()` (line ~586 `for await (const token of this.forwarder.stream(target, messages))`): type-narrow before the word-split so reasoning objects can never crash the old path:

```ts
for await (const piece of this.forwarder.stream(target, messages)) {
  if (typeof piece !== 'string') continue; // reasoning deltas are ignored on resume
  const token = piece;
  ... // existing split/pace loop unchanged
}

- [ ] **Step 4: Verify**

Run: `cd backend && npx jest test --runInBand && npm run lint`
Expected: full suite PASS + clean (old string mocks and `resume()` unaffected by the union type)

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/ai/openai-compat.forwarder.ts backend/test/forwarder-reasoning.spec.ts
git commit -m "feat(thinking): parse OpenAI-compatible reasoning deltas in forwarder"
```

---

### Task 11: generate() thinking flow + SSE + ActiveStream (TDD, Phase 2)

**Files:**
- Modify: `backend/src/modules/chat/chat.service.ts`, `chat.controller.ts`, `active-stream.service.ts`, `dto.ts`
- Modify: `backend/src/modules/chat/thinking-models.ts` (NEW — allowlist)
- Test: `backend/test/chat-thinking-flow.spec.ts`

**Interfaces:**
- Consumes: `ReasoningPiece` from Task 10
- Produces: chunks `{ thinking?, thinkingStatus?: 'thinking'|'done', thinkingDurationMs?, thinkingSync? }`; SSE `thinking` / `thinking-status`; `THINKING_COMPATIBLE_PATTERNS`

- [ ] **Step 1: Write the failing test** (same `makeRepos` style as Task 4, including `update: async () => {}` on the conv fake and the 9-arg ctor order)

```ts
// backend/test/chat-thinking-flow.spec.ts
import { ChatService } from '../src/modules/chat/chat.service';

function makeRepos() {
  const savedMsgs: any[] = [];
  let seq = 0;
  return {
    conv: { findOne: async () => ({ id: 'c1', userId: 'u1', modelId: 'm1' }), save: async (c: any) => c, create: (o: any) => o, update: async () => {} },
    msg: {
      create: (o: any) => ({ ...o }),
      save: async (o: any) => { const m = { id: `s-${++seq}`, ...o }; savedMsgs.push(m); return m; },
      find: async () => [...savedMsgs],
      findOne: async () => null,
      count: async () => 1,
    },
    savedMsgs,
  };
}

function svcWithThinking(streamImpl: (t: any, m: any[]) => AsyncGenerator<any>) {
  const { conv, msg, savedMsgs } = makeRepos();
  const svc: any = new ChatService(conv, msg,
    { getRawById: async () => null, getDefault: async () => ({ id: 'm1', isActive: true, apiIdentifier: 'deepseek-reasoner' }), resolveProvider: async () => null },
    { resolveTarget: () => ({ apiIdentifier: 'deepseek-reasoner', apiKey: 'k', baseUrl: 'http://x' }), stream: streamImpl },
    { getWebSearchEnabled: async () => true, getGlobalTokenLimit: async () => 0, getSystemPrompt: async () => 'sys' } as any,
  );
  return { svc, savedMsgs };
}

it('streams thinking separately and saves thinkingText + duration', async () => {
  const { svc, savedMsgs } = svcWithThinking(async function* () {
    yield { reasoning: 'r1' };
    yield 'hi';
  });
  const chunks: any[] = [];
  for await (const c of svc.generate('u1', 'c1', 'solve?', undefined, { useThinking: true })) chunks.push(c);
  expect(chunks[0]).toEqual({ thinkingStatus: 'thinking' });
  expect(chunks).toContainEqual({ thinking: 'r1' });
  const done = chunks.find((c) => c.thinkingStatus === 'done');
  expect(typeof done?.thinkingDurationMs).toBe('number');
  const saved = savedMsgs.find((m) => m.role === 'assistant');
  expect(saved?.thinkingText).toBe('r1');
  expect(typeof saved?.thinkingDurationMs).toBe('number');
});

it('emits no thinking chunks and saves nulls when toggle off', async () => {
  const { svc, savedMsgs } = svcWithThinking(async function* () {
    yield { reasoning: 'r1' };
    yield 'hi';
  });
  const chunks: any[] = [];
  for await (const c of svc.generate('u1', 'c1', 'solve?')) chunks.push(c);
  expect(chunks.some((c) => c.thinking !== undefined || c.thinkingStatus !== undefined)).toBe(false);
  expect(savedMsgs.find((m) => m.role === 'assistant')?.thinkingText ?? null).toBeNull();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && npx jest test/chat-thinking-flow.spec.ts --runInBand`
Expected: FAIL

- [ ] **Step 3: Implement**

`thinking-models.ts`:

```ts
/** apiIdentifier fragments of OpenAI-compatible models known to emit reasoning deltas. */
export const THINKING_COMPATIBLE_PATTERNS = [
  'reasoner', 'reasoning', 'r1', 'qwq', 'o1', 'o3', 'gpt-5',
];

export function modelSupportsThinking(apiIdentifier?: string | null): boolean {
  if (!apiIdentifier) return false;
  const id = apiIdentifier.toLowerCase();
  return THINKING_COMPATIBLE_PATTERNS.some((p) => id.includes(p));
}
```

`ChatChunk`: append `thinking?: string; thinkingStatus?: 'thinking' | 'done'; thinkingDurationMs?: number; thinkingSync?: string;`

`generate()` signature: `options?: { useWebSearch?: boolean; useThinking?: boolean }`.

Main provider loop (line ~428) becomes type-narrowed:

```ts
for await (const piece of this.forwarder.stream(target, messages, {
  signal: session?.abortController.signal,
})) {
  if (session?.abortController.signal.aborted) break;
  if (typeof piece !== 'string') {
    // Reasoning delta (Task 10 union type)
    if (wantThinking && piece && typeof (piece as any).reasoning === 'string') {
      const r = (piece as any).reasoning as string;
      if (r) {
        thinkingText += r;
        (this.activeStream as any)?.appendReasoning?.(id, r);
        yield { thinking: r };
      }
    }
    continue;
  }
  const token: string = piece;
  ... // existing split/pace/appendToken/yield block unchanged
}
```

with, before the loop:

```ts
const wantThinking = options?.useThinking === true;
let thinkingText = '';
let thinkingStartedAt = 0;
if (wantThinking) {
  thinkingStartedAt = Date.now();
  (session as any).thinkingStartedAt = thinkingStartedAt;
  (this.activeStream as any)?.resetThinkingTimer?.(id);
  yield { thinkingStatus: 'thinking' };
}
```

and after the loop (before the `finally` save), when `wantThinking && thinkingText`:

```ts
const thinkingDurationMs = Date.now() - (thinkingStartedAt || Date.now());
(this.activeStream as any)?.completeThinking?.(id, thinkingDurationMs);
yield { thinkingStatus: 'done', thinkingDurationMs };
```

Assistant-save object: add `thinkingText: thinkingText || null, thinkingDurationMs: thinkingText ? thinkingDurationMsValue : null` (compute `thinkingDurationMsValue` once next to `thinkingDurationMs`; when no reasoning arrived, both null and NO `done` chunk is emitted — the box never appears, per spec).

`dto.ts`: add to `SendMsgDto`:

```ts
@IsOptional()
@IsBoolean({ message: 'گزینه تفکر عمیق باید boolean باشد' })
useThinking?: boolean;
```

`chat.controller.ts send()`: extend options: `{ useWebSearch: d.useWebSearch === true, useThinking: d.useThinking === true }`. SSE writers (both loops), next to the sources writers:

```ts
if (typeof chunk.thinking === 'string' && chunk.thinking && !clientDisconnected && !res.writableEnded) {
  try {
    res.write(`event: thinking\ndata: ${JSON.stringify({ content: chunk.thinking })}\n\n`);
  } catch { clientDisconnected = true; }
}
if (chunk.thinkingStatus && !clientDisconnected && !res.writableEnded) {
  try {
    res.write(`event: thinking-status\ndata: ${JSON.stringify({ state: chunk.thinkingStatus, durationMs: chunk.thinkingDurationMs ?? null })}\n\n`);
  } catch { clientDisconnected = true; }
}
if (typeof chunk.thinkingSync === 'string' && chunk.thinkingSync && !clientDisconnected && !res.writableEnded) {
  try {
    res.write(`event: thinking\ndata: ${JSON.stringify({ content: chunk.thinkingSync, replay: true })}\n\n`);
  } catch { clientDisconnected = true; }
}
```

(`thinkingSync` reuses the `thinking` event with a `replay: true` flag so the frontend parser needs no new branch — it sets instead of appends.)

`active-stream.service.ts`:
- `StreamEvent`: append `| { type: 'thinking'; content: string } | { type: 'thinking-done'; durationMs: number }`
- Session: append `reasoningText?: string; thinkingStartedAt?: number`
- Methods:

```ts
appendReasoning(conversationId: string, text: string): void {
  const session = this.sessions.get(conversationId);
  if (!session || session.status === 'completed' || session.status === 'error') return;
  if (!session.thinkingStartedAt) session.thinkingStartedAt = Date.now();
  session.reasoningText = (session.reasoningText ?? '') + text;
  this.resetThinkingTimer(conversationId);
  const event: StreamEvent = { type: 'thinking', content: text };
  for (const sub of session.subscribers) {
    try { sub(event); } catch (err) { this.logger.warn(`Subscriber error on thinking emit: ${err}`); }
  }
}

completeThinking(conversationId: string, durationMs: number): void {
  const session = this.sessions.get(conversationId);
  if (!session) return;
  const event: StreamEvent = { type: 'thinking-done', durationMs };
  for (const sub of session.subscribers) {
    try { sub(event); } catch (err) { this.logger.warn(`Subscriber error on thinking-done emit: ${err}`); }
  }
}
```

- `attachToActiveStream` in `chat.service.ts`: after the sources replay add:

```ts
if (session.reasoningText) {
  yield { thinkingSync: session.reasoningText };
}
```

and in the subscriber callback:

```ts
} else if (event.type === 'thinking') {
  queue.push({ thinking: event.content });
} else if (event.type === 'thinking-done') {
  queue.push({ thinkingStatus: 'done', thinkingDurationMs: event.durationMs });
}
```

- [ ] **Step 4: Verify**

Run: `cd backend && npx jest test/chat-thinking-flow.spec.ts test/chat-search-flow.spec.ts test/chat-real-stream.spec.ts --runInBand && npm run lint`
Expected: PASS + clean

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/chat/chat.service.ts backend/src/modules/chat/chat.controller.ts backend/src/modules/chat/active-stream.service.ts backend/src/modules/chat/dto.ts backend/src/modules/chat/thinking-models.ts backend/test/chat-thinking-flow.spec.ts
git commit -m "feat(thinking): thinking stream, SSE events and session replay"
```

---

### Task 12: Thinking persistence — entity, migration, history (Phase 2)

**Files:**
- Modify: `backend/src/modules/chat/message.entity.ts`
- Create: `backend/src/migrations/1761300000001-AddMessageThinking.ts`

**Interfaces:**
- Consumes: Task 11 save
- Produces: `Message.thinkingText?: string | null`, `Message.thinkingDurationMs?: number | null` (both returned by `history()` automatically — entity-wide `find`, same as Task 9)

- [ ] **Step 1: Column + migration**

```ts
// message.entity.ts — append after sources:
/** Raw reasoning text streamed before the answer (null when unused). */
@Column({ type: 'text', nullable: true, default: null })
thinkingText?: string | null;
/** Wall-clock ms spent in the thinking phase (null when unused). */
@Column({ type: 'int', nullable: true, default: null })
thinkingDurationMs?: number | null;
```

```ts
// backend/src/migrations/1761300000001-AddMessageThinking.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

/** Stores the streamed reasoning text alongside the assistant message. */
export class AddMessageThinking1761300000001 implements MigrationInterface {
  name = 'AddMessageThinking1761300000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "messages"
        ADD COLUMN IF NOT EXISTS "thinkingText" text NULL DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS "thinkingDurationMs" integer NULL DEFAULT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "messages"
        DROP COLUMN IF EXISTS "thinkingText",
        DROP COLUMN IF EXISTS "thinkingDurationMs"
    `);
  }
}
```

- [ ] **Step 2: Verify**

Run: `cd backend && npm run lint && npx jest test/chat-thinking-flow.spec.ts --runInBand`
Expected: clean + PASS

- [ ] **Step 3: Commit**

```bash
git add backend/src/modules/chat/message.entity.ts backend/src/migrations/1761300000001-AddMessageThinking.ts
git commit -m "feat(thinking): persist thinkingText and duration on Message"
```

---

### Task 13: Frontend thinking — contract, toggle, live box

**Files:**
- Modify: `frontend/src/types/index.ts`, `frontend/src/services/chat.service.ts`, `frontend/src/stores/chat.ts`, `frontend/src/components/chat/ChatComposer.vue`, `frontend/src/components/chat/MessageList.vue`
- Modify: `frontend/src/modules/thinking-compat.ts` (NEW — mirror of backend allowlist)
- Test: `frontend/tests/chat-thinking.spec.ts`

**Interfaces:**
- Consumes: SSE `thinking` / `thinking-status`; `modelsStore` selected model `apiIdentifier`
- Produces: `thinking-compat.ts` (`modelSupportsThinking`, same patterns); store `convFlags { web, thinking }`, state `streamingThinking/isThinkingActive/thinkingDurationMs`; composer `[data-testid="toggle-thinking"]` (disabled + reason when incompatible); `MessageList` `[data-testid="thinking-live-box"]`

- [ ] **Step 1: Write the test**

```ts
// frontend/tests/chat-thinking.spec.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import MessageList from '../src/components/chat/MessageList.vue'
import { useChatStore } from '../src/stores/chat'
import { modelSupportsThinking } from '../src/modules/thinking-compat'

const CONV = 'think-conv'

describe('live thinking box', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  it('recognizes reasoning-capable identifiers only', () => {
    expect(modelSupportsThinking('deepseek-reasoner')).toBe(true)
    expect(modelSupportsThinking('gpt-4o')).toBe(false)
    expect(modelSupportsThinking(null)).toBe(false)
  })

  it('streams reasoning text into a live box while thinking', async () => {
    const chatStore = useChatStore()
    chatStore.currentConversationId = CONV
    chatStore.convStreamStates.set(CONV, {
      isStreaming: true, isThinking: false, streamError: null,
      currentStreamingText: '', abortController: null, watchdogTimer: null,
      lastUserPrompt: '', charBuffer: [], releaseTimer: null,
      streamingSources: null, isSearching: false, searchFailed: false,
      streamingThinking: 'بخشی از استدلال', isThinkingActive: true, thinkingDurationMs: null,
    } as any)
    const wrapper = mount(MessageList, {
      global: { stubs: { EmptyState: true, MessageBubble: true, MarkdownContent: true, ThinkingIndicator: true } },
    })
    await wrapper.vm.$nextTick()
    const box = wrapper.find('[data-testid="thinking-live-box"]')
    expect(box.exists()).toBe(true)
    expect(box.text()).toContain('بخشی از استدلال')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && npx vitest run tests/chat-thinking.spec.ts`
Expected: FAIL (no such module; no live box)

- [ ] **Step 3: Implement**

`thinking-compat.ts`:

```ts
export const THINKING_COMPATIBLE_PATTERNS = [
  'reasoner', 'reasoning', 'r1', 'qwq', 'o1', 'o3', 'gpt-5',
]

export function modelSupportsThinking(apiIdentifier?: string | null): boolean {
  if (!apiIdentifier) return false
  const id = apiIdentifier.toLowerCase()
  return THINKING_COMPATIBLE_PATTERNS.some((p) => id.includes(p))
}
```

`dispatchSseEvent` callbacks: add `onThinking?: (t: string, replay?: boolean) => void; onThinkingStatus?: (state: string, durationMs?: number | null) => void` with branches:

```ts
else if (currentEvent === 'thinking' && typeof data.content === 'string') cb.onThinking?.(data.content, data.replay === true)
else if (currentEvent === 'thinking-status' && data.state) cb.onThinkingStatus?.(data.state, typeof data.durationMs === 'number' ? data.durationMs : null)
```

`sendMessageStream`: add `onThinking?, onThinkingStatus?` params (end of signature, optional) and forward to both direct + reconnect paths.

Store: `ConvStreamState` + `makeDefaultState` gain `streamingThinking: string, isThinkingActive: boolean, thinkingDurationMs: number | null` (defaults `'', false, null`); `convFlags` shape becomes `{ web: boolean; thinking: boolean }` (`getConvFlag` default `{ web: false, thinking: false }`; `setConvFlag` patch type extended). `executeMessageStream` gains `opts?: { useWebSearch?: boolean; useThinking?: boolean }`; thinking callbacks: `onThinking(t, replay)` → `replay ? s.streamingThinking = t : s.streamingThinking += t` + `s.isThinkingActive = true` + `resetWatchdog`; `onThinkingStatus('done', ms)` → `s.isThinkingActive = false; s.thinkingDurationMs = ms`. `sendMessage` opts extended the same way; effective flags `opts?.useThinking ?? getConvFlag(convId).thinking`; flag migration block from Task 6 now spreads both keys (it already spreads the whole `'__new__'` object — no change needed). `finishStream`: reset the three thinking fields alongside the sources reset from Task 6 (do NOT copy thinking into the pushed message — history reload provides it).

`ChatComposer.vue` + menu (after the web toggle from Task 7):

```vue
<button
  type="button"
  class="attachment-menu-item"
  data-testid="toggle-thinking"
  :class="thinkingOn && thinkingSupported ? 'bg-primary/10 text-primary' : ''"
  :disabled="!thinkingSupported"
  :title="thinkingSupported ? 'تفکر عمیق' : 'این مدل از نمایش تفکر پشتیبانی نمی‌کند'"
  @click="toggleThinking"
>
  <svg .../><!-- brain/spark icon --></svg>
  <span>تفکر عمیق</span>
  <BaseToggle
    size="sm"
    :modelValue="thinkingOn"
    :disabled="!thinkingSupported"
    @click.stop
    @update:modelValue="toggleThinking"
  />
</button>
```

```ts
import { modelSupportsThinking } from '../../modules/thinking-compat'
const selectedApiIdentifier = computed(() =>
  modelsStore.selectedModel?.apiIdentifier ?? modelsStore.selectedModel?.name ?? null,
)
const thinkingSupported = computed(() => modelSupportsThinking(selectedApiIdentifier.value))
const thinkingOn = computed(() => chatStore.getConvFlag(activeConvId.value).thinking ?? false)
function toggleThinking() {
  if (!thinkingSupported.value) return
  chatStore.setConvFlag(activeConvId.value, { thinking: !thinkingOn.value })
  attachmentMenuOpen.value = false
}
```

(`modelsStore.selectedModel` shape: verify against `stores/models.ts` when implementing — if the identifier lives under a different key, use it; the test pins only `modelSupportsThinking`.) Send call becomes `chatStore.sendMessage(text, files, { useWebSearch: ..., useThinking: thinkingOn.value })`.

`MessageList.vue` streaming-row: before the streaming text block, when `isThinkingActive || streamingThinking`:

```vue
<div
  v-if="thinkingActive || streamingThinkingText"
  data-testid="thinking-live-box"
  class="rounded-xl border border-primary/20 bg-primary/[0.04] p-3 text-[13px]"
>
  <div class="flex items-center justify-between gap-2">
    <span class="font-medium text-muted-foreground">{{ thinkingActive ? 'در حال تفکر…' : `تفکر انجام شد (${thinkingSecs} ثانیه)` }}</span>
    <Button variant="ghost" size="sm" @click="thinkingCollapsed = !thinkingCollapsed">{{ thinkingCollapsed ? 'نمایش' : 'بستن' }}</Button>
  </div>
  <div v-show="!thinkingCollapsed" class="mt-2 whitespace-pre-wrap text-foreground/90">{{ streamingThinkingText }}</div>
</div>
```

(Styling rule: Tailwind utilities only + shadcn `Button`; import `Button` from the ui button module. No new CSS classes.)

backed by store computeds (`thinkingActive/thinkingSecs/streamingThinkingText` from current-conv state, same pattern as `currentStreamingText` at line 99) + local `thinkingCollapsed` ref auto-set to true when `thinkingStatus done` arrives (watch the store duration field). No frontend `ActiveStreamStatus` type change is needed (extra response fields are ignored).

- [ ] **Step 4: Verify**

Run: `cd frontend && npx vitest run tests/chat-thinking.spec.ts tests/chat-service-sse.spec.ts tests/ChatComposer.flags.spec.ts`
Expected: PASS

Run: `cd frontend && npx vue-tsc -b`
Expected: clean

- [ ] **Step 5: Commit**

```bash
git add frontend/src/types/index.ts frontend/src/services/chat.service.ts frontend/src/stores/chat.ts frontend/src/components/chat/ChatComposer.vue frontend/src/components/chat/MessageList.vue frontend/src/modules/thinking-compat.ts frontend/tests/chat-thinking.spec.ts
git commit -m "feat(thinking): toggle, live thinking box with duration and auto-collapse"
```

---

### Task 14: Stored thinking render + Phase 2 close-out

**Files:**
- Modify: `frontend/src/components/chat/MessageBubble.vue`, `frontend/tests/MessageBubble.thinking.spec.ts` (NEW)
- Modify: `docs/wiki/features.md`, `docs/wiki/architecture.md`, `docs/wiki/api-reference.md`

**Interfaces:**
- Consumes: `Message.thinkingText/thinkingDurationMs` from history
- Produces: collapsed «روند تفکر» box under stored assistant messages

- [ ] **Step 1: Write the test**

```ts
// frontend/tests/MessageBubble.thinking.spec.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import MessageBubble from '../src/components/chat/MessageBubble.vue'

function mountBubble(message: any) {
  return mount(MessageBubble, {
    props: { message: { id: 'm1', conversationId: 'c1', role: 'assistant', content: 'final', createdAt: new Date().toISOString(), ...message } },
    global: { stubs: { MarkdownContent: true, FilePreviewCard: true } },
  })
}

describe('stored thinking box', () => {
  beforeEach(() => { setActivePinia(createPinia()) })
  it('shows a collapsed thinking box with duration when thinkingText exists', () => {
    const w = mountBubble({ thinkingText: 'r-text', thinkingDurationMs: 4200 })
    const box = w.find('[data-testid="thinking-stored-box"]')
    expect(box.exists()).toBe(true)
    expect(box.text()).toContain('۴.۲ ثانیه')
    expect(box.classes()).toContain('is-collapsed')
  })
  it('renders no box when thinkingText is absent', () => {
    expect(mountBubble({}).find('[data-testid="thinking-stored-box"]').exists()).toBe(false)
  })
})
```

(Duration formatting: seconds with one decimal in Persian digits — implement `formatThinkingDuration(ms)` in the component or `utils/format.ts`; the test pins `۴.۲ ثانیه` for 4200ms.)

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && npx vitest run tests/MessageBubble.thinking.spec.ts`
Expected: FAIL

- [ ] **Step 3: Implement** — in `MessageBubble.vue` after `SourcesBlock` (Tailwind utilities only, no new classes):

```vue
<div
  v-if="!isUser && message.thinkingText"
  data-testid="thinking-stored-box"
  class="mt-2 rounded-xl border border-border/50 bg-muted/30 p-3 text-[13px]"
>
  <button class="flex w-full items-center gap-2 text-muted-foreground" @click="thinkingOpen = !thinkingOpen">
    <span class="font-medium">روند تفکر</span>
    <span v-if="message.thinkingDurationMs != null" class="text-xs">{{ formatThinkingDuration(message.thinkingDurationMs) }}</span>
    <span class="ms-auto text-xs">{{ thinkingOpen ? '▾' : '▸' }}</span>
  </button>
  <div v-show="thinkingOpen" class="mt-2 whitespace-pre-wrap text-foreground/90">{{ message.thinkingText }}</div>
</div>
```

with `const thinkingOpen = ref(false)` and `formatThinkingDuration` (ms → `X.Y ثانیه` Persian digits; `<1000ms` → `کمتر از یک ثانیه`).

- [ ] **Step 4: Wiki + full gates**

Wiki: `features.md` Phase 2 entry; `architecture.md`/`api-reference.md`: `thinking`/`thinking-status` events, `useThinking`, `Message.thinkingText/thinkingDurationMs`, honesty note (reasoning deltas only, toggle-gated, hiding the box never disables reasoning cost).

Run: `cd backend && npm run lint && npx jest test --runInBand`
Expected: clean + green

Run: `cd frontend && npx vitest run && npm run build`
Expected: green + build passes

Manual: reasoning model + toggle → live box → auto-collapse + duration; stored message → collapsed box after refresh; non-reasoning model → thinking toggle disabled with reason; toggle off → zero thinking UI; model switch mid-conversation re-evaluates support.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/chat/MessageBubble.vue frontend/tests/MessageBubble.thinking.spec.ts docs/wiki/features.md docs/wiki/architecture.md docs/wiki/api-reference.md
git commit -m "feat(thinking): stored thinking box, wiki and contract docs"
```

---

## Self-Review

**1. Spec coverage:** every decided item maps to a task — Serper service (T1), admin kill-switch default-on (T2), sources persistence (T3), search flow + failure note (T4), SSE + replay (T5), frontend contract + per-conv flags (T6), composer toggle (T7), cards + citations (T8), env/wiki/green (T9), reasoning deltas OpenAI-only (T10), thinking flow + events (T11), thinking persistence (T12), toggle gating + live box + duration + auto-collapse (T13), stored box + wiki (T14). OpenAiCompatController (`/v1/*`) is intentionally untouched — no flags, old behavior.

**2. Placeholder scan:** no TBD/TODO; every step names exact files, symbols, commands, and expected outputs. Two near-misses fixed during review: Task 4's `activeStream` method calls now cast `as any` (methods land in Task 5), and Task 6/7/13 give exact store anchors (`ConvStreamState` 11-21, `makeDefaultState` 27-39, `finishStream` push 1037-1044, temp→real migration mirroring `sendMessage` 786-797).

**3. Type consistency:** `WebSource` shape identical backend/frontend; `ChatChunk` extensions match both controller writers; `StreamEvent` ↔ `attachToActiveStream` mapping covers every new event; `thinkingSync` reuses the `thinking` SSE event with `replay: true` so the parser needs no extra branch; `convFlags` shape evolves `{web}` → `{web, thinking}` with backward-compatible defaults; `sendMessage/retry` paths inherit stored flags; `resume()` ignores non-string pieces (Task 10).
...[truncated 6150 chars]