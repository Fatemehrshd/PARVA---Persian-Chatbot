import { SettingsService, resolveEffectiveTokenLimit } from '../src/modules/admin/settings.service';
import { ChatService } from '../src/modules/chat/chat.service';
import { BadRequestException } from '@nestjs/common';

describe('Role-based token limits', () => {
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

    it('global 0 means unlimited', () => {
      expect(resolveEffectiveTokenLimit({ role: 'premium' }, roleLimits, 0)).toBeNull();
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
  });
});
