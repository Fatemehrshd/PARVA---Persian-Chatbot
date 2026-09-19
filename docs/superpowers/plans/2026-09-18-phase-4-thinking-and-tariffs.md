# Phase 4: Thinking Capabilities, Model Registry & Token Tariff Multipliers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete Phase 4 of the platform by implementing deep-thinking display (real model reasoning streaming and persistence) driven by a generic per-model capability registry (thinking/vision/document), combined with configurable token tariff multipliers (e.g. 1.2× for web search and 1.3× for deep thinking) both in billing calculation and user-facing UI badges.

**Architecture:**
- **Backend AI Adapters:** `OpenAiCompatForwarder` acts as a facade delegating stream chunk parsing to `OpenAiCompatAdapter` implementing `StreamAdapter` interface (`buildRequest`, `parseStreamChunk`), isolating reasoning delta extraction (`choices[0].delta.reasoning_content`/`reasoning`).
- **Capabilities & Schema:** `AiModel` stores explicit capability flags (`supportsThinking`, `supportsVision`, `supportsDocument`, `thinkingBudgetTokens`). `Message` entity stores `reasoning_content` and `thinkingDurationMs`.
- **Token Tariff Multipliers:** `SystemSetting` stores `web_search_multiplier` (default `1.2`) and `thinking_multiplier` (default `1.3`). `ChatService.generate` applies the effective tariff multiplier to `consumedTokens` upon reply completion.
- **Frontend UI & Components:** Built with `reka-ui` Collapsible primitives (`ui/collapsible/`), a shared `capabilities.ts` registry, `CapabilityBadge.vue`, `ThinkingBlock.vue` (live elapsed timer, streaming reasoning, collapsible card), and `ChatComposer.vue` + `+` menu showing capability toggles and token tariff multipliers (`ضریب ۱.۲×` / `ضریب ۱.۳×`).
- **Admin Panel:** `ModelEditorModal.vue` adds capability checkboxes and thinking budget input; `AdminPromptsSection.vue` adds tariff configuration inputs for Search & Thinking multipliers.

**Tech Stack:** NestJS 10 + TypeORM + PostgreSQL (backend, Jest); Vue 3 + Vite + Pinia + Tailwind CSS + reka-ui (frontend, Vitest).

**Spec:** `docs/superpowers/specs/2026-09-18-web-search-and-thinking-design.md`

## Global Constraints

- **Golden Rule:** Every new DTO/API/SSE/DB field is OPTIONAL or defaulted — old clients, old servers, and existing database records never break.
- **Honesty in Reasoning:** Thinking content is display-only: NEVER generated, NEVER faked. It is solely extracted from OpenAI-compatible deltas (`reasoning_content` / `reasoning`). If a model provides no reasoning delta, no thinking card is displayed.
- **Tariff & Multiplier Integrity:** Multipliers must be positive floats (e.g. 1.2, 1.3). When applied, `consumedTokens = Math.ceil(baseTokens * effectiveMultiplier)`. The UI clearly displays these tariffs to the user when enabling search or thinking.
- **Database Migrations:** Entity changes require hand-written TypeORM migrations in `backend/src/migrations/` using `IF NOT EXISTS` (production runs migrations; test/dev uses `DB_SYNC=true`).
- **SSE Event Protocol:** New SSE events are strictly `thinking` (`{ content: string }`) and `thinking-status` (`{ state: 'thinking' | 'done', durationMs?: number }`). Reconnection sync via `ActiveStreamService` replays accumulated reasoning text.
- **Styling Rule:** Tailwind utilities + existing shadcn/reka-ui components ONLY. No new CSS classes in `<style>` blocks. Full Persian RTL support.
- **Verification Gates:**
  - Backend: `cd backend && npm test` (all test suites green).
  - Frontend: `cd frontend && npm test` and `npm run build` (all test files green, zero typecheck errors).

---

## File Structure

```
backend/src/modules/ai/adapters/
  stream-adapter.ts                          ← NEW: StreamChunk union & StreamAdapter interface
  openai-compat.adapter.ts                   ← NEW: OpenAI-compatible request builder & reasoning chunk parser
backend/src/modules/ai/
  openai-compat.forwarder.ts                 ← FACADE: delegates streaming to OpenAICompatAdapter
backend/src/modules/models-admin/
  ai-model.entity.ts                         ← ADD: supportsThinking, supportsVision, supportsDocument, thinkingBudgetTokens
  dto.ts                                     ← ADD: capability flags & thinkingBudgetTokens to DTOs
backend/src/modules/admin/
  settings.service.ts                        ← ADD: webSearchMultiplier (1.2) & thinkingMultiplier (1.3) keys & methods
  dto.ts                                     ← ADD: webSearchMultiplier & thinkingMultiplier in UpdateSettingsDto
backend/src/modules/chat/
  chat.service.ts                            ← ADD: useThinking handling, thinking yields, token multiplier calculation, attachment capability guards
  chat.controller.ts                         ← ADD: thinking and thinking-status SSE event writers
  active-stream.service.ts                   ← ADD: reasoning buffer and replay on sync
  dto.ts                                     ← ADD: useThinking flag
  message.entity.ts                          ← ADD: reasoning_content and thinkingDurationMs columns
backend/src/migrations/
  1761300000002-AddModelCapabilities.ts      ← NEW: migration for model capabilities
  1761300000003-AddMessageReasoning.ts       ← NEW: migration for message reasoning_content
backend/test/
  ai-adapter.spec.ts                         ← NEW: unit tests for OpenAICompatAdapter
  models-capabilities.spec.ts                ← NEW: model capability persistence tests
  token-tariffs.spec.ts                      ← NEW: settings & token tariff multiplier tests
  chat-thinking-flow.spec.ts                 ← NEW: chat thinking flow & tariff calculation tests
  attachment-capabilities.spec.ts            ← NEW: vision & document guard tests

frontend/src/components/ui/collapsible/
  Collapsible.vue                            ← NEW: reka-ui CollapsibleRoot wrapper
  CollapsibleTrigger.vue                     ← NEW: reka-ui CollapsibleTrigger wrapper
  CollapsibleContent.vue                     ← NEW: reka-ui CollapsibleContent wrapper
  index.ts                                   ← NEW: exports
frontend/src/
  utils/capabilities.ts                      ← NEW: capability registry, labels, colors, modelSupports()
  components/chat/CapabilityBadge.vue        ← NEW: badge component for thinking, vision, document
  components/chat/ThinkingBlock.vue          ← NEW: live & stored collapsible reasoning card
  components/chat/ChatComposer.vue           ← MODIFY: thinking toggle in + menu with tariff badge (1.3×), web search tariff badge (1.2×), attachment guards
  components/chat/MessageList.vue            ← MODIFY: render live ThinkingBlock during reasoning stream
  components/chat/MessageBubble.vue          ← MODIFY: render stored ThinkingBlock for historic messages
  stores/chat.ts                             ← MODIFY: convFlags.thinking, streamThinking state, tariff info
  services/chat.service.ts                   ← MODIFY: SSE event handlers for thinking & thinking-status
  types/index.ts                             ← MODIFY: capability types, tariff settings, message reasoning fields
  views/admin/AdminPromptsSection.vue        ← MODIFY: search & thinking tariff multiplier input controls
  components/admin/modals/ModelEditorModal.vue ← MODIFY: model capabilities checkboxes & budget input
frontend/tests/
  Collapsible.spec.ts                        ← NEW
  capabilities.spec.ts                       ← NEW
  CapabilityBadge.spec.ts                    ← NEW
  ThinkingBlock.spec.ts                      ← NEW
  ChatComposer.thinking.spec.ts              ← NEW
  AdminPromptsSection.tariffs.spec.ts        ← NEW
```

---

### Task 1: StreamAdapter Interface & OpenAI-Compatible Reasoning Adapter (Backend TDD)

**Files:**
- Create: `backend/src/modules/ai/adapters/stream-adapter.ts`
- Create: `backend/src/modules/ai/adapters/openai-compat.adapter.ts`
- Modify: `backend/src/modules/ai/openai-compat.forwarder.ts`
- Test: `backend/test/ai-adapter.spec.ts`

**Interfaces:**
- Consumes: `ChatMessage`, `ResolvedTarget`, `StreamOptions` from `openai-compat.forwarder.ts`.
- Produces:
  ```ts
  export type StreamChunk =
    | { type: 'content'; text: string }
    | { type: 'reasoning'; text: string };
  export interface StreamAdapter {
    readonly name: string;
    buildRequest(ctx: { target: ResolvedTarget; messages: ChatMessage[]; options?: StreamOptions }): { url: string; init: RequestInit };
    parseStreamChunk(payload: unknown): StreamChunk[];
  }
  ```
  `OpenAiCompatForwarder.stream` yields `string | { reasoning: string }` preserving backward compatibility with existing tests.

- [ ] **Step 1: Write the failing test**

```ts
// backend/test/ai-adapter.spec.ts
import { OpenAiCompatAdapter } from '../src/modules/ai/adapters/openai-compat.adapter';

describe('OpenAiCompatAdapter', () => {
  const adapter = new OpenAiCompatAdapter();
  const target: any = { apiIdentifier: 'deepseek-reasoner', apiKey: 'test-key', baseUrl: 'https://api.openai.com/v1' };

  it('builds standard chat completions request with streaming', () => {
    const { url, init } = adapter.buildRequest({ target, messages: [{ role: 'user', content: 'hello' }] });
    expect(url).toBe('https://api.openai.com/v1/chat/completions');
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe('deepseek-reasoner');
    expect(body.stream).toBe(true);
  });

  it('extracts content and reasoning deltas separately', () => {
    expect(adapter.parseStreamChunk({ choices: [{ delta: { content: 'hello' } }] })).toEqual([
      { type: 'content', text: 'hello' },
    ]);
    expect(adapter.parseStreamChunk({ choices: [{ delta: { reasoning_content: 'thinking deep' } }] })).toEqual([
      { type: 'reasoning', text: 'thinking deep' },
    ]);
    expect(adapter.parseStreamChunk({ choices: [{ delta: { reasoning: 'alternative reasoning field' } }] })).toEqual([
      { type: 'reasoning', text: 'alternative reasoning field' },
    ]);
  });

  it('handles chunk with both reasoning and content, reasoning first', () => {
    expect(
      adapter.parseStreamChunk({ choices: [{ delta: { reasoning_content: 'r-part', content: 'c-part' } }] }),
    ).toEqual([
      { type: 'reasoning', text: 'r-part' },
      { type: 'content', text: 'c-part' },
    ]);
  });

  it('safely ignores empty or malformed deltas', () => {
    expect(adapter.parseStreamChunk({ choices: [{ delta: {} }] })).toEqual([]);
    expect(adapter.parseStreamChunk({})).toEqual([]);
    expect(adapter.parseStreamChunk(null)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest test/ai-adapter.spec.ts --runInBand`
Expected: FAIL (Cannot find module)

- [ ] **Step 3: Write minimal implementation**

Create `backend/src/modules/ai/adapters/stream-adapter.ts` and `backend/src/modules/ai/adapters/openai-compat.adapter.ts`. Update `openai-compat.forwarder.ts` to instantiate `OpenAiCompatAdapter` and yield `{ reasoning: chunk.text }` for reasoning pieces and plain `chunk.text` for content.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx jest test/ai-adapter.spec.ts test/ai-forwarder.spec.ts --runInBand`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/ai/adapters backend/src/modules/ai/openai-compat.forwarder.ts backend/test/ai-adapter.spec.ts
git commit -m "feat(ai): add StreamAdapter interface and OpenAiCompatAdapter with reasoning extraction"
```

---

### Task 2: Model Capabilities & Budget Schema, DTOs & Migration (Backend TDD)

**Files:**
- Modify: `backend/src/modules/models-admin/ai-model.entity.ts`
- Modify: `backend/src/modules/models-admin/dto.ts`
- Create: `backend/src/migrations/1761300000002-AddModelCapabilities.ts`
- Test: `backend/test/models-capabilities.spec.ts`

**Interfaces:**
- Produces columns on `AiModel`:
  - `supportsThinking: boolean` (default `false`)
  - `supportsVision: boolean` (default `true`)
  - `supportsDocument: boolean` (default `true`)
  - `thinkingBudgetTokens?: number | null` (default `null`)
- Updates `CreateModelDto` and `UpdateModelDto` with `@IsOptional() @IsBoolean()` and `@IsOptional() @IsInt() @Min(0)`.

- [ ] **Step 1: Write the failing test**

```ts
// backend/test/models-capabilities.spec.ts
import { AiModel } from '../src/modules/models-admin/ai-model.entity';

describe('AiModel Capabilities', () => {
  it('instantiates with default capabilities', () => {
    const model = new AiModel();
    model.name = 'Test Model';
    model.provider = 'OpenAI';
    model.apiIdentifier = 'gpt-4o';
    expect(model.supportsThinking).toBe(false);
    expect(model.supportsVision).toBe(true);
    expect(model.supportsDocument).toBe(true);
    expect(model.thinkingBudgetTokens).toBeUndefined();
  });

  it('allows setting thinking capability and budget', () => {
    const model = new AiModel();
    model.supportsThinking = true;
    model.thinkingBudgetTokens = 4096;
    expect(model.supportsThinking).toBe(true);
    expect(model.thinkingBudgetTokens).toBe(4096);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest test/models-capabilities.spec.ts --runInBand`
Expected: FAIL

- [ ] **Step 3: Implement entity fields and migration**

Add the 4 columns with decorators and defaults to `ai-model.entity.ts`, add DTO fields, and write migration `1761300000002-AddModelCapabilities.ts` using `ALTER TABLE "ai_models" ADD COLUMN IF NOT EXISTS ...`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx jest test/models-capabilities.spec.ts test/models-admin.spec.ts --runInBand`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/models-admin backend/src/migrations/1761300000002-AddModelCapabilities.ts backend/test/models-capabilities.spec.ts
git commit -m "feat(models): add model capability flags and thinking budget schema"
```

---

### Task 3: Web Search & Thinking Token Tariff Multipliers in Settings (Backend TDD)

**Files:**
- Modify: `backend/src/modules/admin/settings.service.ts`
- Modify: `backend/src/modules/admin/dto.ts`
- Test: `backend/test/token-tariffs.spec.ts`

**Interfaces:**
- Produces keys:
  - `WEB_SEARCH_TOKEN_MULTIPLIER_KEY = 'web_search_multiplier'` (default `1.2`)
  - `THINKING_TOKEN_MULTIPLIER_KEY = 'thinking_multiplier'` (default `1.3`)
- Produces methods on `SettingsService`:
  - `getWebSearchMultiplier(): Promise<number>`
  - `getThinkingMultiplier(): Promise<number>`
- Extends `getAll()` and `UpdateSettingsDto` with `webSearchMultiplier?: number` and `thinkingMultiplier?: number`.

- [ ] **Step 1: Write the failing test**

```ts
// backend/test/token-tariffs.spec.ts
import { SettingsService, DEFAULT_WEB_SEARCH_MULTIPLIER, DEFAULT_THINKING_MULTIPLIER } from '../src/modules/admin/settings.service';

describe('SettingsService Token Tariffs', () => {
  let service: SettingsService;
  let fakeRepo: any;
  let memory: Record<string, string>;

  beforeEach(() => {
    memory = {};
    fakeRepo = {
      findOne: jest.fn(async ({ where }: any) => (memory[where.key] !== undefined ? { key: where.key, value: memory[where.key] } : null)),
      create: jest.fn((dto: any) => dto),
      save: jest.fn(async (entity: any) => { memory[entity.key] = entity.value; return entity; }),
    };
    service = new SettingsService(fakeRepo);
  });

  it('returns default multipliers 1.2 and 1.3 when unset', async () => {
    expect(await service.getWebSearchMultiplier()).toBe(1.2);
    expect(await service.getThinkingMultiplier()).toBe(1.3);
  });

  it('saves and retrieves customized multipliers', async () => {
    await service.update({ webSearchMultiplier: 1.5, thinkingMultiplier: 1.8 } as any);
    expect(await service.getWebSearchMultiplier()).toBe(1.5);
    expect(await service.getThinkingMultiplier()).toBe(1.8);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest test/token-tariffs.spec.ts --runInBand`
Expected: FAIL

- [ ] **Step 3: Implement settings service multiplier methods and DTO validation**

Add constants `DEFAULT_WEB_SEARCH_MULTIPLIER = 1.2` and `DEFAULT_THINKING_MULTIPLIER = 1.3`, implement getters and update handlers, and add `@IsOptional() @IsNumber() @Min(1)` in `UpdateSettingsDto`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx jest test/token-tariffs.spec.ts --runInBand`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/admin/settings.service.ts backend/src/modules/admin/dto.ts backend/test/token-tariffs.spec.ts
git commit -m "feat(settings): add web search and thinking token tariff multipliers"
```

---

### Task 4: ChatService Thinking Flow, ActiveStream Buffer & Tariff Calculation (Backend TDD)

**Files:**
- Modify: `backend/src/modules/chat/chat.service.ts`
- Modify: `backend/src/modules/chat/chat.controller.ts`
- Modify: `backend/src/modules/chat/active-stream.service.ts`
- Modify: `backend/src/modules/chat/dto.ts`
- Test: `backend/test/chat-thinking-flow.spec.ts`

**Interfaces:**
- Consumes: `options.useThinking?: boolean`, model capability `supportsThinking`, `SettingsService.getWebSearchMultiplier()`, `getThinkingMultiplier()`.
- Produces:
  - SSE events: `thinking { content }`, `thinking-status { state: 'thinking' | 'done', durationMs }`.
  - Token tariff calculation:
    ```ts
    let tariffMultiplier = 1.0;
    if (webSources && webSources.length > 0) {
      tariffMultiplier *= await this.settings.getWebSearchMultiplier(); // e.g. 1.2
    }
    if (reasoningText && reasoningText.length > 0) {
      tariffMultiplier *= await this.settings.getThinkingMultiplier();  // e.g. 1.3
    }
    const consumedTokens = Math.ceil(baseTokens * tariffMultiplier);
    ```

- [ ] **Step 1: Write the failing test**

```ts
// backend/test/chat-thinking-flow.spec.ts
import { calculateEffectiveTokens } from '../src/modules/chat/chat.service';

describe('ChatService Token Tariff Calculation', () => {
  it('applies 1.0 multiplier when neither search nor thinking is used', () => {
    const tokens = calculateEffectiveTokens(100, { usedSearch: false, usedThinking: false, searchMult: 1.2, thinkingMult: 1.3 });
    expect(tokens).toBe(100);
  });

  it('applies search multiplier 1.2x when search is used', () => {
    const tokens = calculateEffectiveTokens(100, { usedSearch: true, usedThinking: false, searchMult: 1.2, thinkingMult: 1.3 });
    expect(tokens).toBe(120);
  });

  it('applies thinking multiplier 1.3x when thinking is used', () => {
    const tokens = calculateEffectiveTokens(100, { usedSearch: false, usedThinking: true, searchMult: 1.2, thinkingMult: 1.3 });
    expect(tokens).toBe(130);
  });

  it('compounds multipliers when both search and thinking are used', () => {
    // 100 * 1.2 * 1.3 = 156
    const tokens = calculateEffectiveTokens(100, { usedSearch: true, usedThinking: true, searchMult: 1.2, thinkingMult: 1.3 });
    expect(tokens).toBe(156);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest test/chat-thinking-flow.spec.ts --runInBand`
Expected: FAIL

- [ ] **Step 3: Implement thinking generation flow, SSE writer, and tariff multiplier in ChatService**

In `chat.service.ts`:
- Check model `supportsThinking` when `options?.useThinking` is true.
- Track thinking start time (`const thinkingStart = Date.now()`), yield `thinkingStatus: 'thinking'`, stream reasoning pieces, yield `thinkingStatus: 'done', thinkingDurationMs`.
- Buffer reasoning text in `ActiveStreamService` via `setReasoning(id, piece)`.
- Replay reasoning in `ActiveStreamService.attachToActiveStream`.
- Apply `calculateEffectiveTokens` before calling `users.incrementUsedTokens`.
In `chat.controller.ts`:
- Map chunk `{ thinking }` to SSE `event: thinking` and chunk `{ thinkingStatus }` to SSE `event: thinking-status`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx jest test/chat-thinking-flow.spec.ts test/chat-real-stream.spec.ts --runInBand`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/chat backend/test/chat-thinking-flow.spec.ts
git commit -m "feat(chat): implement thinking streaming, active stream replay, and token tariff calculation"
```

---

### Task 5: Message Reasoning Persistence & Migration (Backend TDD)

**Files:**
- Modify: `backend/src/modules/chat/message.entity.ts`
- Create: `backend/src/migrations/1761300000003-AddMessageReasoning.ts`
- Test: `backend/test/message-reasoning.spec.ts`

**Interfaces:**
- Adds to `Message` entity:
  - `reasoning_content?: string | null` (Column `text`, nullable)
  - `thinkingDurationMs?: number | null` (Column `int`, nullable)
- Ensures `ChatService` saves reasoning to assistant message entity upon stream completion (or null on user-aborted stops).

- [ ] **Step 1: Write the failing test**

```ts
// backend/test/message-reasoning.spec.ts
import { Message } from '../src/modules/chat/message.entity';

describe('Message Reasoning Entity', () => {
  it('instantiates with nullable reasoning fields', () => {
    const msg = new Message();
    msg.content = 'Final answer';
    msg.role = 'assistant';
    expect(msg.reasoning_content).toBeUndefined();
    expect(msg.thinkingDurationMs).toBeUndefined();
  });

  it('persists reasoning content and duration', () => {
    const msg = new Message();
    msg.reasoning_content = 'Step 1: analyze input\nStep 2: compute answer';
    msg.thinkingDurationMs = 2450;
    expect(msg.reasoning_content).toContain('Step 1');
    expect(msg.thinkingDurationMs).toBe(2450);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest test/message-reasoning.spec.ts --runInBand`
Expected: FAIL

- [ ] **Step 3: Implement entity fields and migration**

Add `reasoning_content` and `thinkingDurationMs` to `message.entity.ts` and create migration `1761300000003-AddMessageReasoning.ts`. Update `chat.service.ts` message save call.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx jest test/message-reasoning.spec.ts test/chat.e2e.spec.ts --runInBand`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/chat/message.entity.ts backend/src/migrations/1761300000003-AddMessageReasoning.ts backend/test/message-reasoning.spec.ts
git commit -m "feat(chat): persist assistant reasoning content and thinking duration"
```

---

### Task 6: Attachment Capability Guards on Backend (Backend TDD)

**Files:**
- Modify: `backend/src/modules/chat/chat.service.ts`
- Test: `backend/test/attachment-capabilities.spec.ts`

**Interfaces:**
- Consumes: `model.supportsVision`, `model.supportsDocument`, file attachments.
- Produces: 400 Bad Request with Persian messages before calling provider:
  - Image attached when `supportsVision === false` → `BadRequestException('مدل انتخاب‌شده قابلیت پردازش تصویر را پشتیبانی نمی‌کند.')`
  - Document attached when `supportsDocument === false` → `BadRequestException('مدل انتخاب‌شده قابلیت پردازش سند/فایل متنی را پشتیبانی نمی‌کند.')`

- [ ] **Step 1: Write the failing test**

```ts
// backend/test/attachment-capabilities.spec.ts
import { validateModelAttachmentCapabilities } from '../src/modules/chat/chat.service';

describe('validateModelAttachmentCapabilities', () => {
  it('permits images when model supports vision', () => {
    expect(() => validateModelAttachmentCapabilities({ supportsVision: true }, [{ fileType: 'image' } as any])).not.toThrow();
  });

  it('throws Persian error when images are sent to non-vision model', () => {
    expect(() => validateModelAttachmentCapabilities({ supportsVision: false }, [{ fileType: 'image' } as any]))
      .toThrow('مدل انتخاب‌شده قابلیت پردازش تصویر را پشتیبانی نمی‌کند.');
  });

  it('throws Persian error when documents are sent to non-document model', () => {
    expect(() => validateModelAttachmentCapabilities({ supportsDocument: false }, [{ fileType: 'pdf' } as any]))
      .toThrow('مدل انتخاب‌شده قابلیت پردازش سند/فایل متنی را پشتیبانی نمی‌کند.');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest test/attachment-capabilities.spec.ts --runInBand`
Expected: FAIL

- [ ] **Step 3: Implement validation function and wire into `ChatService.generate`**

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx jest test/attachment-capabilities.spec.ts --runInBand`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/chat/chat.service.ts backend/test/attachment-capabilities.spec.ts
git commit -m "feat(chat): enforce model capability guards for vision and document attachments"
```

---

### Task 7: UI Collapsible Component Wrapper (Frontend TDD)

**Files:**
- Create: `frontend/src/components/ui/collapsible/Collapsible.vue`
- Create: `frontend/src/components/ui/collapsible/CollapsibleTrigger.vue`
- Create: `frontend/src/components/ui/collapsible/CollapsibleContent.vue`
- Create: `frontend/src/components/ui/collapsible/index.ts`
- Test: `frontend/tests/Collapsible.spec.ts`

**Interfaces:**
- Thin wrappers over `reka-ui` (`CollapsibleRoot`, `CollapsibleTrigger`, `CollapsibleContent`).

- [ ] **Step 1: Write the failing test**

```ts
// frontend/tests/Collapsible.spec.ts
import { mount } from '@vue/test-utils';
import { describe, it, expect } from 'vitest';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '../src/components/ui/collapsible';

describe('Collapsible Components', () => {
  it('renders trigger and content toggling open state', async () => {
    const wrapper = mount({
      components: { Collapsible, CollapsibleTrigger, CollapsibleContent },
      template: `
        <Collapsible :defaultOpen="false">
          <CollapsibleTrigger>Toggle</CollapsibleTrigger>
          <CollapsibleContent><p>Secret content</p></CollapsibleContent>
        </Collapsible>
      `,
    });
    expect(wrapper.text()).toContain('Toggle');
    expect(wrapper.find('p').exists()).toBe(false);
    await wrapper.find('button').trigger('click');
    expect(wrapper.find('p').exists()).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run tests/Collapsible.spec.ts`
Expected: FAIL

- [ ] **Step 3: Implement Collapsible components using reka-ui**

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run tests/Collapsible.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ui/collapsible frontend/tests/Collapsible.spec.ts
git commit -m "feat(ui): add Collapsible components wrapping reka-ui"
```

---

### Task 8: Capabilities Registry & CapabilityBadge Component (Frontend TDD)

**Files:**
- Create: `frontend/src/utils/capabilities.ts`
- Create: `frontend/src/components/chat/CapabilityBadge.vue`
- Test: `frontend/tests/capabilities.spec.ts`
- Test: `frontend/tests/CapabilityBadge.spec.ts`

**Interfaces:**
- Produces:
  - `modelSupports(model, 'thinking' | 'vision' | 'document'): boolean`
  - Labels, colors: violet for thinking, sky for vision, amber for document.
  - `CapabilityBadge.vue`: renders minimal pill with icon + Persian label.

- [ ] **Step 1: Write the failing test**

```ts
// frontend/tests/capabilities.spec.ts
import { describe, it, expect } from 'vitest';
import { modelSupports, getCapabilityMeta } from '../src/utils/capabilities';

describe('modelSupports util', () => {
  it('returns explicit flag if present', () => {
    expect(modelSupports({ supportsThinking: true } as any, 'thinking')).toBe(true);
    expect(modelSupports({ supportsThinking: false } as any, 'thinking')).toBe(false);
  });

  it('defaults vision and document to true when undefined', () => {
    expect(modelSupports({} as any, 'vision')).toBe(true);
    expect(modelSupports({} as any, 'document')).toBe(true);
  });

  it('defaults thinking to false when undefined', () => {
    expect(modelSupports({} as any, 'thinking')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run tests/capabilities.spec.ts`
Expected: FAIL

- [ ] **Step 3: Implement `capabilities.ts` and `CapabilityBadge.vue`**

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run tests/capabilities.spec.ts tests/CapabilityBadge.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/utils/capabilities.ts frontend/src/components/chat/CapabilityBadge.vue frontend/tests/capabilities.spec.ts frontend/tests/CapabilityBadge.spec.ts
git commit -m "feat(capabilities): add capabilities utility registry and CapabilityBadge component"
```

---

### Task 9: ThinkingBlock Component with Live Streaming & History Collapse (Frontend TDD)

**Files:**
- Create: `frontend/src/components/chat/ThinkingBlock.vue`
- Test: `frontend/tests/ThinkingBlock.spec.ts`

**Interfaces:**
- Props:
  - `thinkingText?: string`
  - `durationMs?: number`
  - `isLive?: boolean`
- Features:
  - In live mode: animated elapsed timer (`در حال تفکر... ۵ ثانیه`), dimmer text container, auto-scroll.
  - In completed mode: auto-collapsed card with toggle chevron (`روند تفکر عمیق (۳.۲ ثانیه)`), expands on click.
  - Full RTL styling using Tailwind utilities.

- [ ] **Step 1: Write the failing test**

```ts
// frontend/tests/ThinkingBlock.spec.ts
import { mount } from '@vue/test-utils';
import { describe, it, expect } from 'vitest';
import ThinkingBlock from '../src/components/chat/ThinkingBlock.vue';

describe('ThinkingBlock.vue', () => {
  it('renders live thinking indicator with elapsed duration', () => {
    const wrapper = mount(ThinkingBlock, {
      props: { isLive: true, thinkingText: 'Computing logic...' },
    });
    expect(wrapper.text()).toContain('در حال تفکر');
    expect(wrapper.text()).toContain('Computing logic...');
  });

  it('renders collapsed completed thinking box with duration', () => {
    const wrapper = mount(ThinkingBlock, {
      props: { isLive: false, durationMs: 2500, thinkingText: 'Final thought' },
    });
    expect(wrapper.text()).toContain('روند تفکر');
    expect(wrapper.text()).toContain('۲٫۵ ثانیه');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run tests/ThinkingBlock.spec.ts`
Expected: FAIL

- [ ] **Step 3: Implement `ThinkingBlock.vue`**

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run tests/ThinkingBlock.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/chat/ThinkingBlock.vue frontend/tests/ThinkingBlock.spec.ts
git commit -m "feat(chat): add ThinkingBlock component with live timer and collapsible display"
```

---

### Task 10: Wire ThinkingBlock in MessageList (Streaming) & MessageBubble (History)

**Files:**
- Modify: `frontend/src/components/chat/MessageList.vue`
- Modify: `frontend/src/components/chat/MessageBubble.vue`
- Test: `frontend/tests/MessageBubble.spec.ts`

**Interfaces:**
- `MessageList.vue`: when `chatStore.isStreaming` and `chatStore.streamingThinkingText` has content, render `ThinkingBlock :isLive="chatStore.isThinkingActive" :thinkingText="chatStore.streamingThinkingText"`.
- `MessageBubble.vue`: when `message.reasoning_content` is present, render `ThinkingBlock :isLive="false" :thinkingText="message.reasoning_content" :durationMs="message.thinkingDurationMs"`.

- [ ] **Step 1: Update components and run test suite**
- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/chat/MessageList.vue frontend/src/components/chat/MessageBubble.vue frontend/tests/MessageBubble.spec.ts
git commit -m "feat(chat): connect ThinkingBlock to live streaming message and historical messages"
```

---

### Task 11: ChatComposer Thinking Toggle, Capability Badges, Tariff Display & Attachment Guards (Frontend TDD)

**Files:**
- Modify: `frontend/src/components/chat/ChatComposer.vue`
- Modify: `frontend/src/stores/chat.ts`
- Modify: `frontend/src/services/chat.service.ts`
- Test: `frontend/tests/ChatComposer.thinking.spec.ts`

**Interfaces:**
- ChatComposer `+` menu displays:
  - **جستجوی وب**: toggle switch with tariff badge `ضریب ۱.۲×`
  - **تفکر عمیق**: toggle switch with tariff badge `ضریب ۱.۳×` (disabled with tooltip "این مدل از تفکر عمیق پشتیبانی نمی‌کند" if active model lacks `supportsThinking`).
- Model picker dropdown displays capability badges (`CapabilityBadge`) next to model names.
- If user attaches images/documents to models without vision/document support, buttons show disabled state with clear Persian tooltip explanations.

- [ ] **Step 1: Write the failing test**

```ts
// frontend/tests/ChatComposer.thinking.spec.ts
import { mount } from '@vue/test-utils';
import { describe, it, expect } from 'vitest';
import ChatComposer from '../src/components/chat/ChatComposer.vue';

describe('ChatComposer Thinking & Tariff Badges', () => {
  it('displays tariff multiplier badges for search and thinking in menu', async () => {
    const wrapper = mount(ChatComposer);
    // open + menu
    const plusBtn = wrapper.find('.composer-plus-btn');
    if (plusBtn.exists()) await plusBtn.trigger('click');
    expect(wrapper.text()).toContain('ضریب ۱.۲×');
    expect(wrapper.text()).toContain('ضریب ۱.۳×');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run tests/ChatComposer.thinking.spec.ts`
Expected: FAIL

- [ ] **Step 3: Implement ChatComposer toggles, tariff badges, capability tooltips, and store options**

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run tests/ChatComposer.thinking.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/chat/ChatComposer.vue frontend/src/stores/chat.ts frontend/src/services/chat.service.ts frontend/tests/ChatComposer.thinking.spec.ts
git commit -m "feat(composer): add thinking toggle, capability badges, tariff multipliers, and attachment guards"
```

---

### Task 12: Admin Model Capabilities Form & Tariff Settings in Admin Panel

**Files:**
- Modify: `frontend/src/components/admin/modals/ModelEditorModal.vue`
- Modify: `frontend/src/views/admin/AdminPromptsSection.vue`
- Test: `frontend/tests/AdminModelCapabilities.spec.ts`

**Interfaces:**
- `ModelEditorModal.vue`:
  - Checkboxes for: `پشتیبانی از تفکر عمیق (Thinking)`, `پشتیبانی از تصویر (Vision)`, `پشتیبانی از سند و فایل (Document)`.
  - Number input for: `سقف توکن تفکر عمیق (Budget Tokens)` (اختیاری).
- `AdminPromptsSection.vue`:
  - Inputs for: `ضریب مصرف توکن جستجوی وب` (پیش‌فرض 1.2) و `ضریب مصرف توکن تفکر عمیق` (پیش‌فرض 1.3).
  - Saved to backend via `PUT /api/v1/admin/settings`.

- [ ] **Step 1: Write the failing test**
- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Implement form fields and admin settings cards**
- [ ] **Step 4: Run test to verify it passes**
- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/admin/modals/ModelEditorModal.vue frontend/src/views/admin/AdminPromptsSection.vue frontend/tests/AdminModelCapabilities.spec.ts
git commit -m "feat(admin): add model capability toggles and token tariff multiplier settings"
```

---

### Task 13: Full Regression Verification, Documentation (Wiki & Changelog) & Close-Out

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `docs/wiki/features.md`
- Modify: `docs/wiki/architecture.md`
- Modify: `docs/wiki/api-reference.md`

- [ ] **Step 1: Run full backend test suite**

Run: `cd backend && npm test`
Expected: ALL test suites PASS (0 failed)

- [ ] **Step 2: Run full frontend test suite and build**

Run: `cd frontend && npm test && npm run build`
Expected: ALL test files PASS (0 failed) and build completes cleanly.

- [ ] **Step 3: Update documentation**
Record Phase 4 release notes in `CHANGELOG.md` and wiki files detailing:
- Deep thinking display and real model reasoning extraction.
- Generic capability registry per model.
- Token tariff multipliers for search (1.2×) and thinking (1.3×) in billing and UI.

- [ ] **Step 4: Commit**

```bash
git add CHANGELOG.md docs/wiki/
git commit -m "docs: document Phase 4 thinking capabilities and token tariff multipliers"
```

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-09-18-phase-4-thinking-and-tariffs.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration.
**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
