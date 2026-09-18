# Periodic Quotas & Task Multipliers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Period-based user quotas (hourly reset, token + message caps at role AND user level) with structured chat blocking, plus per-task-type cost multipliers (admin enters only multipliers) and a live remaining-% display in ProfileMenu synced via response interceptor.

**Architecture:** Lazy period reset (no cron) via new columns on `users`; quotas resolved user → role (`role_quotas` in `system_settings`, lazily seeded from legacy `role_token_limits`) → global. Usage tracked per task type (`usageByType` jsonb) so cost = Σ(tokens_type × rate × multiplier) is recomputable when rates change. Backend `QuotaInterceptor` stamps an `X-User-Quota` header on authed chat/profile responses; frontend `request()` wrapper feeds a shared Pinia `useQuotaStore` consumed by ProfileMenu (non-clickable item) and the chat composer (block + banner).

**Tech Stack:** NestJS + TypeORM/PostgreSQL (hand-written migrations), Vue 3 + Pinia + Tailwind, Jest (backend), Vitest + Vue Test Utils (frontend).

**Spec:** `docs/superpowers/specs/2026-09-18-periodic-quotas-and-task-rates-design.md` — sections A, B, C (Phase 1). Section D (model access) is a separate later plan.

## Global Constraints

- All error messages and UI copy in Persian (`src/shared/messages.fa.ts` conventions).
- Sensitive config only from env; settings live in `system_settings` key/value table.
- Schema change = entity update + migration file under `backend/src/migrations/` (dev uses `DB_SYNC=true`, prod uses migrations).
- Admin UI: Tailwind + existing shadcn-style components (`AdminModal`, `BaseButton`, `AdminTable`) — no new CSS classes in `<style>` beyond what the copied pattern already has.
- Golden rule: do not break existing behavior. `usedTokens` (lifetime) keeps working for dashboard; existing tests stay green (fakes may need a new no-op method).
- Multiplier input: positive number (e.g. `2.5`); missing multiplier = 1; `resetHours` default 6, `0` = never reset.
- Commits per task; do not push.

---

### Task 1: User entity — period columns + usageByType + migration

**Files:**
- Modify: `backend/src/modules/users/user.entity.ts`
- Create: `backend/src/migrations/1761500000000-AddUserPeriodicQuota.ts`

**Interfaces:**
- Produces: `User.periodStart?: Date | null`, `User.periodUsedTokens: number`, `User.periodUsedMessages: number`, `User.messageLimit?: number | null`, `User.usageByType?: Record<string, number>` — used by Tasks 3–7.

- [ ] **Step 1: Add columns to entity**

```ts
// user.entity.ts — add after tokenLimit line
@Column({ type: 'int', nullable: true, default: null }) messageLimit?: number | null;
/** شروع دوره سهمیه جاری (ریست تنبل). */
@Column({ type: 'timestamptz', nullable: true, default: null }) periodStart?: Date | null;
@Column({ type: 'int', default: 0 }) periodUsedTokens: number;
@Column({ type: 'int', default: 0 }) periodUsedMessages: number;
/** شمارش توکن به تفکیک نوع کار: { normal, image, document, thinking } */
@Column({ type: 'jsonb', default: {} }) usageByType?: Record<string, number>;
```

- [ ] **Step 2: Write migration** (copy style of an existing migration, e.g. `1761200000000-AddUserTokenLimit.ts`)

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserPeriodicQuota1761500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE users ADD COLUMN "messageLimit" int NULL`);
    await queryRunner.query(`ALTER TABLE users ADD COLUMN "periodStart" timestamptz NULL`);
    await queryRunner.query(`ALTER TABLE users ADD COLUMN "periodUsedTokens" int NOT NULL DEFAULT 0`);
    await queryRunner.query(`ALTER TABLE users ADD COLUMN "periodUsedMessages" int NOT NULL DEFAULT 0`);
    await queryRunner.query(`ALTER TABLE users ADD COLUMN "usageByType" jsonb NOT NULL DEFAULT '{}'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE users DROP COLUMN "usageByType"`);
    await queryRunner.query(`ALTER TABLE users DROP COLUMN "periodUsedMessages"`);
    await queryRunner.query(`ALTER TABLE users DROP COLUMN "periodUsedTokens"`);
    await queryRunner.query(`ALTER TABLE users DROP COLUMN "periodStart"`);
    await queryRunner.query(`ALTER TABLE users DROP COLUMN "messageLimit"`);
  }
}
```

- [ ] **Step 3: Verify** — `cd backend && npm run lint` (tsc --noEmit) passes.

- [ ] **Step 4: Commit**

```bash
git add backend/src/modules/users/user.entity.ts backend/src/migrations/1761500000000-AddUserPeriodicQuota.ts
git commit -m "feat(quota): add period + usageByType columns to users"
```

---

### Task 2: SettingsService — task multipliers + role quotas (lazy seed)

**Files:**
- Modify: `backend/src/modules/admin/settings.service.ts`
- Modify: `backend/src/modules/admin/dto.ts`
- Test: `backend/test/role-token-limits.spec.ts` (extend) — rename intent: keep file, add describe blocks.

**Interfaces:**
- Produces:
  - `DEFAULT_RESET_HOURS = 6`
  - `type RoleQuota = { tokenLimit: number | null; messageLimit: number | null; resetHours: number | null }`
  - `SettingsService.getTaskMultipliers(): Promise<Record<string, number>>` (keys whitelist: `image|document|thinking`, values > 0)
  - `SettingsService.setTaskMultiplier(type: string, value: number | null): Promise<void>`
  - `SettingsService.getRoleQuotas(): Promise<Record<string, RoleQuota>>` (lazy-seeds from `role_token_limits` when `role_quotas` key absent)
  - `SettingsService.setRoleQuota(role: string, quota: RoleQuota | null): Promise<Record<string, RoleQuota>>`
  - `getAll()` now returns `taskMultipliers` + `roleQuotas`; `update()` accepts `taskMultipliers?: Record<string, number|null>` and `roleQuotas?: Record<string, RoleQuota|null>` (merge semantics like existing keys).

- [ ] **Step 1: Write failing tests** (append to `backend/test/role-token-limits.spec.ts`)

```ts
describe('Task multipliers & role quotas', () => {
  let store: Map<string, string>;
  let repo: any;
  let settings: SettingsService;
  beforeEach(() => {
    store = new Map();
    repo = {
      findOne: async ({ where }: any) =>
        store.has(where.key) ? { key: where.key, value: store.get(where.key) } : null,
      create: (dto: any) => dto,
      save: async (row: any) => { store.set(row.key, row.value); return row; },
    };
    settings = new SettingsService(repo);
  });

  it('defaults task multipliers to empty', async () => {
    expect(await settings.getTaskMultipliers()).toEqual({});
  });

  it('stores whitelist task multipliers and drops invalid keys/values', async () => {
    await settings.setTaskMultiplier('image', 2.5);
    await settings.setTaskMultiplier('hacked' as any, 5);
    await settings.setTaskMultiplier('document', -1);
    expect(await settings.getTaskMultipliers()).toEqual({ image: 2.5 });
  });

  it('removes a multiplier when set to null', async () => {
    await settings.setTaskMultiplier('image', 2.5);
    await settings.setTaskMultiplier('image', null);
    expect(await settings.getTaskMultipliers()).toEqual({});
  });

  it('lazily seeds role_quotas from legacy role_token_limits', async () => {
    await settings.setRoleTokenLimit('user', 900);
    const quotas = await settings.getRoleQuotas();
    expect(quotas.user).toEqual({ tokenLimit: 900, messageLimit: null, resetHours: null });
    // seed persists — second read comes from the new key
    expect(store.get('role_quotas')).toBeTruthy();
  });

  it('setRoleQuota merges per role and null deletes', async () => {
    await settings.setRoleQuota('user', { tokenLimit: 500, messageLimit: 10, resetHours: 6 });
    await settings.setRoleQuota('admin', { tokenLimit: 0, messageLimit: null, resetHours: 0 });
    await settings.setRoleQuota('user', null);
    expect(await settings.getRoleQuotas()).toEqual({ admin: { tokenLimit: 0, messageLimit: null, resetHours: 0 } });
  });

  it('getAll exposes taskMultipliers and roleQuotas', async () => {
    await settings.setTaskMultiplier('image', 2);
    await settings.setRoleQuota('user', { tokenLimit: 1, messageLimit: 2, resetHours: 3 });
    const all = await settings.getAll();
    expect(all.taskMultipliers).toEqual({ image: 2 });
    expect(all.roleQuotas.user).toEqual({ tokenLimit: 1, messageLimit: 2, resetHours: 3 });
  });
});
```

- [ ] **Step 2: Run to verify failure** — `cd backend && npx jest test/role-token-limits.spec.ts` → FAIL (methods missing).

- [ ] **Step 3: Implement in `settings.service.ts`**

```ts
export const TASK_MULTIPLIERS_KEY = 'task_multipliers';
export const ROLE_QUOTAS_KEY = 'role_quotas';
export const TASK_TYPES = ['image', 'document', 'thinking'] as const;
export const DEFAULT_RESET_HOURS = 6;
export type RoleQuota = { tokenLimit: number | null; messageLimit: number | null; resetHours: number | null };

// در SettingsService:
async getTaskMultipliers(): Promise<Record<string, number>> {
  const raw = await this.get(TASK_MULTIPLIERS_KEY, '{}');
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const clean: Record<string, number> = {};
    for (const t of TASK_TYPES) {
      const v = Number(parsed[t]);
      if (Number.isFinite(v) && v > 0) clean[t] = v;
    }
    return clean;
  } catch { return {}; }
}

async setTaskMultiplier(type: string, value: number | null): Promise<void> {
  if (!(TASK_TYPES as readonly string[]).includes(type)) return;
  const current = await this.getTaskMultipliers();
  const num = Number(value);
  if (value === null || !Number.isFinite(num) || num <= 0) delete current[type];
  else current[type] = num;
  await this.set(TASK_MULTIPLIERS_KEY, JSON.stringify(current));
}

async getRoleQuotas(): Promise<Record<string, RoleQuota>> {
  const raw = await this.get(ROLE_QUOTAS_KEY, '');
  if (!raw) {
    // مهاجرت تنبل از کلید legacy
    const legacy = await this.getRoleTokenLimits();
    const seeded: Record<string, RoleQuota> = {};
    for (const [role, tokenLimit] of Object.entries(legacy)) {
      seeded[role] = { tokenLimit, messageLimit: null, resetHours: null };
    }
    if (Object.keys(seeded).length) await this.set(ROLE_QUOTAS_KEY, JSON.stringify(seeded));
    return seeded;
  }
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const clean: Record<string, RoleQuota> = {};
    for (const [role, q] of Object.entries(parsed as Record<string, any>)) {
      if (!q || typeof q !== 'object') continue;
      const norm = (v: any): number | null => {
        const n = Number(v);
        return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
      };
      clean[role] = { tokenLimit: norm(q.tokenLimit), messageLimit: norm(q.messageLimit), resetHours: norm(q.resetHours) };
    }
    return clean;
  } catch { return {}; }
}

async setRoleQuota(role: string, quota: RoleQuota | null): Promise<Record<string, RoleQuota>> {
  const current = await this.getRoleQuotas();
  if (quota === null) delete current[role];
  else current[role] = quota;
  await this.set(ROLE_QUOTAS_KEY, JSON.stringify(current));
  return current;
}
```

Also: add `taskMultipliers: await this.getTaskMultipliers(), roleQuotas: await this.getRoleQuotas()` to `getAll()` (add to types + Promise.all), and in `update()`:

```ts
if (dto.taskMultipliers !== undefined && dto.taskMultipliers !== null) {
  for (const [type, v] of Object.entries(dto.taskMultipliers)) await this.setTaskMultiplier(type, v);
}
if (dto.roleQuotas !== undefined && dto.roleQuotas !== null) {
  for (const [role, q] of Object.entries(dto.roleQuotas)) await this.setRoleQuota(role, q);
}
```

- [ ] **Step 4: DTO — in `dto.ts` add to `UpdateSettingsDto`:**

```ts
@IsOptional()
@IsObject({ message: 'ضرایب نوع کار باید شیء معتبر باشد' })
taskMultipliers?: Record<string, number | null>;

@IsOptional()
@IsObject({ message: 'سهمیه نقش‌ها باید شیء معتبر باشد' })
roleQuotas?: Record<string, { tokenLimit: number | null; messageLimit: number | null; resetHours: number | null } | null>;
```

And in `UpdateUserAdminDto` add:

```ts
@IsOptional()
@ValidateIf((_obj, val) => val !== null && val !== undefined)
@IsInt({ message: 'سقف تعداد پیام باید عدد صحیح باشد' })
@Min(0, { message: 'سقف تعداد پیام نمی‌تواند منفی باشد' })
messageLimit?: number | null;
```

- [ ] **Step 5: Run tests** — `npx jest test/role-token-limits.spec.ts` → PASS. Also `npm run lint`.

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/admin/settings.service.ts backend/src/modules/admin/dto.ts backend/test/role-token-limits.spec.ts
git commit -m "feat(settings): task multipliers + role_quotas with lazy seed"
```

---

### Task 3: UsersService — lazy period sync + incrementUsage

**Files:**
- Modify: `backend/src/modules/users/users.service.ts`
- Modify: `backend/src/modules/users/dto.ts` OR admin `dto.ts` (wherever `updateByAdmin` maps fields — check: admin dto already has messageLimit from Task 2; ensure `updateByAdmin` copies `messageLimit` like `tokenLimit`)
- Test: `backend/test/periodic-quota.spec.ts` (new)

**Interfaces:**
- Produces:
  - `UsersService.syncPeriod(user: User, resetHours: number): Promise<User>` — lazy reset; when `resetHours <= 0` returns user untouched (never resets).
  - `UsersService.incrementUsage(userId: string, tokens: number, taskType = 'normal', messages = 1): Promise<void>`
  - `listWithStats()` additionally returns: `messageLimit`, `periodStart`, `periodUsedTokens`, `periodUsedMessages`, `usageByType`.

- [ ] **Step 1: Write failing test**

```ts
// backend/test/periodic-quota.spec.ts
import { UsersService } from '../src/modules/users/users.service';

describe('UsersService periodic quota', () => {
  function makeService(userRow: any) {
    const repo: any = {
      findOne: async () => userRow,
      create: (d: any) => d,
      save: async (u: any) => { Object.assign(userRow, u); return userRow; },
      createQueryBuilder: () => {
        throw new Error('raw path not used in unit test');
      },
    };
    return { service: new UsersService(repo), userRow };
  }

  it('starts the period on first consumption when periodStart is empty', async () => {
    const { service, userRow } = makeService({ id: 'u1', periodUsedTokens: 0, periodUsedMessages: 0, usageByType: {} });
    await service.syncPeriod(userRow as any, 6);
    expect(userRow.periodStart).toBeTruthy();
    expect(userRow.periodUsedTokens).toBe(0);
  });

  it('resets counters when the reset window has passed', async () => {
    const stale = new Date(Date.now() - 7 * 3600_000);
    const { service, userRow } = makeService({ id: 'u1', periodStart: stale, periodUsedTokens: 500, periodUsedMessages: 9, usageByType: { normal: 500 } });
    await service.syncPeriod(userRow as any, 6);
    expect(userRow.periodUsedTokens).toBe(0);
    expect(userRow.periodUsedMessages).toBe(0);
    expect(new Date(userRow.periodStart).getTime()).toBeGreaterThan(stale.getTime());
  });

  it('keeps counters inside the window', async () => {
    const recent = new Date(Date.now() - 1 * 3600_000);
    const { service, userRow } = makeService({ id: 'u1', periodStart: recent, periodUsedTokens: 500, periodUsedMessages: 9, usageByType: {} });
    await service.syncPeriod(userRow as any, 6);
    expect(userRow.periodUsedTokens).toBe(500);
    expect(userRow.periodUsedMessages).toBe(9);
  });

  it('never resets when resetHours is 0', async () => {
    const stale = new Date(Date.now() - 100 * 3600_000);
    const { service, userRow } = makeService({ id: 'u1', periodStart: stale, periodUsedTokens: 500, periodUsedMessages: 9, usageByType: {} });
    await service.syncPeriod(userRow as any, 0);
    expect(userRow.periodUsedTokens).toBe(500);
  });

  it('incrementUsage updates lifetime, period and per-type buckets', async () => {
    const { service, userRow } = makeService({ id: 'u1', usedTokens: 100, periodUsedTokens: 0, periodUsedMessages: 0, usageByType: {} });
    await service.incrementUsage('u1', 300, 'image', 1);
    expect(userRow.usedTokens).toBe(400);
    expect(userRow.periodUsedTokens).toBe(300);
    expect(userRow.periodUsedMessages).toBe(1);
    expect(userRow.usageByType.image).toBe(300);
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npx jest test/periodic-quota.spec.ts` → FAIL.

- [ ] **Step 3: Implement in `users.service.ts`**

```ts
/** ریست تنبل دوره سهمیه — resetHours<=0 یعنی هرگز ریست نشود. */
async syncPeriod(user: User, resetHours: number): Promise<User> {
  if (!user || resetHours <= 0) return user;
  const now = new Date();
  if (!user.periodStart) {
    user.periodStart = now;
    await this.repo.save(user);
    return user;
  }
  const elapsed = now.getTime() - new Date(user.periodStart).getTime();
  if (elapsed >= resetHours * 3600_000) {
    user.periodStart = now;
    user.periodUsedTokens = 0;
    user.periodUsedMessages = 0;
    await this.repo.save(user);
  }
  return user;
}

/** ثبت مصرف: مادام‌العمر + دوره جاری + سطل نوع کار. */
async incrementUsage(userId: string, tokens: number, taskType: string = 'normal', messages = 1): Promise<void> {
  const user = await this.findById(userId);
  if (!user) return;
  const t = Math.max(0, Math.floor(tokens));
  user.usedTokens = (user.usedTokens || 0) + t;
  user.periodUsedTokens = (user.periodUsedTokens || 0) + t;
  user.periodUsedMessages = (user.periodUsedMessages || 0) + Math.max(0, Math.floor(messages));
  const buckets = { ...(user.usageByType || {}) };
  buckets[taskType] = (buckets[taskType] || 0) + t;
  user.usageByType = buckets;
  if (!user.periodStart) user.periodStart = new Date();
  await this.repo.save(user);
}
```

Also in `listWithStats()` add to the select array: `u.messageLimit AS "messageLimit"`, `u."periodStart" AS "periodStart"`, `u."periodUsedTokens" AS "periodUsedTokens"`, `u."periodUsedMessages" AS "periodUsedMessages"`, `u."usageByType" AS "usageByType"` (and mirror in the fallback `find` path — entity fields flow automatically there). In `updateByAdmin()` copy `messageLimit` the same way as `tokenLimit`.

- [ ] **Step 4: Run tests** — `npx jest test/periodic-quota.spec.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/users/users.service.ts backend/test/periodic-quota.spec.ts
git commit -m "feat(users): lazy period reset + per-type usage increments"
```

---

### Task 4: ChatService — quota enforcement (tokens + messages), task-type detection, structured block

**Files:**
- Create: `backend/src/modules/chat/quota.exception.ts`
- Modify: `backend/src/modules/chat/chat.service.ts` (replace the quota block at ~line 277, replace both `incrementUsedTokens` call sites, add `getQuotaState`)
- Test: `backend/test/chat-quota-enforcement.spec.ts` (new)

**Interfaces:**
- Consumes: `getRoleQuotas`, `syncPeriod`, `incrementUsage`, `DEFAULT_RESET_HOURS` (Tasks 2–3).
- Produces:
  - `QuotaExceededException(reason: 'tokens'|'messages', resetAt: Date)` → HTTP 400 body `{ message, error: 'QUOTA_EXCEEDED', reason, resetAt }`.
  - `ChatService.getQuotaState(userId: string): Promise<QuotaState>` where
    `QuotaState = { blocked: boolean; reason: 'tokens'|'messages'|null; remainingTokens: number|null; remainingMessages: number|null; remainingPercent: number|null; resetAt: string|null }`.
  - `private detectTaskType(attachments?: {fileType?: string}[], hasThinking?: boolean): 'normal'|'image'|'document'|'thinking'`.

- [ ] **Step 1: Create the exception**

```ts
// backend/src/modules/chat/quota.exception.ts
import { BadRequestException } from '@nestjs/common';

export class QuotaExceededException extends BadRequestException {
  constructor(
    public reason: 'tokens' | 'messages',
    public resetAt: Date | null,
  ) {
    super({
      message:
        reason === 'tokens'
          ? 'سهمیه توکن شما در این دوره به پایان رسیده است.'
          : 'سقف تعداد پیام‌های شما در این دوره پر شده است.',
      error: 'QUOTA_EXCEEDED',
      reason,
      resetAt,
    });
  }
}
```

- [ ] **Step 2: Write failing tests** (fakes pattern identical to `admin-panel.spec.ts` quota tests)

```ts
// backend/test/chat-quota-enforcement.spec.ts
import { ChatService } from '../src/modules/chat/chat.service';

function build(user: any, settings: any): ChatService {
  const usersService: any = {
    findById: async () => user,
    incrementUsage: async () => {},
    syncPeriod: async (u: any) => u,
  };
  const convRepo: any = { findOne: async () => ({ id: 'c1', userId: 'u1', modelId: 'm1' }) };
  const msgRepo: any = { count: async () => 1, create: (d: any) => d, save: async (d: any) => d, find: async () => [] };
  const modelsService: any = {
    getRawById: async () => ({ id: 'm1', isActive: true }),
    getDefault: async () => ({ id: 'm1' }),
    resolveProvider: async () => ({ isActive: true }),
  };
  return new ChatService(convRepo, msgRepo, modelsService, { resolveTarget: () => null } as any, settings, usersService);
}

describe('ChatService periodic quota enforcement', () => {
  const baseSettings = (roleQuotas: any, globalTokenLimit = 0) => ({
    getRoleQuotas: async () => roleQuotas,
    getGlobalTokenLimit: async () => globalTokenLimit,
    getSystemPrompt: async () => 'p',
  });

  it('blocks when period tokens are exhausted (role quota)', async () => {
    const user = { id: 'u1', role: 'user', usedTokens: 100, periodUsedTokens: 500, periodUsedMessages: 1, periodStart: new Date() };
    const gen = build(user, baseSettings({ user: { tokenLimit: 500, messageLimit: null, resetHours: 6 } })).generate('u1', 'c1', 'Hi');
    await expect(gen.next()).rejects.toMatchObject({ response: { error: 'QUOTA_EXCEEDED', reason: 'tokens' } });
  });

  it('blocks on message cap even with tokens left', async () => {
    const user = { id: 'u1', role: 'user', usedTokens: 10, periodUsedTokens: 10, periodUsedMessages: 100, periodStart: new Date() };
    const gen = build(user, baseSettings({ user: { tokenLimit: 5000, messageLimit: 100, resetHours: 6 } })).generate('u1', 'c1', 'Hi');
    await expect(gen.next()).rejects.toMatchObject({ response: { error: 'QUOTA_EXCEEDED', reason: 'messages' } });
  });

  it('personal messageLimit wins over role messageLimit', async () => {
    const user = { id: 'u1', role: 'user', usedTokens: 0, periodUsedTokens: 0, periodUsedMessages: 5, messageLimit: 5, periodStart: new Date() };
    const gen = build(user, baseSettings({ user: { tokenLimit: 9999, messageLimit: 999, resetHours: 6 } })).generate('u1', 'c1', 'Hi');
    await expect(gen.next()).rejects.toMatchObject({ response: { reason: 'messages' } });
  });

  it('passes while within quota and no reset has happened', async () => {
    const user = { id: 'u1', role: 'user', usedTokens: 5, periodUsedTokens: 5, periodUsedMessages: 1, periodStart: new Date() };
    const gen = build(user, baseSettings({ user: { tokenLimit: 500, messageLimit: 100, resetHours: 6 } })).generate('u1', 'c1', 'Hi');
    const first = await gen.next();
    expect(first.done).toBeFalsy();
  });

  it('getQuotaState reports remaining + blocked + resetAt', async () => {
    const user = { id: 'u1', role: 'user', usedTokens: 400, periodUsedTokens: 400, periodUsedMessages: 1, periodStart: new Date() };
    const svc = build(user, baseSettings({ user: { tokenLimit: 500, messageLimit: 10, resetHours: 6 } }));
    const state = await (svc as any).getQuotaState('u1');
    expect(state.blocked).toBe(false);
    expect(state.remainingTokens).toBe(100);
    expect(state.remainingPercent).toBe(20);
    expect(state.resetAt).toBeTruthy();
  });
});
```

- [ ] **Step 3: Run to verify failure.**

- [ ] **Step 4: Implement in `chat.service.ts`**

Replace the current three-tier block inside `generate()` with:

```ts
// --- Quota enforcement (period counters; lazy reset; user > role > global) ---
if (typeof this.users?.findById === 'function') {
  const user = await this.users.findById(userId);
  if (user) {
    await this.assertQuota(user);
  }
}
```

Add private helpers + public state method:

```ts
private async resolveQuota(user: any): Promise<{
  tokenLimit: number; messageLimit: number | null; resetHours: number; resetAt: Date | null;
}> {
  const roleQuotas = this.settings?.getRoleQuotas ? await this.settings.getRoleQuotas() : {};
  const rq = roleQuotas[user.role] || {};
  let tokenLimit = user.tokenLimit ?? rq.tokenLimit ?? null;
  if (tokenLimit === null && this.settings) tokenLimit = await this.settings.getGlobalTokenLimit();
  const messageLimit = user.messageLimit ?? rq.messageLimit ?? null;
  const resetHours = rq.resetHours ?? DEFAULT_RESET_HOURS;
  const resetAt = user.periodStart
    ? new Date(new Date(user.periodStart).getTime() + resetHours * 3600_000)
    : new Date(Date.now() + resetHours * 3600_000);
  return { tokenLimit: tokenLimit || 0, messageLimit, resetHours, resetAt };
}

private async assertQuota(user: any): Promise<void> {
  const q = await this.resolveQuota(user);
  if (typeof this.users?.syncPeriod === 'function') await this.users.syncPeriod(user, q.resetHours);
  const usedTokens = user.periodUsedTokens || 0;
  const usedMessages = user.periodUsedMessages || 0;
  if (q.tokenLimit > 0 && usedTokens >= q.tokenLimit) throw new QuotaExceededException('tokens', q.resetAt);
  if (q.messageLimit && q.messageLimit > 0 && usedMessages >= q.messageLimit) {
    throw new QuotaExceededException('messages', q.resetAt);
  }
}

async getQuotaState(userId: string): Promise<any> {
  const user = await this.users.findById(userId);
  if (!user) return { blocked: false, reason: null, remainingTokens: null, remainingMessages: null, remainingPercent: null, resetAt: null };
  const q = await this.resolveQuota(user);
  if (typeof this.users?.syncPeriod === 'function') await this.users.syncPeriod(user, q.resetHours);
  const usedTokens = user.periodUsedTokens || 0;
  const usedMessages = user.periodUsedMessages || 0;
  const blockedTokens = q.tokenLimit > 0 && usedTokens >= q.tokenLimit;
  const blockedMessages = !!q.messageLimit && q.messageLimit > 0 && usedMessages >= q.messageLimit;
  const remainingTokens = q.tokenLimit > 0 ? Math.max(0, q.tokenLimit - usedTokens) : null;
  const remainingMessages = q.messageLimit && q.messageLimit > 0 ? Math.max(0, q.messageLimit - usedMessages) : null;
  const remainingPercent =
    q.tokenLimit > 0 ? Math.max(0, Math.round(((q.tokenLimit - usedTokens) / q.tokenLimit) * 100)) : null;
  return {
    blocked: blockedTokens || blockedMessages,
    reason: blockedMessages ? 'messages' : blockedTokens ? 'tokens' : null,
    remainingTokens, remainingMessages, remainingPercent,
    resetAt: q.resetAt?.toISOString() ?? null,
  };
}

private detectTaskType(attachments?: any[], hasThinking = false): string {
  if (hasThinking) return 'thinking';
  if (attachments?.some((a) => a?.fileType === 'image')) return 'image';
  if (attachments?.some((a) => ['pdf', 'excel', 'text'].includes(a?.fileType))) return 'document';
  return 'normal';
}
```

Import: `import { QuotaExceededException } from './quota.exception';` and `import { DEFAULT_RESET_HOURS } from '../admin/settings.service';`

Replace BOTH `incrementUsedTokens(...)` call sites (mock echo ~line 458 and real stream ~line 573) with:

```ts
const taskType = this.detectTaskType(attachments, options?.useWebSearch && false); // thinking flag wired in Phase 2
await this.users.incrementUsage(userId, tokens, taskType, 1);
```

(The exact `attachments` variable name at each call site must be reused — inspect surrounding code; the mock path has none → `'normal'`.)

- [ ] **Step 5: Run tests** — new spec PASS; run FULL backend suite and add `incrementUsage: async () => {}` + `syncPeriod: async (u: any) => u` to any failing fakes (e.g. `admin-panel.spec.ts` users fakes).

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/chat backend/test/chat-quota-enforcement.spec.ts backend/test
git commit -m "feat(chat): periodic quota enforcement + structured QUOTA_EXCEEDED"
```

---

### Task 5: GET /chat/quota endpoint

**Files:**
- Modify: `backend/src/modules/chat/chat.controller.ts` (add route + `@UseInterceptors(QuotaInterceptor)` here in Task 6; route alone now)
- Test: `backend/test/chat-quota-endpoint.spec.ts` (new, e2e-lite with controller instantiation or TestingModule like `admin-panel.spec.ts`)

**Interfaces:**
- Produces: `GET /chat/quota` → envelope `data: QuotaState` (Task 4 shape).

- [ ] **Step 1: Failing test** — TestingModule with `ChatController` + fakes (copy provider list from `admin-panel.spec.ts` `beforeAll`), assert:

```ts
it('returns quota state for the current user', async () => {
  currentUserRole = 'user';
  const res = await request(app.getHttpServer()).get('/chat/quota').set('Authorization', 'Bearer token');
  expect(res.status).toBe(200);
  expect(res.body.data).toHaveProperty('blocked');
  expect(res.body.data).toHaveProperty('remainingTokens');
});
```

- [ ] **Step 2: Verify failure → implement:**

```ts
@Get('quota')
@UseGuards(JwtAuthGuard)
async getQuota(@CurrentUser() user: any) {
  return this.chatService.getQuotaState(user.sub);
}
```

(Match the controller's existing auth/guard style and base path — if the controller is `@Controller('chat')` the path is `/chat/quota`.)

- [ ] **Step 3: Run test → PASS. Commit:**

```bash
git add backend/src/modules/chat/chat.controller.ts backend/test/chat-quota-endpoint.spec.ts
git commit -m "feat(chat): GET /chat/quota endpoint"
```

---

### Task 6: QuotaInterceptor (backend header stamping)

**Files:**
- Create: `backend/src/shared/quota.interceptor.ts`
- Modify: `backend/src/modules/chat/chat.controller.ts` (class-level `@UseInterceptors(QuotaInterceptor)`), `backend/src/modules/users/users.controller.ts` (same), both modules' providers lists (`chat.module.ts`, `users.module.ts`)
- Test: `backend/test/quota-interceptor.spec.ts` (new)

**Interfaces:**
- Consumes: `ChatService.getQuotaState` (Task 4), `UsersService.findById`.
- Produces: response header `X-User-Quota` = base64(JSON QuotaState) on every authed chat/users response.

- [ ] **Step 1: Failing test**

```ts
// backend/test/quota-interceptor.spec.ts
import { QuotaInterceptor } from '../src/shared/quota.interceptor';

describe('QuotaInterceptor', () => {
  it('stamps X-User-Quota header from getQuotaState', async () => {
    const chat: any = { getQuotaState: async (id: string) => ({ blocked: false, remainingPercent: 84, id }) };
    const users: any = { findById: async () => ({ id: 'u1' }) };
    const interceptor = new QuotaInterceptor(chat, users);

    const req: any = { user: { sub: 'u1' }, headers: {} };
    const resHeader: Record<string, string> = {};
    const res: any = { set: (k: string, v: string) => { resHeader[k] = v; } };
    const ctx: any = {
      switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
      getType: () => 'http',
    };
    const next = { handle: () => new Promise((r) => r('ok')) };
    const result = await interceptor.intercept(ctx as any, next as any);
    expect(result).toBe('ok');
    const decoded = JSON.parse(Buffer.from(resHeader['X-User-Quota'], 'base64').toString('utf8'));
    expect(decoded.remainingPercent).toBe(84);
  });

  it('skips stamping when no user (public routes)', async () => {
    const chat: any = { getQuotaState: async () => { throw new Error('must not be called'); } };
    const users: any = {};
    const interceptor = new QuotaInterceptor(chat, users);
    const req: any = { headers: {} };
    const res: any = { set: () => {} };
    const ctx: any = {
      switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
      getType: () => 'http',
    };
    const result = await interceptor.intercept(ctx as any, { handle: () => new Promise((r) => r('ok')) } as any);
    expect(result).toBe('ok');
  });
});
```

- [ ] **Step 2: Verify failure → implement**

```ts
// backend/src/shared/quota.interceptor.ts
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { ChatService } from '../modules/chat/chat.service';

@Injectable()
export class QuotaInterceptor implements NestInterceptor {
  constructor(private chat: ChatService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const userId = request?.user?.sub;
    if (!userId) return next.handle();

    return next.handle().pipe(
      tap(async () => {
        try {
          const state = await this.chat.getQuotaState(userId);
          response.set('X-User-Quota', Buffer.from(JSON.stringify(state)).toString('base64'));
        } catch {
          // سهمیه هرگز نباید مسیر پاسخ را بشکند
        }
      }),
    );
  }
}
```

Wire: in `chat.module.ts` + `users.module.ts` add `QuotaInterceptor` to `providers` (users module imports ChatModule? — if circular, inject `ChatService` via `ModuleRef`/`Inject(forwardRef)`; prefer adding `ChatModule` import if not already, or compute state directly with `UsersService + SettingsService` in the interceptor instead of `ChatService` — choose the non-circular option at implementation time and keep the same header contract).

- [ ] **Step 3: Run test → PASS. Run full backend suite.**

- [ ] **Step 4: Commit**

```bash
git add backend/src/shared backend/src/modules/chat/chat.controller.ts backend/src/modules/users backend/test/quota-interceptor.spec.ts
git commit -m "feat(quota): stamp X-User-Quota header via interceptor"
```

---

### Task 7: Admin users list — usedCostUsd

**Files:**
- Modify: `backend/src/modules/admin/admin-users.controller.ts`
- Test: extend `backend/test/admin-panel.spec.ts`

**Interfaces:**
- Consumes: `user.usageByType` (Task 3), `settings.getTaskMultipliers()` + `settings.getTokenRatePer1000()` (Task 2).
- Produces: each admin users-list row gains `usedCostUsd: number` = `Σ usageByType[t] × rate × (t === 'normal' ? 1 : multipliers[t] ?? 1) / 1000`.

- [ ] **Step 1: Failing test** (extend the effectiveTokenLimit test's describe):

```ts
it('GET /admin/users computes usedCostUsd from usageByType with multipliers', async () => {
  currentUserRole = 'admin';
  fakeUsers[1].usageByType = { normal: 500, image: 1000 }; // rate=10, image ×1.5 in fake? extend fakeSettingsService with getTaskMultipliers + getTokenRatePer1000
  const res = await request(app.getHttpServer()).get('/admin/users').set('Authorization', 'Bearer token');
  const userRow = res.body.data.find((u: any) => u.id === 'user-id');
  // normal: 500×10/1000 = 5 ; image: 1000×10×1.5/1000 = 15 → 20
  expect(userRow.usedCostUsd).toBeCloseTo(20, 5);
});
```

(Extend `fakeSettingsService` with `getTaskMultipliers: async () => ({ image: 1.5 })` and `getTokenRatePer1000: async () => 10`.)

- [ ] **Step 2: Verify failure → implement** in `AdminUsersController.listUsers` mapping step:

```ts
const [all, roleLimits, globalLimit, multipliers, rate] = await Promise.all([
  this.users.listWithStats(),
  this.settings.getRoleTokenLimits(),
  this.settings.getGlobalTokenLimit(),
  this.settings.getTaskMultipliers().catch(() => ({})),
  this.settings.getTokenRatePer1000().catch(() => 10),
]);
const costOf = (u: any): number => {
  const buckets = u.usageByType || {};
  return Object.entries(buckets).reduce((sum, [type, tokens]) => {
    const mult = type === 'normal' ? 1 : (multipliers as any)[type] ?? 1;
    return sum + (Number(tokens) * rate * mult) / 1000;
  }, 0);
};
const withEffective = all.map((u: any) => ({
  ...u,
  effectiveTokenLimit: resolveEffectiveTokenLimit(u, roleLimits, globalLimit),
  usedCostUsd: Number(costOf(u).toFixed(4)),
}));
```

- [ ] **Step 3: Run backend suite → PASS. Commit:**

```bash
git add backend/src/modules/admin/admin-users.controller.ts backend/test/admin-panel.spec.ts
git commit -m "feat(admin): per-task-type usedCostUsd on users list"
```

---

### Task 8: Frontend — QuotaState type, quota store, api.ts hook, chatService.getQuota

**Files:**
- Modify: `frontend/src/types/index.ts`, `frontend/src/services/api.ts`, `frontend/src/services/chat.service.ts`
- Create: `frontend/src/stores/quota.ts`
- Test: `frontend/tests/quota-store.spec.ts`

**Interfaces:**
- Produces:
  - `type QuotaState = { blocked: boolean; reason: 'tokens'|'messages'|null; remainingTokens: number|null; remainingMessages: number|null; remainingPercent: number|null; resetAt: string|null }` (types/index.ts)
  - `useQuotaStore` — state `{ blocked, reason, remainingPercent, remainingTokens, remainingMessages, resetAt, loaded }`; computed `statusColor` (same thresholds as admin table: >50 emerald-500, 20–50 amber-500, <20 rose-500); actions `applySnapshot(q)`, `refresh()` (calls `chatService.getQuota()`, silent-catch).
  - `chatService.getQuota(): Promise<QuotaState>` → `request('/chat/quota')`.
  - `request()` reads `x-user-quota` response header → dynamic-imports quota store → `applySnapshot`.

- [ ] **Step 1: Failing test**

```ts
// frontend/tests/quota-store.spec.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useQuotaStore } from '../src/stores/quota'

describe('useQuotaStore', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('applies a snapshot', () => {
    const s = useQuotaStore()
    s.applySnapshot({ blocked: false, reason: null, remainingPercent: 84, remainingTokens: 4200, remainingMessages: 99, resetAt: '2026-09-18T21:30:00Z' })
    expect(s.remainingPercent).toBe(84)
    expect(s.blocked).toBe(false)
    expect(s.statusColor).toContain('emerald')
  })

  it('colors by remaining thresholds', () => {
    const s = useQuotaStore()
    s.applySnapshot({ blocked: false, reason: null, remainingPercent: 35, remainingTokens: 1, remainingMessages: 1, resetAt: null })
    expect(s.statusColor).toContain('amber')
    s.applySnapshot({ blocked: true, reason: 'tokens', remainingPercent: 5, remainingTokens: 0, remainingMessages: 0, resetAt: null })
    expect(s.statusColor).toContain('rose')
  })

  it('null remainingPercent (unlimited) renders emerald ∞ semantics', () => {
    const s = useQuotaStore()
    s.applySnapshot({ blocked: false, reason: null, remainingPercent: null, remainingTokens: null, remainingMessages: null, resetAt: null })
    expect(s.statusColor).toContain('emerald')
  })
})
```

- [ ] **Step 2: Verify failure → implement store + types + service + api hook.**

`api.ts` — inside `request()`, right after `const response = await fetch(...)` and before 204 handling:

```ts
// Quota sync: بک‌اند سهمیه کاربر را روی هر پاسخ چت/پروفایل مهر می‌زند
const quotaHeader = response.headers.get('x-user-quota')
if (quotaHeader && !endpoint.includes('/auth/')) {
  try {
    const snapshot = JSON.parse(atob(quotaHeader))
    import('../stores/quota').then(({ useQuotaStore }) => useQuotaStore().applySnapshot(snapshot)).catch(() => {})
  } catch { /* ignore malformed */ }
}
```

- [ ] **Step 3: Run frontend tests → PASS. Commit:**

```bash
git add frontend/src/types/index.ts frontend/src/services frontend/src/stores/quota.ts frontend/tests/quota-store.spec.ts
git commit -m "feat(front): quota store + X-User-Quota sync in request wrapper"
```

---

### Task 9: ProfileMenu — non-clickable remaining-% item

**Files:**
- Modify: `frontend/src/components/layout/ProfileMenu.vue`
- Test: `frontend/tests/ProfileMenu.quota.spec.ts` (new)

- [ ] **Step 1: Failing test**

```ts
// mount ProfileMenu with pinia + stubbed emits; seed useQuotaStore snapshot
it('shows non-clickable remaining percent at the top with status color', () => {
  const pinia = createPinia(); setActivePinia(pinia)
  useQuotaStore().applySnapshot({ blocked: false, reason: null, remainingPercent: 84, remainingTokens: 1, remainingMessages: 1, resetAt: null })
  const w = mount(ProfileMenu, { global: { plugins: [pinia] } })
  const item = w.find('[data-testid="quota-summary"]')
  expect(item.exists()).toBe(true)
  expect((item.element as HTMLElement).tagName).not.toBe('BUTTON')
  expect(item.text()).toContain('۸۴٪') // یا '84٪' بسته به toLocaleString — با مقدار ذخیره‌شده مطابقت دهید
  expect(item.classes().join(' ')).toContain('emerald')
})
```

- [ ] **Step 2: Implement** — top of the panel, before the first button:

```html
<!-- Quota summary: display-only -->
<div v-if="quotaStore.loaded && quotaStore.remainingPercent !== null" data-testid="quota-summary" class="quota-summary px-2.5 py-1.5 rounded-lg bg-muted/40 border border-border text-center" role="presentation" aria-readonly="true">
  <span class="font-mono text-xs font-bold" :class="quotaStore.statusColor">{{ quotaStore.remainingPercent }}٪ باقی‌مانده</span>
</div>
```

`const quotaStore = useQuotaStore()` + on mount/menu-open trigger `quotaStore.refresh().catch(() => {})` (parent already mounts the menu on open; add `onMounted` here). Add the `.quota-summary` display style following the file's existing scoped style block.

- [ ] **Step 3: Run → PASS. Existing ProfileMenu.spec must stay green. Commit:**

```bash
git add frontend/src/components/layout/ProfileMenu.vue frontend/tests/ProfileMenu.quota.spec.ts
git commit -m "feat(profile): remaining quota percent in profile menu"
```

---

### Task 10: Chat gating — composer disable + banner + new-chat disable

**Files:**
- Modify: `frontend/src/components/chat/ChatComposer.vue`, `frontend/src/components/layout/AppSidebar.vue`, and the chat store wiring in `frontend/src/stores/chat.ts` (`refreshQuota()` after stream end — inside `finishStream`, call `useQuotaStore().refresh().catch(() => {})` one level above the store or via a callback; prefer calling `refresh()` from the component after `stopStreaming`/stream end events to avoid store-to-store coupling)
- Test: `frontend/tests/chat-composer-quota.spec.ts` (new)

**Behavior:**
- Composer: `:disabled="quotaStore.blocked || existingDisabled"` and a banner above the composer when `quotaStore.blocked`:
  `<div data-testid="quota-block-banner" class="...">تا ساعت {{ formatResetTime(quotaStore.resetAt) }} امکان ارسال پیام ندارید.</div>`
- `formatResetTime` uses the existing `IranDate` util to render `HH:mm` (fall back to raw HH:mm if util lacks it).
- New-chat buttons in `AppSidebar.vue`: add `:disabled` / early-return when `quotaStore.blocked` with toast «سهمیه شما به پایان رسیده است؛ تا ساعت X.»
- After each stream finishes (success/failure) call `useQuotaStore().refresh()` so the block appears the moment the cap is hit.

- [ ] **Step 1: Failing test** (mount ChatComposer with pinia; seed blocked store; assert textarea disabled + banner text).

- [ ] **Step 2: Implement. Step 3: Run frontend suite → PASS (all prior specs green).**

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/chat/ChatComposer.vue frontend/src/components/layout/AppSidebar.vue frontend/src/stores/chat.ts frontend/tests/chat-composer-quota.spec.ts
git commit -m "feat(chat): block composer & new chat when quota exhausted + reset banner"
```

---

### Task 11: Admin UI — multipliers card, role-quota modal fields, user messageLimit, cost column source

**Files:**
- Modify: `frontend/src/views/admin/AdminPromptsSection.vue` (new card + move default-rate field), `frontend/src/components/admin/modals/RoleTokenLimitModal.vue` (+ messageLimit, resetHours), `frontend/src/components/admin/modals/UserEditorModal.vue` (+ messageLimit field), `frontend/src/views/admin/AdminUsersSection.vue` (cost from `usedCostUsd`), `frontend/src/services/admin.service.ts` + `frontend/src/types/index.ts` (types)
- Create: `frontend/src/components/admin/modals/TaskMultiplierModal.vue`
- Test: `frontend/tests/TaskMultiplierModal.spec.ts` (new), extend `RoleTokenLimitModal.spec.ts`

**Interfaces:**
- Consumes: `settings.taskMultipliers`, `settings.roleQuotas`, `user.usedCostUsd` (backend Tasks 2/7).
- Produces:
  - `TaskMultiplierModal` — props `{ open, taskType, taskLabel, currentMultiplier, tokenRatePer1000, isSaving }`; emits `save: [{ taskType, multiplier: number|null }]`.
  - `RoleTokenLimitModal` save payload becomes `{ role, quota: { tokenLimit: number|null, messageLimit: number|null, resetHours: number|null } }`.
  - `AdminPromptsSection.handleSaveRoleLimit` → `adminService.updateSettings({ roleQuotas: { [role]: quota } })`.
  - Multiplier card: rows normal (×۱ مبنا, no edit) / image / document / thinking; columns: نوع کار | ضریب | نرخ مؤثر (rate × mult) | هر پیام متوسط ≈ (avgTokens × effectiveRate / 1000; avgTokens from `adminService.getDashboardStats()` → `totalTokensUsed / max(1,totalMessages)`, fallback 500).
  - Roles table columns become: نقش | سقف توکن | حداکثر پیام | دوره ریست | ویرایش (reset cell: `هر N ساعت` or `بدون ریست`).
  - `AdminUsersSection` cost line: `${{ user.usedCostUsd ?? tokensToDollars(user.usedTokens) }} مصرفی`.

- [ ] **Step 1: Failing tests** — `TaskMultiplierModal.spec.ts` (renders multiplier, emits save with entered value, empty → null) + `RoleTokenLimitModal.spec.ts` additions (messageLimit + resetHours default 6 emitted in quota payload).

- [ ] **Step 2: Implement** components + section wiring (same AdminModal/BaseButton patterns; save handlers call `updateSettings` then `loadSettings()`; optimistic rollback with toast on error per `AdminModelsSection.setPlatformDefault` pattern).

- [ ] **Step 3: Run frontend suite → PASS. Commit:**

```bash
git add frontend/src/views/admin frontend/src/components/admin frontend/src/services/admin.service.ts frontend/src/types/index.ts frontend/tests
git commit -m "feat(admin): task multipliers table + role/user message caps + live cost"
```

---

### Task 12: Final verification + docs

- [ ] `cd backend && npm run lint && npm run test && npm run test:e2e` — all green.
- [ ] `cd frontend && npm run build && npm run test` — all green.
- [ ] Manual smoke (dev run): admin sets role quota `{tokenLimit:100, messageLimit:2, resetHours:6}` → user sends 3 messages → 3rd blocked with banner + composer disabled + ProfileMenu shows red %; after period passes (or quota GET), sending works again; admin changes image multiplier → users-table `$` updates on reload.
- [ ] Update `docs/wiki/features.md` (Task 38 entry), `CHANGELOG.md` ([1.4.0] Added), and `docs/wiki/architecture.md` if quota state flow added.
- [ ] Commit docs:

```bash
git add docs
git commit -m "docs: periodic quotas + task multipliers wiki & changelog"
```
