import { SettingsService, DEFAULT_WEB_SEARCH_MULTIPLIER, DEFAULT_THINKING_MULTIPLIER } from '../src/modules/admin/settings.service';

describe('SettingsService Token Tariffs', () => {
  let service: SettingsService;
  let fakeRepo: any;
  let memory: Record<string, string>;

  beforeEach(() => {
    memory = {};
    fakeRepo = {
      findOne: jest.fn(async ({ where }: any) => (memory[where.key] !== undefined ? { key: where.key, value: memory[where.key] } : null)),
      create: jest.fn((dto: any) => ({ ...dto })),
      save: jest.fn(async (entity: any) => {
        memory[entity.key] = entity.value;
        return entity;
      }),
    };
    service = new SettingsService(fakeRepo);
  });

  it('returns default multipliers 1.2 and 1.3 when unset', async () => {
    expect(DEFAULT_WEB_SEARCH_MULTIPLIER).toBe(1.2);
    expect(DEFAULT_THINKING_MULTIPLIER).toBe(1.3);
    expect(await service.getWebSearchMultiplier()).toBe(1.2);
    expect(await service.getThinkingMultiplier()).toBe(1.3);
  });

  it('saves and retrieves customized multipliers', async () => {
    await service.update({ webSearchMultiplier: 1.5, thinkingMultiplier: 1.8 } as any);
    expect(await service.getWebSearchMultiplier()).toBe(1.5);
    expect(await service.getThinkingMultiplier()).toBe(1.8);
  });

  it('includes multipliers in getAll()', async () => {
    const all = await service.getAll();
    expect(all.webSearchMultiplier).toBe(1.2);
    expect(all.thinkingMultiplier).toBe(1.3);
  });
});
