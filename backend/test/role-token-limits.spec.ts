import {
  SettingsService,
  resolveEffectiveTokenLimit,
  resolveLimitSource,
  resolveEffectiveMessageLimit,
} from '../src/modules/admin/settings.service';
import { ChatService } from '../src/modules/chat/chat.service';
import { BadRequestException } from '@nestjs/common';
import { UsersService } from '../src/modules/users/users.service';
import { plainToInstance } from 'class-transformer';
import { UpdateSettingsDto } from '../src/modules/admin/dto';

describe('Role-based token limits', () => {
  describe('UsersService periodic quota', () => {
    function makeUsersService(userRow: any) {
      const repo: any = {
        findOne: async () => userRow,
        save: async (user: any) => {
          Object.assign(userRow, user);
          return userRow;
        },
      };
      return { service: new UsersService(repo), userRow };
    }

    it('starts and lazily resets a period', async () => {
      const first = makeUsersService({ id: 'u1', periodUsedTokens: 0, periodUsedMessages: 0 });
      await first.service.syncPeriod(first.userRow as any, 6);
      expect(first.userRow.periodStart).toBeTruthy();

      const stale = makeUsersService({
        id: 'u1',
        periodStart: new Date(Date.now() - 7 * 3600_000),
        periodUsedTokens: 500,
        periodUsedMessages: 9,
      });
      await stale.service.syncPeriod(stale.userRow as any, 6);
      expect(stale.userRow.periodUsedTokens).toBe(0);
      expect(stale.userRow.periodUsedMessages).toBe(0);
    });

    it('increments lifetime, period and task-type usage', async () => {
      const fixture = makeUsersService({ id: 'u1', usedTokens: 100, periodUsedTokens: 0, periodUsedMessages: 0, usageByType: {} });
      await fixture.service.incrementUsage('u1', 300, 'image', 1);
      expect(fixture.userRow.usedTokens).toBe(400);
      expect(fixture.userRow.periodUsedTokens).toBe(300);
      expect(fixture.userRow.periodUsedMessages).toBe(1);
      expect(fixture.userRow.usageByType.image).toBe(300);
    });

    it('refreshes the quota reset timestamp after a lazy period reset', async () => {
      const user = {
        id: 'u1',
        role: 'user',
        periodStart: new Date(Date.now() - 7 * 3600_000),
        periodUsedTokens: 500,
        periodUsedMessages: 9,
      };
      const users = makeUsersService(user);
      const settings: any = {
        getRoleQuotas: async () => ({ user: { tokenLimit: 1000, messageLimit: 10, resetHours: 6 } }),
        getGlobalTokenLimit: async () => 0,
      };
      const chat = new ChatService(
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        settings,
        users.service,
      );

      const state = await chat.getQuotaState('u1');

      expect(user.periodUsedTokens).toBe(0);
      expect(user.periodUsedMessages).toBe(0);
      expect(new Date(state.resetAt).getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('resolveEffectiveTokenLimit (personal > role > global)', () => {
    const roleLimits = { user: 900, vip: 0 };

    it('personal limit wins when set', () => {
      expect(resolveEffectiveTokenLimit({ tokenLimit: 100, role: 'user' }, roleLimits, 1000)).toBe(100);
    });

    it('personal 0 means unlimited regardless of role/global', () => {
      expect(resolveEffectiveTokenLimit({ tokenLimit: 0, role: 'user' }, roleLimits, 1000)).toBeNull();
    });

    it('role limit applies when no personal limit', () => {
      expect(resolveEffectiveTokenLimit({ role: 'user' }, roleLimits, 1000)).toBe(900);
    });

    it('role 0 means unlimited and skips global', () => {
      expect(resolveEffectiveTokenLimit({ role: 'vip' }, roleLimits, 1000)).toBeNull();
    });

    it('falls back to global when role has no entry', () => {
      expect(resolveEffectiveTokenLimit({ role: 'premium' }, roleLimits, 1000)).toBe(1000);
    });

    it('falls back to global when role quota has null or 0 token limit', () => {
      const roleQuotas = {
        user: { tokenLimit: null, messageLimit: null, resetHours: 6 },
      };
      expect(resolveEffectiveTokenLimit({ role: 'user' }, {}, 5000, roleQuotas)).toBe(5000);
      expect(resolveEffectiveTokenLimit({ role: 'user' }, { user: 0 }, 5000)).toBe(5000);
    });

    it('global 0 means unlimited', () => {
      expect(resolveEffectiveTokenLimit({ role: 'premium' }, roleLimits, 0)).toBeNull();
    });

    it('identifies source accurately (personal, role, global)', () => {
      expect(resolveLimitSource({ tokenLimit: 50, role: 'user' }, roleLimits)).toBe('personal');
      expect(resolveLimitSource({ role: 'user' }, roleLimits)).toBe('role');
      expect(resolveLimitSource({ role: 'other' }, roleLimits)).toBe('global');
      // When role has null or 0 quota, source is global
      expect(resolveLimitSource({ role: 'user' }, {}, { user: { tokenLimit: null, messageLimit: null, resetHours: 6 } })).toBe('global');
      expect(resolveLimitSource({ role: 'user' }, { user: 0 })).toBe('global');
    });

    it('resolves effective message limit with personal override over role quota', () => {
      const roleQuotas = {
        user: { tokenLimit: 1000, messageLimit: 10, resetHours: 6 },
      };
      // Personal override wins
      expect(resolveEffectiveMessageLimit({ messageLimit: 3, role: 'user' }, roleQuotas)).toBe(3);
      // Inherits from role when no personal limit
      expect(resolveEffectiveMessageLimit({ role: 'user' }, roleQuotas)).toBe(10);
      // Null when neither has limit
      expect(resolveEffectiveMessageLimit({ role: 'other' }, roleQuotas)).toBeNull();
    });
  });

  describe('SettingsService roundtrip', () => {
    let store: Map<string, string>;
    let repo: any;
    let settings: SettingsService;

    beforeEach(() => {
      store = new Map();
      repo = {
        findOne: async ({ where }: any) =>
          store.has(where.key) ? { key: where.key, value: store.get(where.key) } : null,
        create: (dto: any) => dto,
        save: async (row: any) => {
          store.set(row.key, row.value);
          return row;
        },
      };
      settings = new SettingsService(repo);
    });

    describe('task multipliers and periodic role quotas', () => {
      it('stores task multipliers and lazily seeds role quotas', async () => {
        await settings.setTaskMultiplier('image', 2.5);
        await settings.setRoleTokenLimit('user', 900);

        expect(await settings.getTaskMultipliers()).toEqual({ image: 2.5 });
        expect(await settings.getRoleQuotas()).toEqual({
          user: { tokenLimit: 900, messageLimit: null, resetHours: null },
        });
        expect(store.get('role_quotas')).toBeTruthy();
      });

      it('removes invalid multipliers and merges role quota updates', async () => {
        await settings.setTaskMultiplier('image', 2.5);
        await settings.setTaskMultiplier('hacked' as any, 5);
        await settings.setTaskMultiplier('image', -1);
        await settings.setRoleQuota('user', { tokenLimit: 500, messageLimit: 10, resetHours: 6 });
        await settings.setRoleQuota('admin', { tokenLimit: 0, messageLimit: null, resetHours: 0 });

        expect(await settings.getTaskMultipliers()).toEqual({});
        expect(await settings.getRoleQuotas()).toEqual({
          user: { tokenLimit: 500, messageLimit: 10, resetHours: 6 },
          admin: { tokenLimit: 0, messageLimit: null, resetHours: 0 },
        });
      });
    });

    it('stores and reads a role limit', async () => {
      await settings.setRoleTokenLimit('user', 5000);
      expect(await settings.getRoleTokenLimits()).toEqual({ user: 5000 });
    });

    it('merges per-role updates without wiping other roles', async () => {
      await settings.setRoleTokenLimit('user', 5000);
      await settings.setRoleTokenLimit('admin', 0);
      expect(await settings.getRoleTokenLimits()).toEqual({ user: 5000, admin: 0 });
    });

    it('removes a role limit when set to null', async () => {
      await settings.setRoleTokenLimit('user', 5000);
      await settings.setRoleTokenLimit('user', null);
      expect(await settings.getRoleTokenLimits()).toEqual({});
    });

    it('normalizes Persian digits in admin settings payloads before validation and storage', async () => {
      const dto = plainToInstance(UpdateSettingsDto, {
        globalTokenLimit: '۱۲۳۴',
        tokenRatePer1000: '۲٫۵',
        roleQuotas: {
          user: { tokenLimit: '۵۰۰۰', messageLimit: '۱۰', resetHours: '۶' },
        },
      });

      expect(dto.globalTokenLimit).toBe(1234);
      expect(dto.tokenRatePer1000).toBe(2.5);

      await settings.update(dto);
      expect(await settings.getGlobalTokenLimit()).toBe(1234);
      expect(await settings.getTokenRatePer1000()).toBe(2.5);
      expect(await settings.getRoleQuotas()).toEqual({
        user: { tokenLimit: 5000, messageLimit: 10, resetHours: 6 },
      });
    });

    it('drops invalid role entries instead of failing', async () => {
      await settings.setRoleTokenLimit('user', -5);
      expect(await settings.getRoleTokenLimits()).toEqual({});
    });

    it('getAll exposes roleTokenLimits', async () => {
      await settings.setRoleTokenLimit('user', 1234);
      const all = await settings.getAll();
      expect(all.roleTokenLimits).toEqual({ user: 1234 });
    });
  });

  describe('ChatService enforcement priority (personal > role > global)', () => {
    function buildChatService(user: any, settings: any): ChatService {
      const usersService: any = {
        findById: async () => user,
        incrementUsedTokens: async () => {},
      };
      const convRepo: any = {
        findOne: async () => ({ id: 'c1', userId: 'u1', modelId: 'm1' }),
        create: (dto: any) => dto,
        save: async (dto: any) => dto,
      };
      const msgRepo: any = {
        count: async () => 1,
        create: (dto: any) => dto,
        save: async (dto: any) => dto,
        find: async () => [],
      };
      const modelsService: any = {
        getRawById: async () => ({ id: 'm1', isActive: true }),
        getDefault: async () => ({ id: 'm1' }),
        resolveProvider: async () => ({ isActive: true }),
      };
      const forwarder: any = { resolveTarget: () => null };
      return new ChatService(convRepo, msgRepo, modelsService, forwarder, settings, usersService);
    }

    it('blocks when the user exceeds their role limit', async () => {
      const user = { id: 'u1', role: 'user', usedTokens: 1000 };
      const settings: any = {
        getRoleTokenLimits: async () => ({ user: 1000 }),
        getGlobalTokenLimit: async () => 0,
        getSystemPrompt: async () => 'p',
      };
      const gen = buildChatService(user, settings).generate('u1', 'c1', 'Hello');
      await expect(gen.next()).rejects.toThrow(BadRequestException);
    });

    it('role limit replaces the global check when present', async () => {
      const user = { id: 'u1', role: 'user', usedTokens: 200 };
      const settings: any = {
        getRoleTokenLimits: async () => ({ user: 5000 }),
        getGlobalTokenLimit: async () => 100, // lower, but must be ignored
        getSystemPrompt: async () => 'p',
      };
      const gen = buildChatService(user, settings).generate('u1', 'c1', 'Hello');
      const first = await gen.next();
      expect(first.done).toBeFalsy();
    });

    it('personal limit wins over the role limit', async () => {
      const user = { id: 'u1', role: 'user', usedTokens: 250, tokenLimit: 200 };
      const settings: any = {
        getRoleTokenLimits: async () => ({ user: 100000 }),
        getGlobalTokenLimit: async () => 100000,
        getSystemPrompt: async () => 'p',
      };
      const gen = buildChatService(user, settings).generate('u1', 'c1', 'Hello');
      await expect(gen.next()).rejects.toThrow('سقف مجاز مصرف توکن به پایان رسیده است');
    });

    it('falls back to the global limit when the role has no entry', async () => {
      const user = { id: 'u1', role: 'premium', usedTokens: 100 };
      const settings: any = {
        getRoleTokenLimits: async () => ({ user: 100000 }),
        getGlobalTokenLimit: async () => 100,
        getSystemPrompt: async () => 'p',
      };
      const gen = buildChatService(user, settings).generate('u1', 'c1', 'Hello');
      await expect(gen.next()).rejects.toThrow('سقف مجاز مصرف توکن به پایان رسیده است');
    });

    it('reports the remaining percentage from current-period usage after a reset', async () => {
      const user = {
        id: 'u1',
        role: 'user',
        usedTokens: 290,
        periodUsedTokens: 0,
        periodUsedMessages: 0,
        periodStart: new Date(),
      };
      const settings: any = {
        getRoleQuotas: async () => ({ user: { tokenLimit: 1000, messageLimit: null, resetHours: 6 } }),
        getGlobalTokenLimit: async () => 0,
        getSystemPrompt: async () => 'p',
      };
      const state = await buildChatService(user, settings).getQuotaState('u1');
      expect(state.remainingPercent).toBe(100);
    });

    it('personal token limit overrides role quota and blocks when exhausted', async () => {
      const user = { id: 'u1', role: 'user', tokenLimit: 50, usedTokens: 60 };
      const settings: any = {
        getRoleQuotas: async () => ({ user: { tokenLimit: 100000, messageLimit: null, resetHours: 6 } }),
        getGlobalTokenLimit: async () => 100000,
        getSystemPrompt: async () => 'p',
      };
      const gen = buildChatService(user, settings).generate('u1', 'c1', 'Hello');
      await expect(gen.next()).rejects.toThrow('سقف مجاز مصرف توکن به پایان رسیده است');
    });

    it('personal message limit overrides role quota and blocks when exhausted', async () => {
      const user = { id: 'u1', role: 'user', messageLimit: 2, periodUsedMessages: 2 };
      const settings: any = {
        getRoleQuotas: async () => ({ user: { tokenLimit: 100000, messageLimit: 10, resetHours: 6 } }),
        getGlobalTokenLimit: async () => 100000,
        getSystemPrompt: async () => 'p',
      };
      const gen = buildChatService(user, settings).generate('u1', 'c1', 'Hello');
      await expect(gen.next()).rejects.toThrow('سقف تعداد پیام‌های شما در این دوره پر شده است');
    });

    it('blocks creating a conversation when the personal token quota is exhausted', async () => {
      const user = { id: 'u1', role: 'user', tokenLimit: 20, usedTokens: 20 };
      const settings: any = {
        getRoleQuotas: async () => ({ user: { tokenLimit: 100000, messageLimit: null, resetHours: 6 } }),
        getGlobalTokenLimit: async () => 100000,
      };

      await expect(buildChatService(user, settings).create('u1', 'm1')).rejects.toThrow(
        'سقف مجاز مصرف توکن به پایان رسیده است',
      );
    });
  });
});
