# Thinking + Model Capabilities Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add deep-thinking display (real model reasoning only) driven by a generic per-model capability system (thinking/vision/document), with provider adapters behind one interface, so the UI, the stream and the admin stay in sync without repeated code.

**Architecture:** `OpenAiCompatForwarder` stays a facade with identical signatures (all current callers and tests untouched); inside it delegates parsing to an `OpenAICompatAdapter` implementing the new `StreamAdapter` interface (`buildRequest`, `parseStreamChunk`), which is the ONLY place thinking extraction lives. Capabilities are explicit per-model flags (`supportsThinking/vision/document` + `thinkingBudgetTokens`) set in the admin model form; the frontend derives every toggle, picker state, badge and attach guard from one `capabilities.ts` registry plus one `CapabilityBadge.vue` component. Reasoning text persists in `Message.reasoning_content` and renders through one `ThinkingBlock.vue` (shadcn-style Collapsible).

**Tech Stack:** NestJS 10 + TypeORM + PostgreSQL (backend, Jest); Vue 3 + Vite + Pinia + Tailwind + shadcn-vue/reka-ui (frontend, Vitest). OpenAI-compatible providers only — no Anthropic/native APIs in this phase (explicitly out of scope).

**Spec:** `docs/superpowers/specs/2026-09-18-web-search-and-thinking-design.md` (section "Thinking — Final Design", which supersedes the earlier Thinking draft)

## Global Constraints

- Entity change ⇒ hand-written migration in `backend/src/migrations/` with `IF NOT EXISTS` (prod runs migrations; dev uses `DB_SYNC=true`).
- Every new DTO/API/SSE/DB field is OPTIONAL or defaulted — old clients, old servers and old rows keep working (golden rule: a new feature never breaks a previous one).
- OpenAI-compatible only. Reasoning is read solely from chat-completions deltas (`reasoning_content` / `reasoning`). No Anthropic/native support, no Responses API.
- Thinking content is display-only: NEVER generated, NEVER faked. Hiding the box does not change what the model computes.
- Secrets only from env, never in code. Persian user-facing and validation messages (existing `FA.*` / inline style).
- New SSE events are exactly: `thinking` (`{content}`), `thinking-status` (`{state:'thinking'|'done', durationMs}`). Existing events unchanged.
- Frontend is Persian RTL; streaming renders incrementally. Styling rule: Tailwind utilities + existing shadcn-vue/reusable components ONLY. Define NO new CSS classes in `<style>` blocks. `data-testid` attributes are allowed.
- Backend gates per task: `cd backend && npm run lint` (tsc --noEmit) and `npx jest test/<spec>.spec.ts --runInBand`.
- Frontend gates per task: `cd frontend && npx vitest run tests/<spec>.spec.ts` and `npx vue-tsc -b` with an error set identical to develop HEAD (prove with the normalized diff used throughout this project).
- Wiki (`docs/wiki/features.md`, plus `architecture.md`/`api-reference.md` for contract changes) updated at close-out.

---

## File Structure

```
backend/src/modules/ai/adapters/
  stream-adapter.ts          ← NEW: StreamChunk union + StreamAdapter interface
  openai-compat.adapter.ts   ← NEW: OpenAI-compatible request builder + chunk parser
backend/src/modules/ai/
  openai-compat.forwarder.ts ← FACADE: same signatures, delegates to the adapter
backend/src/modules/models-admin/
  ai-model.entity.ts         ← + supportsThinking/vision/document, thinkingBudgetTokens
  dto.ts                     ← CreateModelDto/UpdateModelDto += the four fields
backend/src/modules/chat/
  chat.service.ts            ← options.useThinking, thinking yields, reasoning save,
                               attachment capability guards
  chat.controller.ts         ← thinking/thinking-status SSE writers (both loops)
  active-stream.service.ts   ← reasoning buffer + replay
  dto.ts                     ← SendMsgDto.useThinking
  message.entity.ts          ← reasoning_content + thinkingDurationMs
backend/src/migrations/
  1761300000002-AddModelCapabilities.ts  ← NEW
  1761300000003-AddMessageReasoning.ts   ← NEW
backend/test/
  ai-adapter.spec.ts              ← NEW (adapter fixtures)
  models-capabilities.spec.ts     ← NEW (entity fields via service fakes)
  chat-thinking-flow.spec.ts      ← NEW (generate thinking flow)
frontend/src/components/ui/collapsible/
  Collapsible.vue / CollapsibleTrigger.vue / CollapsibleContent.vue / index.ts ← NEW
frontend/src/
  utils/capabilities.ts      ← NEW: registry, ModelCapability, modelSupports()
  utils/models.ts            ← markDefaultModel (exists; reused, untouched)
  components/chat/CapabilityBadge.vue ← NEW
  components/chat/ThinkingBlock.vue   ← NEW
  components/chat/ChatComposer.vue    ← thinking toggle, picker filtering, attach guards, badges
  components/chat/MessageList.vue     ← live ThinkingBlock wiring
  components/chat/MessageBubble.vue   ← stored ThinkingBlock wiring
  stores/chat.ts             ← convFlags.thinking, sendMessage opts, switch rollback
  stores/models.ts           ← untouched (defaultModel/selectedModel logic reused)
  services/models.service.ts ← getDefaultModel (exists; reused, untouched)
  services/chat.service.ts   ← sendMessageStream opts.useThinking + thinking callbacks
  types/index.ts             ← Model + Message capability/reasoning fields
  views/AdminPanelView.vue   ← model form: modes selector + budget input
frontend/tests/
  capabilities.spec.ts  ← NEW
  CapabilityBadge.spec.ts ← NEW
  ThinkingBlock.spec.ts ← NEW
  ChatComposer.thinking.spec.ts ← NEW
```

---

### Task 1: StreamAdapter interface + OpenAI adapter + facade (TDD)

**Files:**
- Create: `backend/src/modules/ai/adapters/stream-adapter.ts`
- Create: `backend/src/modules/ai/adapters/openai-compat.adapter.ts`
- Modify: `backend/src/modules/ai/openai-compat.forwarder.ts` (delegate only; signatures unchanged)
- Test: `backend/test/ai-adapter.spec.ts`

**Interfaces:**
- Consumes: `ChatMessage`, `ResolvedTarget`, `StreamOptions` (import type-only from `../openai-compat.forwarder` — do NOT move them).
- Produces: `export type StreamChunk = { type: 'content'; text: string } | { type: 'reasoning'; text: string }`, `export interface StreamAdapter { readonly name: string; buildRequest(ctx): { url: string; init: RequestInit }; parseStreamChunk(payload: unknown): StreamChunk[] }`, `OpenAiCompatAdapter`. Facade `stream()` keeps yielding `string` for content and adds `{ reasoning: string }` objects (union is backward compatible: old string-only mocks and consumers never see objects).

- [ ] **Step 1: Write the failing test**

```ts
// backend/test/ai-adapter.spec.ts
import { OpenAiCompatAdapter } from '../src/modules/ai/adapters/openai-compat.adapter';

const adapter = new OpenAiCompatAdapter();
const target: any = { apiIdentifier: 'deepseek-reasoner', apiKey: 'k', baseUrl: 'https://x/v1' };

it('builds the chat-completions request', () => {
  const { url, init } = adapter.buildRequest({ target, messages: [{ role: 'user', content: 'hi' }] });
  expect(url).toBe('https://x/v1/chat/completions');
  const body = JSON.parse((init as any).body);
  expect(body).toEqual({ model: 'deepseek-reasoner', messages: [{ role: 'user', content: 'hi' }], stream: true });
});

it('parses content and reasoning deltas separately', () => {
  expect(adapter.parseStreamChunk({ choices: [{ delta: { content: 'hi' } }] })).toEqual([
    { type: 'content', text: 'hi' },
  ]);
  expect(adapter.parseStreamChunk({ choices: [{ delta: { reasoning_content: 'let me think' } }] })).toEqual([
    { type: 'reasoning', text: 'let me think' },
  ]);
  expect(adapter.parseStreamChunk({ choices: [{ delta: { reasoning: 'r' } }] })).toEqual([
    { type: 'reasoning', text: 'r' },
  ]);
});

it('returns both when one delta carries both, reasoning first', () => {
  expect(
    adapter.parseStreamChunk({ choices: [{ delta: { reasoning_content: 'r', content: 'c' } }] }),
  ).toEqual([
    { type: 'reasoning', text: 'r' },
    { type: 'content', text: 'c' },
  ]);
});

it('ignores keep-alives, empty deltas and garbage', () => {
  expect(adapter.parseStreamChunk({ choices: [{ delta: {} }] })).toEqual([]);
  expect(adapter.parseStreamChunk({ foo: 1 })).toEqual([]);
  expect(adapter.parseStreamChunk('not-json')).toEqual([]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest test/ai-adapter.spec.ts --runInBand`
Expected: FAIL with "Cannot find module '../src/modules/ai/adapters/openai-compat.adapter'"

- [ ] **Step 3: Write minimal implementation**

```ts
// backend/src/modules/ai/adapters/stream-adapter.ts
import type { ChatMessage, ResolvedTarget, StreamOptions } from '../openai-compat.forwarder';

export type StreamChunk =
  | { type: 'content'; text: string }
  | { type: 'reasoning'; text: string };

export interface StreamRequestContext {
  target: ResolvedTarget;
  messages: ChatMessage[];
  options?: StreamOptions;
}

export interface StreamAdapter {
  readonly name: string;
  buildRequest(ctx: StreamRequestContext): { url: string; init: RequestInit };
  parseStreamChunk(payload: unknown): StreamChunk[];
}
```

```ts
// backend/src/modules/ai/adapters/openai-compat.adapter.ts
import type { StreamAdapter, StreamChunk, StreamRequestContext } from './stream-adapter';

export class OpenAiCompatAdapter implements StreamAdapter {
  readonly name = 'openai-compat';

  buildRequest({ target, messages }: StreamRequestContext): { url: string; init: RequestInit } {
    const url = target.baseUrl.endsWith('/chat/completions')
      ? target.baseUrl
      : `${target.baseUrl}/chat/completions`;
    return {
      url,
      init: {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${target.apiKey}`,
        },
        body: JSON.stringify({ model: target.apiIdentifier, messages, stream: true }),
      },
    };
  }

  parseStreamChunk(payload: unknown): StreamChunk[] {
    const delta = (payload as any)?.choices?.[0]?.delta;
    if (!delta || typeof delta !== 'object') return [];
    const out: StreamChunk[] = [];
    const reasoning =
      typeof delta.reasoning_content === 'string'
        ? delta.reasoning_content
        : typeof delta.reasoning === 'string'
          ? delta.reasoning
          : null;
    if (reasoning) out.push({ type: 'reasoning', text: reasoning });
    if (typeof delta.content === 'string' && delta.content) {
      out.push({ type: 'content', text: delta.content });
    }
    return out;
  }
}
```

Then rewire `OpenAiCompatForwarder.stream()` internals ONLY: replace URL/body construction with `this.adapter.buildRequest(...)` and replace the delta extraction with `this.adapter.parseStreamChunk(deltaContainer)` per SSE `data:` line (`[DONE]` handling, connect/stall timeouts, abort wiring and `complete()` stay exactly as they are). The method keeps yielding content strings and additionally yields `{ reasoning: string }` objects. In `resume()` (same file) add a type-narrow so reasoning objects can never reach the word-splitter:

```ts
for await (const piece of this.stream(target, messages)) {
  if (typeof piece !== 'string') continue; // reasoning deltas are ignored on resume
  const token: string = piece;
  // ... existing split/pace loop unchanged
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && npx jest test/ai-adapter.spec.ts test/ai-forwarder.spec.ts test/chat-real-stream.spec.ts --runInBand`
Expected: PASS (facade behavior identical for content; old suites untouched)

Run: `cd backend && npm run lint`
Expected: clean

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/ai/adapters backend/src/modules/ai/openai-compat.forwarder.ts backend/test/ai-adapter.spec.ts
git commit -m "feat(thinking): provider adapter interface with OpenAI implementation behind forwarder facade"
```

---

### Task 2: Model capabilities + budget columns, DTOs (TDD where it counts)

**Files:**
- Modify: `backend/src/modules/models-admin/ai-model.entity.ts`
- Create: `backend/src/migrations/1761300000002-AddModelCapabilities.ts`
- Modify: `backend/src/modules/models-admin/dto.ts` (CreateModelDto + UpdateModelDto)
- Modify: `backend/src/modules/models-admin/models-admin.service.ts` (pass the four fields through in create/update, following the file's existing `if (d.x !== undefined)` pattern)
- Test: `backend/test/models-capabilities.spec.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `AiModel.supportsThinking=false`, `supportsVision=true`, `supportsDocument=true`, `thinkingBudgetTokens=null` (all defaults preserve current behavior: vision/docs keep working everywhere, thinking UI stays off until enabled).

- [ ] **Step 1: Write the failing test**

```ts
// backend/test/models-capabilities.spec.ts
import { ModelsAdminService } from '../src/modules/models-admin/models-admin.service';

function makeService() {
  const rows = new Map<string, any>();
  let seq = 0;
  const repo: any = {
    create: (o: any) => ({ ...o }),
    save: async (o: any) => {
      const m = { id: o.id ?? `m-${++seq}`, ...o };
      rows.set(m.id, m);
      return { ...m };
    },
    findOne: async ({ where }: any) => rows.get(where.id) ?? null,
  };
  return { svc: new ModelsAdminService(repo, {} as any), rows };
}

it('stores capabilities and budget on create with safe defaults', async () => {
  const { svc, rows } = makeService();
  const created: any = await svc.create({
    name: 'R',
    provider: 'p',
    apiIdentifier: 'r1',
    supportsThinking: true,
  } as any);
  expect(created.supportsThinking).toBe(true);
  expect(created.supportsVision).toBe(true);
  expect(created.supportsDocument).toBe(true);
  expect(created.thinkingBudgetTokens ?? null).toBeNull();
  expect(rows.get(created.id).supportsThinking).toBe(true);
});

it('updates capabilities and budget explicitly, including false', async () => {
  const { svc, rows } = makeService();
  const created: any = await svc.create({ name: 'R', provider: 'p', apiIdentifier: 'r1' } as any);
  const updated: any = await svc.update(created.id, {
    supportsThinking: false,
    supportsVision: false,
    thinkingBudgetTokens: 2000,
  } as any);
  expect(updated.supportsThinking).toBe(false);
  expect(updated.supportsVision).toBe(false);
  expect(updated.supportsDocument).toBe(true);
  expect(updated.thinkingBudgetTokens).toBe(2000);
  expect(rows.get(created.id).thinkingBudgetTokens).toBe(2000);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest test/models-capabilities.spec.ts --runInBand`
Expected: FAIL (unknown fields dropped / `supportsThinking` undefined — adapt the assertion target to whatever the service does today, but it must fail pre-fix; if `create` spreads the DTO the first assertion may pass while `update` drops `false` — either red is the correct red)

- [ ] **Step 3: Implement**

```ts
// ai-model.entity.ts — append after isDefault:
/** Reasoning display + reasoning parse gate. Off by default: no thinking UI until enabled. */
@Column({ default: false })
supportsThinking: boolean;
/** Image attachments. On by default: preserves current behavior for existing models. */
@Column({ default: true })
supportsVision: boolean;
/** Document attachments (pdf/excel/text). On by default: preserves current behavior. */
@Column({ default: true })
supportsDocument: boolean;
/** Max thinking text accumulated per message (null = uncapped). Display-side budget. */
@Column({ type: 'int', nullable: true, default: null })
thinkingBudgetTokens?: number | null;
```

```ts
// backend/src/migrations/1761300000002-AddModelCapabilities.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

/** Per-model capability flags + thinking budget (safe defaults keep old rows working). */
export class AddModelCapabilities1761300000000 implements MigrationInterface {
  name = 'AddModelCapabilities1761300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "ai_models"
        ADD COLUMN IF NOT EXISTS "supportsThinking" boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "supportsVision" boolean NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS "supportsDocument" boolean NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS "thinkingBudgetTokens" integer NULL DEFAULT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "ai_models"
        DROP COLUMN IF EXISTS "supportsThinking",
        DROP COLUMN IF EXISTS "supportsVision",
        DROP COLUMN IF EXISTS "supportsDocument",
        DROP COLUMN IF EXISTS "thinkingBudgetTokens"
    `);
  }
}
```

DTOs (`dto.ts`): in BOTH `CreateModelDto` and `UpdateModelDto` add (all optional so old clients keep working):

```ts
@IsOptional()
@IsBoolean({ message: FA.boolean('supportsThinking') })
supportsThinking?: boolean;

@IsOptional()
@IsBoolean({ message: FA.boolean('supportsVision') })
supportsVision?: boolean;

@IsOptional()
@IsBoolean({ message: FA.boolean('supportsDocument') })
supportsDocument?: boolean;

@IsOptional()
@IsInt({ message: 'بودجه thinking باید عدد صحیح باشد' })
@Min(1, { message: 'بودجه thinking باید حداقل ۱ باشد' })
thinkingBudgetTokens?: number | null;
```

(`IsBoolean`, `IsInt`, `Min` are already imported in that file — verify while editing; `FA.boolean(...)` follows the file's existing pattern.)

Service `create()`/`update()`: open each method and pass the four fields through with explicit `!== undefined` guards (so an explicit `false` is never dropped — this is what the second test pins):

```ts
if (d.supportsThinking !== undefined) m.supportsThinking = d.supportsThinking;
if (d.supportsVision !== undefined) m.supportsVision = d.supportsVision;
if (d.supportsDocument !== undefined) m.supportsDocument = d.supportsDocument;
if (d.thinkingBudgetTokens !== undefined) m.thinkingBudgetTokens = d.thinkingBudgetTokens;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && npx jest test/models-capabilities.spec.ts test/models-admin.spec.ts test/models-admin-default.spec.ts --runInBand && npm run lint`
Expected: PASS + clean

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/models-admin/ai-model.entity.ts backend/src/modules/models-admin/dto.ts backend/src/modules/models-admin/models-admin.service.ts backend/src/migrations/1761300000002-AddModelCapabilities.ts backend/test/models-capabilities.spec.ts
git commit -m "feat(thinking): per-model capability flags and thinking budget with migration"
```

---

### Task 3: generate() thinking flow (TDD)

**Files:**
- Modify: `backend/src/modules/chat/chat.service.ts` (`ChatChunk`, `generate` signature + thinking branch + budget cap)
- Modify: `backend/src/modules/chat/chat.controller.ts` (thinking writers in BOTH `send()` and `streamActive()` loops)
- Modify: `backend/src/modules/chat/active-stream.service.ts` (reasoning buffer + replay + timer re-arm)
- Modify: `backend/src/modules/chat/dto.ts` (`SendMsgDto.useThinking`)
- Test: `backend/test/chat-thinking-flow.spec.ts`

**Interfaces:**
- Consumes: `ReasoningPiece` (`{ reasoning: string }`) from the facade stream; `model.supportsThinking`, `model.thinkingBudgetTokens`.
- Produces: chunks `{ thinking?: string; thinkingStatus?: 'thinking' | 'done'; thinkingDurationMs?: number; thinkingSync?: string }`; SSE `thinking` / `thinking-status` (thinkingSync reuses the `thinking` event with `replay: true` so the parser needs no extra branch).

- [ ] **Step 1: Write the failing test** (same `makeRepos` fake style as `test/chat-search-flow.spec.ts`: `conv`/`msg` fakes annotated `as any`; ChatService ctor order is `(conv, msg, models, forwarder, settings?, users?, activeStream?, fileRepo?, webSearch?)` — new tests need no new ctor args)

```ts
// backend/test/chat-thinking-flow.spec.ts
import { ChatService } from '../src/modules/chat/chat.service';

function makeRepos() {
  const savedMsgs: any[] = [];
  let seq = 0;
  return {
    conv: { findOne: async () => ({ id: 'c1', userId: 'u1', modelId: 'm1' }), save: async (c: any) => c, create: (o: any) => o, update: async () => {} } as any,
    msg: {
      create: (o: any) => ({ ...o }),
      save: async (o: any) => { const m = { id: `s-${++seq}`, ...o }; savedMsgs.push(m); return m; },
      find: async () => [...savedMsgs],
      findOne: async () => null,
      count: async () => 1,
    } as any,
    savedMsgs,
  };
}

function svcWith(opts: {
  model?: any;
  streamImpl: (t: any, m: any[]) => AsyncGenerator<any>;
  useThinking?: boolean;
}) {
  const { conv, msg, savedMsgs } = makeRepos();
  const svc: any = new ChatService(conv, msg,
    { getRawById: async () => null, getDefault: async () => opts.model ?? null, resolveProvider: async () => null } as any,
    { resolveTarget: () => ({ apiIdentifier: 'x', apiKey: 'k', baseUrl: 'http://x' }), stream: opts.streamImpl } as any,
    { getWebSearchEnabled: async () => true, getGlobalTokenLimit: async () => 0, getSystemPrompt: async () => 'sys' } as any,
  );
  return { svc, savedMsgs };
}

const thinkingModel = { id: 'm1', isActive: true, apiIdentifier: 'deepseek-reasoner', supportsThinking: true };
const plainModel = { id: 'm1', isActive: true, apiIdentifier: 'gpt-4o', supportsThinking: false };

it('streams thinking separately when toggle is on and the model supports it', async () => {
  const { svc, savedMsgs } = svcWith({
    model: thinkingModel,
    streamImpl: async function* () { yield { reasoning: 'r1' }; yield 'hi'; },
  });
  const chunks: any[] = [];
  for await (const c of svc.generate('u1', 'c1', 'solve?', undefined, { useThinking: true })) chunks.push(c);
  expect(chunks[0]).toEqual({ thinkingStatus: 'thinking' });
  expect(chunks).toContainEqual({ thinking: 'r1' });
  const done = chunks.find((c) => c.thinkingStatus === 'done');
  expect(typeof done?.thinkingDurationMs).toBe('number');
  expect(savedMsgs.find((m) => m.role === 'assistant')?.thinkingText ?? null).toBeNull(); // Task 4 adds persistence; must be null here
});

it('emits no thinking chunks when the toggle is off, even with reasoning deltas', async () => {
  const { svc } = svcWith({
    model: thinkingModel,
    streamImpl: async function* () { yield { reasoning: 'r1' }; yield 'hi'; },
  });
  const chunks: any[] = [];
  for await (const c of svc.generate('u1', 'c1', 'solve?')) chunks.push(c);
  expect(chunks.some((c) => c.thinking !== undefined || c.thinkingStatus !== undefined)).toBe(false);
});

it('emits no thinking chunks when the model flag is off, even with the toggle on', async () => {
  const { svc } = svcWith({
    model: plainModel,
    streamImpl: async function* () { yield { reasoning: 'r1' }; yield 'hi'; } as any,
    useThinking: true,
  });
  const chunks: any[] = [];
  for await (const c of svc.generate('u1', 'c1', 'solve?', undefined, { useThinking: true })) chunks.push(c);
  expect(chunks.some((c) => c.thinking !== undefined || c.thinkingStatus !== undefined)).toBe(false);
});

it('caps forwarded thinking text at the model budget', async () => {
  const { svc } = svcWith({
    model: { ...thinkingModel, thinkingBudgetTokens: 2 },
    streamImpl: async function* () { yield { reasoning: 'r1' }; yield { reasoning: 'r2-long' }; yield 'hi'; },
  });
  const chunks: any[] = [];
  for await (const c of svc.generate('u1', 'c1', 'solve?', undefined, { useThinking: true })) chunks.push(c);
  const thought = chunks.filter((c) => typeof c.thinking === 'string').map((c) => c.thinking).join('');
  expect(thought.length).toBeLessThanOrEqual(2);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest test/chat-thinking-flow.spec.ts --runInBand`
Expected: FAIL (no thinking chunks; unknown `useThinking` option ignored)

- [ ] **Step 3: Implement**

`ChatChunk`: append `thinking?: string; thinkingStatus?: 'thinking' | 'done'; thinkingDurationMs?: number; thinkingSync?: string;`

`generate()` signature: `options?: { useWebSearch?: boolean; useThinking?: boolean }`.

Main provider loop becomes type-narrowed (the ONLY loop change; word-pacing block stays verbatim):

```ts
const wantThinking = options?.useThinking === true && (model as any)?.supportsThinking === true;
let thinkingText = '';
let thinkingStartedAt = 0;
if (wantThinking) {
  thinkingStartedAt = Date.now();
  (session as any).thinkingStartedAt = thinkingStartedAt;
  (this.activeStream as any)?.resetThinkingTimer?.(id);
  yield { thinkingStatus: 'thinking' };
}
for await (const piece of this.forwarder.stream(target, messages, {
  signal: session?.abortController.signal,
})) {
  if (session?.abortController.signal.aborted) break;
  if (typeof piece !== 'string') {
    const r = (piece as any)?.reasoning;
    if (wantThinking && typeof r === 'string' && r) {
      const budget = (model as any)?.thinkingBudgetTokens;
      const room = typeof budget === 'number' && budget > 0 ? Math.max(0, budget - thinkingText.length) : r.length;
      const slice = r.slice(0, room);
      if (slice) {
        thinkingText += slice;
        (this.activeStream as any)?.appendReasoning?.(id, slice);
        yield { thinking: slice };
      }
    }
    continue;
  }
  const token: string = piece;
  // ... existing split/pace/appendToken/yield block unchanged
}
// after the loop, before the existing finally-save:
let thinkingDurationMs: number | null = null;
if (wantThinking && thinkingText) {
  thinkingDurationMs = Date.now() - (thinkingStartedAt || Date.now());
  (this.activeStream as any)?.completeThinking?.(id, thinkingDurationMs);
  yield { thinkingStatus: 'done', thinkingDurationMs };
}
```

(`model` here is the already-resolved model variable in `generate()`; when the echo/no-target path is taken, thinking never starts — echo stays exactly as today. `resetThinkingTimer`/`appendReasoning`/`completeThinking` land in this same task's ActiveStream change; the `as any` + `?.` keeps fakes safe.)

Assistant-save object: extend with `thinkingText: thinkingText || null, thinkingDurationMs: thinkingText ? thinkingDurationMs : null` (Task 4 adds the columns; until then these extra object keys are harmless on the fake `create()` which spreads — and the Task 3 test asserts they stay null/absent pre-Task-4 via `thinkingText ?? null`).

`dto.ts` (`SendMsgDto`): add

```ts
@IsOptional()
@IsBoolean({ message: 'گزینه تفکر عمیق باید boolean باشد' })
useThinking?: boolean;
```

(`IsBoolean` already imported in that file.) `chat.controller.ts send()`: extend options to `{ useWebSearch: d.useWebSearch === true, useThinking: d.useThinking === true }`.

`active-stream.service.ts`:
- `StreamEvent`: append `| { type: 'thinking'; content: string } | { type: 'thinking-done'; durationMs: number }`
- Session: append `reasoningText?: string; thinkingStartedAt?: number`
- Methods (placed next to `setSources`):

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

(`resetThinkingTimer` was added with the web-search work: re-arms the 35s thinking watchdog; thinking/search activity must not trip it.)

`chat.service.ts attachToActiveStream`: after the sources replay add

```ts
if (session.reasoningText) {
  yield { thinkingSync: session.reasoningText };
}
```

and in the subscriber callback add

```ts
} else if (event.type === 'thinking') {
  queue.push({ thinking: event.content });
} else if (event.type === 'thinking-done') {
  queue.push({ thinkingStatus: 'done', thinkingDurationMs: event.durationMs });
}
```

`chat.controller.ts` — in BOTH `send()` and `streamActive()` loops, next to the sources writers:

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

(`thinkingSync` reuses the `thinking` event with `replay: true` so the frontend parser needs no extra branch — it sets instead of appends. The `streamActive()` loop has no `clientDisconnected` prefix on some branches — mirror each loop's local style; the `send()` loop uses the `if (... && !clientDisconnected && !res.writableEnded)` shape shown above.)

- [ ] **Step 4: Verify**

Run: `cd backend && npx jest test/chat-thinking-flow.spec.ts test/chat-search-flow.spec.ts test/chat-real-stream.spec.ts test/ai-adapter.spec.ts --runInBand && npm run lint`
Expected: PASS + clean

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/chat/chat.service.ts backend/src/modules/chat/chat.controller.ts backend/src/modules/chat/active-stream.service.ts backend/src/modules/chat/dto.ts backend/test/chat-thinking-flow.spec.ts
git commit -m "feat(thinking): thinking stream, SSE events and session replay"
```

---

### Task 4: reasoning_content persistence (small)

**Files:**
- Modify: `backend/src/modules/chat/message.entity.ts`
- Create: `backend/src/migrations/1761300000003-AddMessageReasoning.ts`

**Interfaces:**
- Consumes: Task 3 save (`thinkingText`, `thinkingDurationMs` already set on the object there).
- Produces: `Message.reasoningContent?: string | null`, `Message.thinkingDurationMs?: number | null` (both returned by `history()` automatically — entity-wide `find`, same mechanism as `sources`).

- [ ] **Step 1: Columns + migration**

```ts
// message.entity.ts — append after sources:
/** Streamed reasoning text (null when thinking was off or yielded nothing). */
@Column({ type: 'text', nullable: true, default: null })
reasoningContent?: string | null;
/** Wall-clock ms spent in the thinking phase (null when unused). */
@Column({ type: 'int', nullable: true, default: null })
thinkingDurationMs?: number | null;
```

```ts
// backend/src/migrations/1761300000003-AddMessageReasoning.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

/** Stores streamed reasoning text + duration alongside the assistant message. */
export class AddMessageReasoning1761300000000 implements MigrationInterface {
  name = 'AddMessageReasoning1761300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "messages"
        ADD COLUMN IF NOT EXISTS "reasoningContent" text NULL DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS "thinkingDurationMs" integer NULL DEFAULT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "messages"
        DROP COLUMN IF EXISTS "reasoningContent",
        DROP COLUMN IF EXISTS "thinkingDurationMs"
    `);
  }
}
```

- [ ] **Step 2: Verify**

Run: `cd backend && npm run lint && npx jest test/chat-thinking-flow.spec.ts --runInBand`
Expected: clean + PASS (saved `reasoningContent` now persists through the real entity path; the fake-based assertions already pin the values)

- [ ] **Step 3: Commit**

```bash
git add backend/src/modules/chat/message.entity.ts backend/src/migrations/1761300000003-AddMessageReasoning.ts
git commit -m "feat(thinking): persist reasoningContent and duration on Message"
```

---

### Task 5: Attachment capability guards, backend (TDD)

**Files:**
- Modify: `backend/src/modules/chat/chat.service.ts` (guard block in `generate`)
- Test: extend `backend/test/chat-thinking-flow.spec.ts` with a second `describe` block (same fakes)

**Interfaces:**
- Consumes: `model.supportsVision`, `model.supportsDocument`; `imageAttachments` + text-extracted attachments already resolved in `generate()` (fileRepo block).
- Produces: `BadRequestException` with Persian message BEFORE any provider call when attachments exceed the model's capabilities.

- [ ] **Step 1: Write the failing tests** (append to `chat-thinking-flow.spec.ts`)

```ts
describe('attachment capability guards', () => {
  function svcWithFiles(model: any, files: any[]) {
    const { conv, msg } = makeRepos();
    const fileRepo: any = {
      update: async () => {},
      find: async () => files,
    };
    const svc: any = new ChatService(conv, msg,
      { getRawById: async () => null, getDefault: async () => model, resolveProvider: async () => null } as any,
      { resolveTarget: () => ({ apiIdentifier: 'x', apiKey: 'k', baseUrl: 'http://x' }), stream: async function* () { yield 'hi'; } } as any,
      { getWebSearchEnabled: async () => true, getGlobalTokenLimit: async () => 0, getSystemPrompt: async () => 'sys' } as any,
      undefined, undefined, fileRepo,
    );
    return svc;
  }

  it('rejects images for a model without vision before calling the provider', async () => {
    const svc = svcWithFiles(
      { id: 'm1', isActive: true, supportsVision: false, supportsDocument: true },
      [{ id: 'f1', fileType: 'image', originalName: 'a.png', metadata: {} }],
    );
    let chunks: any[] = [];
    await expect(
      (async () => { for await (const c of svc.generate('u1', 'c1', 'look', ['f1'])) chunks.push(c); })(),
    ).rejects.toThrow('این مدل از ارسال تصویر پشتیبانی نمی‌کند');
    expect(chunks).toEqual([]);
  });

  it('rejects documents for a model without document support', async () => {
    const svc = svcWithFiles(
      { id: 'm1', isActive: true, supportsVision: true, supportsDocument: false },
      [{ id: 'f1', fileType: 'pdf', originalName: 'a.pdf', extractedText: 'hello' }],
    );
    await expect(
      (async () => { for await (const _ of svc.generate('u1', 'c1', 'read', ['f1'])) { /* drain */ } })(),
    ).rejects.toThrow('این مدل از ارسال اسناد پشتیبانی نمی‌کند');
  });

  it('passes vision+document models untouched', async () => {
    const svc = svcWithFiles(
      { id: 'm1', isActive: true, supportsVision: true, supportsDocument: true },
      [{ id: 'f1', fileType: 'image', originalName: 'a.png', metadata: {} }],
    );
    const chunks: any[] = [];
    for await (const c of svc.generate('u1', 'c1', 'look', ['f1'])) chunks.push(c);
    expect(chunks.some((c) => c.token)).toBe(true);
  });
});
```

(`makeRepos` is the same helper from the top of that spec file — reuse it, do not redefine. Legacy models without the flags: `undefined !== false` passes the guard, preserving current behavior.)

- [ ] **Step 2: Run to verify they fail**

Run: `cd backend && npx jest test/chat-thinking-flow.spec.ts --runInBand -t "capability guards"`
Expected: FAIL (no guard; images flow to the provider)

- [ ] **Step 3: Implement** — in `generate()`, right after the attachments loop that fills `imageAttachments`/appends `extractedText` (and before `resolveTarget`):

```ts
const hasImages = imageAttachments.length > 0;
const hasDocs = attachments.some((a) => a.fileType !== 'image');
if (hasImages && (model as any)?.supportsVision === false) {
  throw new BadRequestException('این مدل از ارسال تصویر پشتیبانی نمی‌کند');
}
if (hasDocs && (model as any)?.supportsDocument === false) {
  throw new BadRequestException('این مدل از ارسال اسناد پشتیبانی نمی‌کند');
}
```

(`attachments` is the array fetched from `fileRepo` in that block; strict `=== false` keeps legacy/undefined flags permissive. `BadRequestException` is already imported in that file.)

- [ ] **Step 4: Verify**

Run: `cd backend && npx jest test/chat-thinking-flow.spec.ts test/chat-real-stream.spec.ts --runInBand && npm run lint`
Expected: PASS + clean

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/chat/chat.service.ts backend/test/chat-thinking-flow.spec.ts
git commit -m "feat(thinking): block image/document attachments on incapable models"
```

---

### Task 6: ui/collapsible wrapper (TDD)

**Files:**
- Create: `frontend/src/components/ui/collapsible/Collapsible.vue`
- Create: `frontend/src/components/ui/collapsible/CollapsibleTrigger.vue`
- Create: `frontend/src/components/ui/collapsible/CollapsibleContent.vue`
- Create: `frontend/src/components/ui/collapsible/index.ts`
- Test: `frontend/tests/Collapsible.spec.ts`

**Interfaces:**
- Consumes: `CollapsibleRoot`, `CollapsibleTrigger`, `CollapsibleContent` from `reka-ui` (already installed; `ui/button/Button.vue` imports from `"reka-ui"` the same way).
- Produces: `<Collapsible v-model:open>`, `<CollapsibleTrigger>`, `<CollapsibleContent>` with props/events forwarded, no styling of their own (consumers style via Tailwind).

- [ ] **Step 1: Write the failing test**

```ts
// frontend/tests/Collapsible.spec.ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '../src/components/ui/collapsible'

describe('ui/collapsible', () => {
  it('toggles content on trigger click (uncontrolled)', async () => {
    const w = mount({
      components: { Collapsible, CollapsibleTrigger, CollapsibleContent },
      template: `
        <Collapsible>
          <CollapsibleTrigger data-testid="t">head</CollapsibleTrigger>
          <CollapsibleContent data-testid="c">body</CollapsibleContent>
        </Collapsible>`,
    })
    expect(w.find('[data-testid="c"]').isVisible()).toBe(false)
    await w.find('[data-testid="t"]').trigger('click')
    expect(w.find('[data-testid="c"]').isVisible()).toBe(true)
  })

  it('follows v-model:open', async () => {
    const w = mount({
      components: { Collapsible, CollapsibleTrigger, CollapsibleContent },
      data: () => ({ open: false }),
      template: `
        <Collapsible v-model:open="open">
          <CollapsibleTrigger data-testid="t">head</CollapsibleTrigger>
          <CollapsibleContent data-testid="c">body</CollapsibleContent>
        </Collapsible>`,
    })
    expect(w.find('[data-testid="c"]').isVisible()).toBe(false)
    await w.setData({ open: true })
    expect(w.find('[data-testid="c"]').isVisible()).toBe(true)
  })
})
```

(Caveat, learned on this project: `isVisible()` proved unreliable in this repo's test env for `v-show` — reka Collapsible keeps closed content mounted-but-hidden the same way. If either assertion flakes, assert on the `data-state` attribute reka sets (`open`/`closed`) instead of `isVisible()`. The behavior pinned is identical.)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run tests/Collapsible.spec.ts`
Expected: FAIL (no such modules)

- [ ] **Step 3: Implement** (thin wrappers, same export shape as `ui/button/index.ts`)

```vue
<!-- frontend/src/components/ui/collapsible/Collapsible.vue -->
<script setup lang="ts">
import { CollapsibleRoot, type CollapsibleRootProps } from 'reka-ui'

const props = defineProps<CollapsibleRootProps>()
const emit = defineEmits<{ 'update:open': [value: boolean] }>()
</script>

<template>
  <CollapsibleRoot v-bind="props" @update:open="emit('update:open', $event)">
    <slot />
  </CollapsibleRoot>
</template>
```

```vue
<!-- frontend/src/components/ui/collapsible/CollapsibleTrigger.vue -->
<script setup lang="ts">
import { CollapsibleTrigger } from 'reka-ui'
</script>

<template>
  <CollapsibleTrigger>
    <slot />
  </CollapsibleTrigger>
</template>
```

```vue
<!-- frontend/src/components/ui/collapsible/CollapsibleContent.vue -->
<script setup lang="ts">
import { CollapsibleContent } from 'reka-ui'
</script>

<template>
  <CollapsibleContent>
    <slot />
  </CollapsibleContent>
</template>
```

```ts
// frontend/src/components/ui/collapsible/index.ts
export { default as Collapsible } from './Collapsible.vue'
export { default as CollapsibleTrigger } from './CollapsibleTrigger.vue'
export { default as CollapsibleContent } from './CollapsibleContent.vue'
```

- [ ] **Step 4: Verify**

Run: `cd frontend && npx vitest run tests/Collapsible.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ui/collapsible frontend/tests/Collapsible.spec.ts
git commit -m "feat(thinking): shadcn-style Collapsible wrapper over reka-ui"
```

---

### Task 7: capabilities registry + CapabilityBadge (TDD)

**Files:**
- Create: `frontend/src/utils/capabilities.ts`
- Create: `frontend/src/components/chat/CapabilityBadge.vue`
- Modify: `frontend/src/types/index.ts` (`Model` += four optional fields)
- Test: `frontend/tests/capabilities.spec.ts`, `frontend/tests/CapabilityBadge.spec.ts`

**Interfaces:**
- Consumes: `Model` type.
- Produces: `ModelCapability = 'thinking' | 'vision' | 'document'`; `CAPABILITIES` registry (label + badge classes per capability); `modelSupports(model, cap)` with legacy-safe defaults (thinking strict-true; vision/document `!== false`); `<CapabilityBadge :capability>`.

- [ ] **Step 1: Write the failing tests**

```ts
// frontend/tests/capabilities.spec.ts
import { describe, it, expect } from 'vitest'
import { modelSupports, CAPABILITIES } from '../src/utils/capabilities'

describe('modelSupports', () => {
  it('thinks only on explicit true', () => {
    expect(modelSupports({ supportsThinking: true } as any, 'thinking')).toBe(true)
    expect(modelSupports({ supportsThinking: false } as any, 'thinking')).toBe(false)
    expect(modelSupports({} as any, 'thinking')).toBe(false)
    expect(modelSupports(null, 'thinking')).toBe(false)
  })

  it('allows vision/document unless explicitly false (legacy-safe)', () => {
    expect(modelSupports({} as any, 'vision')).toBe(true)
    expect(modelSupports({} as any, 'document')).toBe(true)
    expect(modelSupports({ supportsVision: false } as any, 'vision')).toBe(false)
    expect(modelSupports({ supportsDocument: false } as any, 'document')).toBe(false)
    expect(modelSupports(null, 'vision')).toBe(false)
  })

  it('registry carries a label and classes per capability', () => {
    for (const cap of ['thinking', 'vision', 'document'] as const) {
      expect(CAPABILITIES[cap].label.length).toBeGreaterThan(0)
      expect(CAPABILITIES[cap].badgeClass).toContain('rounded-md')
    }
    expect(CAPABILITIES.thinking.badgeClass).not.toBe(CAPABILITIES.vision.badgeClass)
    expect(CAPABILITIES.vision.badgeClass).not.toBe(CAPABILITIES.document.badgeClass)
  })
})
```

```ts
// frontend/tests/CapabilityBadge.spec.ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import CapabilityBadge from '../src/components/chat/CapabilityBadge.vue'

describe('CapabilityBadge', () => {
  it('renders one distinct badge per capability', () => {
    const thinking = mount(CapabilityBadge, { props: { capability: 'thinking' } })
    const vision = mount(CapabilityBadge, { props: { capability: 'vision' } })
    const document = mount(CapabilityBadge, { props: { capability: 'document' } })
    expect(thinking.text()).toBe('تفکر')
    expect(vision.text()).toBe('بینایی')
    expect(document.text()).toBe('اسناد')
    const cls = [thinking, vision, document].map((w) => w.find('[data-testid="capability-badge"]').attributes('class'))
    expect(new Set(cls).size).toBe(3)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run tests/capabilities.spec.ts tests/CapabilityBadge.spec.ts`
Expected: FAIL (no such modules)

- [ ] **Step 3: Implement**

```ts
// frontend/src/utils/capabilities.ts
import type { Model } from '../types'

export type ModelCapability = 'thinking' | 'vision' | 'document'

export interface CapabilityMeta {
  key: ModelCapability
  label: string
  badgeClass: string
}

export const CAPABILITIES: Record<ModelCapability, CapabilityMeta> = {
  thinking: {
    key: 'thinking',
    label: 'تفکر',
    badgeClass:
      'bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/30',
  },
  vision: {
    key: 'vision',
    label: 'بینایی',
    badgeClass:
      'bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/30',
  },
  document: {
    key: 'document',
    label: 'اسناد',
    badgeClass:
      'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30',
  },
}

type CapabilityFlags = Pick<Model, 'supportsThinking' | 'supportsVision' | 'supportsDocument'>

export function modelSupports(
  model: CapabilityFlags | null | undefined,
  cap: ModelCapability,
): boolean {
  if (!model) return false
  if (cap === 'thinking') return model.supportsThinking === true
  if (cap === 'vision') return model.supportsVision !== false
  return model.supportsDocument !== false
}

export function supportedCapabilities(
  model: CapabilityFlags | null | undefined,
): ModelCapability[] {
  return (Object.keys(CAPABILITIES) as ModelCapability[]).filter((c) => modelSupports(model, c))
}
```

```vue
<!-- frontend/src/components/chat/CapabilityBadge.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import { CAPABILITIES, type ModelCapability } from '../../utils/capabilities'

const props = defineProps<{
  capability: ModelCapability
}>()

const meta = computed(() => CAPABILITIES[props.capability])
</script>

<template>
  <span
    data-testid="capability-badge"
    class="rounded-md px-1.5 py-0.5 text-[10px] font-semibold"
    :class="meta.badgeClass"
  >{{ meta.label }}</span>
</template>
```

`types/index.ts` (`Model` interface — extend with four optional fields so old payloads keep working):

```ts
supportsThinking?: boolean
supportsVision?: boolean
supportsDocument?: boolean
thinkingBudgetTokens?: number | null
```

- [ ] **Step 4: Verify**

Run: `cd frontend && npx vitest run tests/capabilities.spec.ts tests/CapabilityBadge.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/utils/capabilities.ts frontend/src/components/chat/CapabilityBadge.vue frontend/src/types/index.ts frontend/tests/capabilities.spec.ts frontend/tests/CapabilityBadge.spec.ts
git commit -m "feat(thinking): capability registry and badge component"
```

---

### Task 8: ThinkingBlock.vue (TDD)

**Files:**
- Create: `frontend/src/components/chat/ThinkingBlock.vue`
- Test: `frontend/tests/ThinkingBlock.spec.ts`

**Interfaces:**
- Consumes: `Collapsible*` from Task 6 (use the REAL components in tests to prove the integration).
- Produces: `<ThinkingBlock :thinking :streaming :durationMs>` with root `data-testid="thinking-block"`.

- [ ] **Step 1: Write the failing test**

```ts
// frontend/tests/ThinkingBlock.spec.ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ThinkingBlock from '../src/components/chat/ThinkingBlock.vue'

describe('ThinkingBlock', () => {
  it('streams dim live text while thinking, no collapsible row yet', () => {
    const w = mount(ThinkingBlock, {
      props: { thinking: 'بخشی از استدلال', streaming: true, durationMs: null },
    })
    expect(w.find('[data-testid="thinking-live"]').exists()).toBe(true)
    expect(w.find('[data-testid="thinking-live"]').text()).toContain('بخشی از استدلال')
    expect(w.find('[data-testid="thinking-done-row"]').exists()).toBe(false)
  })

  it('auto-collapses to a row with duration once the answer starts', async () => {
    const w = mount(ThinkingBlock, {
      props: { thinking: 'full reasoning', streaming: false, durationMs: 4200 },
    })
    expect(w.find('[data-testid="thinking-live"]').exists()).toBe(false)
    const row = w.find('[data-testid="thinking-done-row"]')
    expect(row.exists()).toBe(true)
    expect(row.text()).toContain('۴.۲ ثانیه')
    await row.trigger('click')
    expect(w.find('[data-testid="thinking-body"]').text()).toContain('full reasoning')
  })
})
```

(Duration format `۴.۲ ثانیه` for 4200ms: seconds with one decimal in Persian digits; under 1000ms → «کمتر از یک ثانیه». Implemented as a local `formatThinkingDuration` function in the component — YAGNI says no shared util until a second consumer appears.)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run tests/ThinkingBlock.spec.ts`
Expected: FAIL (no such component)

- [ ] **Step 3: Implement** (Tailwind utilities only, no new CSS; RTL inherits `dir` from the chat container)

```vue
<!-- frontend/src/components/chat/ThinkingBlock.vue -->
<script setup lang="ts">
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '../ui/collapsible'
import { toPersianDigits } from '../../utils/format-fa'

const props = defineProps<{
  thinking: string
  streaming: boolean
  durationMs?: number | null
}>()

function formatThinkingDuration(ms: number): string {
  if (ms < 1000) return 'کمتر از یک ثانیه'
  const secs = (Math.round(ms / 100) / 10).toString()
  return `${toPersianDigits(secs)} ثانیه`
}
</script>
```

WAIT — `toPersianDigits` in `utils/format-fa`: does that file exist? NOT verified. Do NOT reference unverified helpers. Inline the digit conversion instead (3 lines, same pattern MessageBubble already uses inline):

```ts
function toPersianDigits(val: number | string): string {
  return String(val).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)])
}
```

Template:

```vue
<template>
  <div data-testid="thinking-block">
    <div
      v-if="streaming"
      data-testid="thinking-live"
      class="whitespace-pre-wrap text-[13px] leading-6 text-muted-foreground/80"
    >{{ thinking }}</div>
    <Collapsible v-else>
      <CollapsibleTrigger data-testid="thinking-done-row" class="flex w-full items-center gap-2 text-[13px] text-muted-foreground">
        <span class="font-medium">روند تفکر</span>
        <span v-if="durationMs != null" class="text-xs">{{ formatThinkingDuration(durationMs) }}</span>
        <span class="ms-auto text-xs">نمایش / بستن</span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div data-testid="thinking-body" class="mt-2 whitespace-pre-wrap text-[13px] leading-6 text-foreground/90">{{ thinking }}</div>
      </CollapsibleContent>
    </Collapsible>
  </div>
</template>
```

(The trigger label «نمایش / بستن» is static text — reka toggles visibility; no local open-state needed since Collapsible is uncontrolled here. If the content-via-click test needs an open state assertion, assert on the `data-state` attribute reka sets on the trigger instead of visibility — same caveat as Task 6.)

- [ ] **Step 4: Verify**

Run: `cd frontend && npx vitest run tests/ThinkingBlock.spec.ts tests/Collapsible.spec.ts`
Expected: PASS (adjust visibility assertions to `data-state` if the env flakes, exactly as noted in Task 6)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/chat/ThinkingBlock.vue frontend/tests/ThinkingBlock.spec.ts
git commit -m "feat(thinking): ThinkingBlock with live dim text and auto-collapsed row"
```

---

### Task 9: MessageList + MessageBubble wiring (render gating)

**Files:**
- Modify: `frontend/src/components/chat/MessageList.vue` (streaming row)
- Modify: `frontend/src/components/chat/MessageBubble.vue` (stored message)
- Modify: `frontend/src/types/index.ts` (`Message` += `reasoningContent?`, `thinkingDurationMs?`)
- Test: `frontend/tests/MessageBubble.thinking.spec.ts`

**Interfaces:**
- Consumes: store `streamingThinking/isThinkingActive/thinkingDurationMs` (added in Task 10 — implement the store fields THERE; this task only reads them via existing computed patterns).
- Produces: live box in the streaming row; stored box under saved messages. Gating rule (single enforcement point!): the backend only ever saves/attaches reasoning when the model flag was on, so the frontend presence-gates on text — no model lookup needed in these components.

- [ ] **Step 1: Write the failing test**

```ts
// frontend/tests/MessageBubble.thinking.spec.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import MessageBubble from '../src/components/chat/MessageBubble.vue'

function mountBubble(message: any) {
  return mount(MessageBubble, {
    props: {
      message: {
        id: 'm1', conversationId: 'c1', role: 'assistant', content: 'final',
        createdAt: new Date().toISOString(), ...message,
      },
    },
    global: { stubs: { MarkdownContent: true, FilePreviewCard: true, ThinkingBlock: true } },
  })
}

describe('stored thinking box', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  it('renders ThinkingBlock with saved reasoning when present', () => {
    const w = mountBubble({ reasoningContent: 'r-text', thinkingDurationMs: 4200 })
    const box = w.findComponent({ name: 'ThinkingBlock' })
    expect(box.exists()).toBe(true)
    expect(box.props('thinking')).toBe('r-text')
    expect(box.props('streaming')).toBe(false)
    expect(box.props('durationMs')).toBe(4200)
  })

  it('renders nothing when reasoning is absent', () => {
    const w = mountBubble({})
    expect(w.findComponent({ name: 'ThinkingBlock' }).exists()).toBe(false)
  })
})
```

(`findComponent({ name })` needs the stub to keep the name — `stubs: { ThinkingBlock: true }` auto-stub preserves the name and records props. If the repo's Vue/test-utils version resolves names differently, fall back to a `data-testid` passthrough on the stub via a custom stub component — same assertion target.)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run tests/MessageBubble.thinking.spec.ts`
Expected: FAIL (no ThinkingBlock wired)

- [ ] **Step 3: Implement**

`types/index.ts` (`Message`): append `reasoningContent?: string | null` and `thinkingDurationMs?: number | null`.

`MessageBubble.vue`: import ThinkingBlock; after `<SourcesBlock ... />` add

```vue
<ThinkingBlock
  v-if="!isUser && message.reasoningContent"
  :thinking="message.reasoningContent"
  :streaming="false"
  :durationMs="message.thinkingDurationMs ?? null"
/>
```

`MessageList.vue` streaming row: import ThinkingBlock; inside the streaming bubble container, BEFORE the text block add

```vue
<ThinkingBlock
  v-if="thinkingActive || streamingThinkingText"
  :thinking="streamingThinkingText"
  :streaming="thinkingActive"
  :durationMs="thinkingDurationMsValue"
/>
```

backed by store computeds in the same style as `currentStreamingText` (line ~99: `getState(currentConversationId.value)?.x ?? fallback`):

```ts
const thinkingActive = computed(() => getState(currentConversationId.value)?.isThinkingActive ?? false)
const streamingThinkingText = computed(() => getState(currentConversationId.value)?.streamingThinking ?? '')
const thinkingDurationMsValue = computed(() => getState(currentConversationId.value)?.thinkingDurationMs ?? null)
```

(The `isThinkingActive/streamingThinking/thinkingDurationMs` state fields + their callbacks are implemented in Task 10; the `ThinkingIndicator` "thinking" (waiting) state stays untouched for non-thinking flows.)

- [ ] **Step 4: Verify**

Run: `cd frontend && npx vitest run tests/MessageBubble.thinking.spec.ts tests/MessageList.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/chat/MessageList.vue frontend/src/components/chat/MessageBubble.vue frontend/src/types/index.ts frontend/tests/MessageBubble.thinking.spec.ts
git commit -m "feat(thinking): live and stored ThinkingBlock wiring with presence gating"
```

---

### Task 10: Store, composer (toggle, picker filtering, attach guards)

**Files:**
- Modify: `frontend/src/stores/chat.ts` (flags, stream state, callbacks, send, switch rollback)
- Modify: `frontend/src/services/chat.service.ts` (`sendMessageStream` opts + thinking callbacks)
- Modify: `frontend/src/components/chat/ChatComposer.vue` (+ menu thinking item, picker rows, attach guards)
- Test: `frontend/tests/ChatComposer.thinking.spec.ts`

**Interfaces:**
- Consumes: `modelSupports` + `supportedCapabilities` (Task 7), `WebSource`-style flag plumbing (existing web-search pattern).
- Produces: `convFlags: Record<string, { web: boolean; thinking: boolean }>`; stream state `streamingThinking/isThinkingActive/thinkingDurationMs`; `sendMessage(content, files?, opts?: { useWebSearch?: boolean; useThinking?: boolean })`.

- [ ] **Step 1: Write the failing tests**

```ts
// frontend/tests/ChatComposer.thinking.spec.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ChatComposer from '../src/components/chat/ChatComposer.vue'
import { useChatStore } from '../src/stores/chat'
import { useModelsStore } from '../src/stores/models'

function mountComposer() {
  return mount(ChatComposer, {
    global: { stubs: { FilePreviewCard: true, BaseToggle: true } },
  })
}

const THINK_MODEL: any = {
  id: 'r1', name: 'R', provider: 'p', apiIdentifier: 'r1',
  isActive: true, isDefault: false, supportsThinking: true,
  supportsVision: true, supportsDocument: true,
  createdAt: new Date().toISOString(),
}
const PLAIN_MODEL: any = { ...THINK_MODEL, id: 'p1', name: 'P', supportsThinking: false }

describe('thinking toggle', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('flips the per-conversation thinking flag on a thinking model', async () => {
    const modelsStore = useModelsStore()
    modelsStore.models = [THINK_MODEL, PLAIN_MODEL]
    modelsStore.selectedModelId = 'r1'
    const chatStore = useChatStore()
    chatStore.currentConversationId = 'c1'
    const wrapper = mountComposer()
    await wrapper.find('.attachment-btn').trigger('click')
    const btn = wrapper.find('[data-testid="toggle-thinking"]')
    expect(btn.exists()).toBe(true)
    expect(btn.attributes('disabled')).toBeUndefined()
    expect(chatStore.getConvFlag('c1').thinking ?? false).toBe(false)
    await btn.trigger('click')
    expect(chatStore.getConvFlag('c1').thinking).toBe(true)
  })

  it('disables the toggle with a reason on a plain model', async () => {
    const modelsStore = useModelsStore()
    modelsStore.models = [THINK_MODEL, PLAIN_MODEL]
    modelsStore.selectedModelId = 'p1'
    mountComposer()
    const { useChatStore: useCS } = await import('../src/stores/chat')
    useCS().currentConversationId = 'c1'
    const wrapper2 = mountComposer()
    const btn = wrapper2.find('[data-testid="toggle-thinking"]')
    expect(btn.attributes('disabled')).toBeDefined()
  })

  it('disables picker rows without thinking while the toggle is on', async () => {
    const modelsStore = useModelsStore()
    modelsStore.models = [THINK_MODEL, PLAIN_MODEL]
    modelsStore.selectedModelId = 'r1'
    const chatStore = useChatStore()
    chatStore.currentConversationId = 'c1'
    chatStore.setConvFlag('c1', { thinking: true })
    const wrapper = mountComposer()
    await wrapper.find('.model-badge-btn').trigger('click')
    const rows = wrapper.findAll('.model-option-btn')
    expect(rows).toHaveLength(2)
    const plainRow = rows.find((r) => r.text().includes('P'))
    expect(plainRow?.attributes('disabled')).toBeDefined()
  })
})
```

(Selectors `.attachment-btn`, `.model-badge-btn`, `.model-option-btn`, `.attachment-dropdown` are the existing classes verified in the current `ChatComposer.vue`; `getConvFlag`/`setConvFlag`/`convFlags` exist from the web-search work — this task only widens the shape with `thinking`. If the second test's double-mount proves flaky in this env, collapse it into the first mount by switching `selectedModelId` mid-test instead.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run tests/ChatComposer.thinking.spec.ts`
Expected: FAIL (no `toggle-thinking`, no row disabling)

- [ ] **Step 3: Implement**

Store (`stores/chat.ts`):
- `convFlags` shape → `{ web: boolean; thinking: boolean }`; `getConvFlag` default `{ web: false, thinking: false }`; `setConvFlag` patch type extended. (`__new__` → real-id migration from the web-search work moves the whole object — no change needed.)
- `ConvStreamState` + `makeDefaultState()` gain `streamingThinking: string` (`''`), `isThinkingActive: boolean` (`false`), `thinkingDurationMs: number | null` (`null`).
- `executeMessageStream(..., opts?: { useWebSearch?: boolean; useThinking?: boolean })`: resolve `useThinking = opts?.useThinking ?? getConvFlag(convId).thinking` (same line/pattern as the existing `useWebSearch` resolution) and pass `{ useWebSearch, useThinking }` to the service.
- Thinking callbacks (mirroring the search callbacks one-to-one):
  - `onThinking(t, replay)` → `replay ? (s.streamingThinking = t) : (s.streamingThinking += t)`; `s.isThinkingActive = true`; `resetWatchdog(convId, 25000)`.
  - `onThinkingStatus('done', ms)` → `s.isThinkingActive = false; s.thinkingDurationMs = ms`.
- `finishStream`: reset the three thinking fields next to the existing sources reset (do NOT copy thinking into the pushed message — history reload provides it, same rule as the search work).
- `sendMessage(content, files?, opts?: { useWebSearch?: boolean; useThinking?: boolean })`: forward `opts` to `executeMessageStream` (retry/queue/files paths inherit stored flags via the `?? getConvFlag` fallback — same as web).
- `switchConversationModel`: snapshot `const prevId = modelsStore.selectedModelId` before `selectModel`; in the existing `catch` (which already warns + rethrows on backend failure), restore with `modelsStore.selectModel(prevId)` first — full optimistic rollback for the global selection.

Service (`services/chat.service.ts`): `sendMessageStream` gains trailing optional `onThinking?, onThinkingStatus?, opts?: { useWebSearch?: boolean; useThinking?: boolean }` (appended at the end like the search params — existing positional callers unaffected); POST payload gains `if (opts?.useThinking) payload.useThinking = true`; both direct and `subscribeActiveStream` reconnect paths forward the two callbacks (same two call sites the search work touched).

Composer (`ChatComposer.vue`):
- Script: `import { modelSupports, supportedCapabilities } from '../../utils/capabilities'` and `CapabilityBadge`; `const thinkingOn = computed(() => chatStore.getConvFlag(activeConvId.value).thinking ?? false)` (`activeConvId` exists from the web-search work); `const thinkingSupported = computed(() => modelSupports(modelsStore.selectedModel, 'thinking'))`; `function toggleThinking() { if (!thinkingSupported.value) return; chatStore.setConvFlag(activeConvId.value, { thinking: !thinkingOn.value }); attachmentMenuOpen.value = false }`.
- + menu (after the web-search item, same `.attachment-menu-item` class + `BaseToggle size="sm"` pattern):
```vue
<button
  type="button"
  class="attachment-menu-item"
  data-testid="toggle-thinking"
  :class="thinkingOn ? 'bg-primary/10 text-primary' : ''"
  :disabled="!thinkingSupported"
  :title="thinkingSupported ? 'تفکر عمیق' : 'این مدل از نمایش تفکر پشتیبانی نمی‌کند'"
  @click="toggleThinking"
>
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M12 2a7 7 0 0 1 7 7c0 2.4-1.2 4.2-2.6 5.6-.9.9-1.4 2-1.4 3.4H9c0-1.4-.5-2.5-1.4-3.4C6.2 13.2 5 11.4 5 9a7 7 0 0 1 7-7z"/>
    <line x1="9" y1="21" x2="15" y2="21"/>
  </svg>
  <span>تفکر عمیق</span>
  <BaseToggle size="sm" :modelValue="thinkingOn" :disabled="!thinkingSupported" @click.stop @update:modelValue="toggleThinking" />
</button>
```
- Picker rows (`v-for="model in selectableModels"`, `.model-option-btn`): add `:disabled="thinkingOn && !modelSupports(model, 'thinking')"` + `:title` reason + `<CapabilityBadge v-for="cap in supportedCapabilities(model)" :key="cap" :capability="cap" />` next to the name (inside the existing name row structure; import CapabilityBadge).
- Attach guards (mirror the existing `isGenerating` guards in `pickImages`/`pickDocuments`/`toggleAttachmentMenu`): compute `const activeModel = computed(() => modelsStore.selectedModel)` then
```ts
if (!modelSupports(activeModel.value, 'vision')) {
  uiStore.showToast('این مدل از ارسال تصویر پشتیبانی نمی‌کند', 'warning')
  return
}
```
in `pickImages` (and `'document'` / 'این مدل از ارسال اسناد پشتیبانی نمی‌کند' in `pickDocuments`), plus `:disabled` + `:title` on the two menu buttons with the same conditions.
- Send call: `chatStore.sendMessage(text, files, { useWebSearch: ..., useThinking: thinkingOn.value })` (extend the existing call that already passes `useWebSearch`).

- [ ] **Step 4: Verify**

Run: `cd frontend && npx vitest run tests/ChatComposer.thinking.spec.ts tests/ChatComposer.flags.spec.ts && npx vue-tsc -b`
Expected: PASS + error set identical to develop HEAD (prove with the normalized diff)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/stores/chat.ts frontend/src/services/chat.service.ts frontend/src/components/chat/ChatComposer.vue frontend/tests/ChatComposer.thinking.spec.ts
git commit -m "feat(thinking): toggle, picker filtering, attach guards with capability gating"
```

---

### Task 11: Admin model form (modes + budget)

**Files:**
- Modify: `frontend/src/views/AdminPanelView.vue` (form state, open/save wiring, modal template)
- Modify: `frontend/src/services/models.service.ts` (Create/Update request types are in `types/index.ts` — extend `CreateModelRequest`/`UpdateModelRequest` with the four optional fields)

**Interfaces:**
- Consumes: backend DTO fields from Task 2 (same names).
- Produces: modes selector + budget input persisted through the existing `saveModel` flow.

- [ ] **Step 1: State + wiring** (no new test file — covered by backend specs + typecheck + manual checklist below; mounting the 4000-line admin view in vitest is deliberately out of scope)

`modelForm` (line ~251: `{ name, provider, providerId, apiIdentifier, isActive }`): append `supportsThinking: false, supportsVision: true, supportsDocument: true, thinkingBudgetTokens: null as number | null`.

`openModelEditor` (fills the form in both branches — add/edit): set the four fields from `model` with legacy fallbacks (`?? false` / `?? true` / `?? true` / `?? null`); the add-branch keeps the defaults above.

`saveModel` payload: append

```ts
supportsThinking: !!modelForm.value.supportsThinking,
supportsVision: modelForm.value.supportsVision !== false,
supportsDocument: modelForm.value.supportsDocument !== false,
thinkingBudgetTokens:
  modelForm.value.thinkingBudgetTokens === null ||
  modelForm.value.thinkingBudgetTokens === undefined ||
  (modelForm.value.thinkingBudgetTokens as any) === ''
    ? null
    : Number(modelForm.value.thinkingBudgetTokens) || null,
```

(`types/index.ts`: extend `CreateModelRequest` and `UpdateModelRequest` with the four optional fields.)

Modal template (model modal, after the `isActive` toggle-label row at ~2265): same existing classes, no new CSS:

```vue
<label class="toggle-label col-span-full">
  <span class="field-label">قابلیت‌های مدل</span>
</label>
<label class="toggle-label">
  <BaseToggle v-model="modelForm.supportsThinking" :disabled="isSaving" />
  <span>تفکر عمیق (Thinking)</span>
</label>
<label class="toggle-label">
  <BaseToggle v-model="modelForm.supportsVision" :disabled="isSaving" />
  <span>بینایی (Vision)</span>
</label>
<label class="toggle-label">
  <BaseToggle v-model="modelForm.supportsDocument" :disabled="isSaving" />
  <span>اسناد (Document)</span>
</label>
<label>
  <span class="field-label">بودجه thinking (توکن، خالی = بدون سقف)</span>
  <input
    v-model.number="modelForm.thinkingBudgetTokens"
    type="number"
    min="1"
    placeholder="مثلاً 2000"
    :disabled="isSaving"
  />
</label>
```

- [ ] **Step 2: Verify**

Run: `cd frontend && npx vue-tsc -b`
Expected: error set identical to develop HEAD (prove with the normalized diff)

Manual checklist for this task (executor runs through it in the review app): create model with thinking on + budget 2000 → row persists flags after refresh; uncheck vision → chat attach-images disabled with reason; set budget empty → null saved (network tab PUT body).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/views/AdminPanelView.vue frontend/src/types/index.ts frontend/src/services/models.service.ts
git commit -m "feat(thinking): admin model capability modes and thinking budget"
```

(`services/models.service.ts` only changes if its request types live there — they live in `types/index.ts`; if the service re-declares them, extend both. The executor checks while editing.)

---

### Task 12: Close-out — wiki, gates, manual pass

**Files:**
- Modify: `docs/wiki/features.md`, `docs/wiki/architecture.md`, `docs/wiki/api-reference.md`

- [ ] **Step 1: Docs**

`features.md`: append a Task entry — adapter facade, capability flags + budget, thinking stream + persistence, ThinkingBlock/Collapsible, picker filtering/badges, attach guards, admin modes; verification summary.

`architecture.md` (module map + streaming sections): add `ai/adapters/` row; document the capability matrix (flag → UI gate → backend enforcement) and the "display-only reasoning" principle.

`api-reference.md`: `SendMsgDto.useThinking`; SSE `thinking` / `thinking-status`; `Message.reasoningContent/thinkingDurationMs`; `AiModel` capability fields on admin CRUD.

- [ ] **Step 2: Full gates**

Run: `cd backend && npm run lint && npx jest test --runInBand`
Expected: clean + green

Run: `cd frontend && npx vitest run && npx vue-tsc -b`
Expected: green + error set identical to develop HEAD

Manual pass (review app, reviewer checks each):
- thinking toggle on + reasoning model → live dim box → auto-collapse + duration; stored message → collapsed box after refresh
- toggle on + plain model impossible (disabled with reason); picker rows disable while toggle on
- unsupported model → zero thinking UI anywhere; thinking off → behavior identical to today
- budget respected (long reasoning truncated at N); empty budget uncapped
- vision off → image button disabled + send blocked with Persian error; document off → same for docs
- admin: modes + budget persist across refresh; legacy models (no flags) behave as vision+document on, thinking off
- previous features untouched: login, plain chat, search+cards, sidebar order, admin CRUD

- [ ] **Step 3: Commit**

```bash
git add docs/wiki/features.md docs/wiki/architecture.md docs/wiki/api-reference.md
git commit -m "docs(thinking): capabilities feature wiki and contract docs"
```

Phase 2 is shippable here. Stop and demo before any follow-ups.

---

## Self-Review

**1. Spec coverage:** every final-spec item maps to a task — adapters + shared interface (T1, facade keeps callers/tests), per-model flags + budget with safe defaults (T2), thinking/content split with toggle+flag gating and provider-independent budget cap (T3), `reasoning_content` persistence + history (T4), image/document 400 guards (T5), shadcn-style Collapsible over installed reka primitives (T6), capability registry + colored badges (T7), ThinkingBlock live→collapsed with duration (T8), presence-gated wiring live + stored (T9), toggle/picker-filtering/attach-guards/switch-rollback (T10), admin modes + budget form (T11), docs + gates (T12). Anthropic: explicitly out, no code reserved for it. Reasoning-token counting stays heuristic (documented as future work).

**2. Placeholder scan:** every step names exact files, symbols, commands and expected outputs. Two near-misses fixed during review: (a) Task 3's test asserts persistence absence pre-Task-4 so the two tasks can't silently overlap; (b) Task 10's second component test carries an inline fallback (mid-test selectModelId switch) if double-mount proves flaky. No TBD/TODO/fill-in-later anywhere.

**3. Type consistency:** `StreamChunk` ↔ facade union (`{ reasoning }`) ↔ `ChatChunk.thinking*` ↔ SSE payloads ↔ `dispatchSseEvent` callbacks ↔ store fields ↔ `ThinkingBlock` props — same names end to end. `convFlags` evolves `{web}` → `{web, thinking}` with backward-compatible defaults (existing `__new__` migration moves the whole object). `CapabilityFlags` ( Picks of `Model`) matches the four entity/DTO/type fields. Budget is `number | null` everywhere; empty admin input normalizes to null in exactly one place (saveModel payload).