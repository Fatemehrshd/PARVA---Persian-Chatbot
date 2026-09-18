import { SettingsService } from '../src/modules/admin/settings.service';

function fakeRepo(seed: Record<string, string> = {}) {
  const store = new Map<string, string>(Object.entries(seed));
  return {
    store,
    repo: {
      findOne: async ({ where }: any) =>
        store.has(where.key) ? { key: where.key, value: store.get(where.key) } : null,
      create: (o: any) => ({ ...o }),
      save: async (o: any) => {
        store.set(o.key, o.value);
        return o;
      },
    } as any,
  };
}

it('reports zero usage against the default 2500 quota', async () => {
  const { repo } = fakeRepo();
  const svc = new SettingsService(repo);
  await expect(svc.getWebSearchUsage()).resolves.toEqual({ used: 0, total: 2500, remaining: 2500 });
});

it('computes remaining from stored values and clamps at zero', async () => {
  const { repo } = fakeRepo({ web_search_used_credits: '10', web_search_quota_total: '100' });
  const svc = new SettingsService(repo);
  await expect(svc.getWebSearchUsage()).resolves.toEqual({ used: 10, total: 100, remaining: 90 });

  const over = fakeRepo({ web_search_used_credits: '3000' });
  await expect(new SettingsService(over.repo).getWebSearchUsage()).resolves.toEqual({
    used: 3000,
    total: 2500,
    remaining: 0,
  });
});

it('falls back to defaults on garbage values', async () => {
  const { repo } = fakeRepo({ web_search_used_credits: 'oops', web_search_quota_total: '-5' });
  const svc = new SettingsService(repo);
  await expect(svc.getWebSearchUsage()).resolves.toEqual({ used: 0, total: 2500, remaining: 2500 });
});

it('persists quota and used corrections via update()', async () => {
  const { repo, store } = fakeRepo();
  const svc = new SettingsService(repo);
  await svc.update({ webSearchQuotaTotal: 5000, webSearchUsedCredits: 42 } as any);
  expect(store.get('web_search_quota_total')).toBe('5000');
  expect(store.get('web_search_used_credits')).toBe('42');
  await expect(svc.getWebSearchUsage()).resolves.toEqual({ used: 42, total: 5000, remaining: 4958 });
});
