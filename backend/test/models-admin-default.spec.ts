import { ModelsAdminService } from '../src/modules/models-admin/models-admin.service';

function makeService() {
  const rows = new Map<string, any>([
    ['m1', { id: 'm1', name: 'Old', isDefault: true, apiKey: 'sk-secret-12345' }],
    ['m2', { id: 'm2', name: 'New', isDefault: false, apiKey: null }],
  ]);
  const updates: any[] = [];
  const repo: any = {
    findOne: async ({ where }: any) => rows.get(where.id) ?? null,
    // Mimics real TypeORM: empty criteria are rejected.
    update: async (criteria: any, partial: any) => {
      if (!criteria || Object.keys(criteria).length === 0) {
        throw new Error('Empty criteria(s) are not allowed for the update method.');
      }
      updates.push([criteria, partial]);
      for (const row of rows.values()) {
        const match = Object.entries(criteria).every(([k, v]) => (row as any)[k] === v);
        if (match) Object.assign(row, partial);
      }
      return { affected: 1 };
    },
    save: async (o: any) => {
      rows.set(o.id, { ...o });
      return { ...o };
    },
  };
  const svc = new ModelsAdminService(repo, {} as any);
  return { svc, rows, updates };
}

it('clears the previous default with non-empty criteria and sets the new one', async () => {
  const { svc, rows, updates } = makeService();
  const saved: any = await svc.setDefault('m2');
  expect(updates.length).toBeGreaterThan(0);
  for (const [criteria] of updates) {
    expect(Object.keys(criteria).length).toBeGreaterThan(0);
  }
  expect(rows.get('m1').isDefault).toBe(false);
  expect(rows.get('m2').isDefault).toBe(true);
  expect(saved.id).toBe('m2');
  // apiKey must stay masked on the way out
  expect(saved.apiKey).not.toBe('sk-secret-12345');
});

it('throws 404 for an unknown model id', async () => {
  const { svc } = makeService();
  await expect(svc.setDefault('nope')).rejects.toThrow('Resource not found');
});

describe('getUsableDefault (user-facing)', () => {
  function makeUsableService(rows: any[], provider: any = null) {
    const byId = new Map(rows.map((r) => [r.id, r]));
    const repo: any = {
      findOne: async ({ where }: any) => {
        if (where.id) return byId.get(where.id) ?? null;
        if (where.isDefault) return [...byId.values()].find((r) => r.isDefault) ?? null;
        return null;
      },
    };
    const providers: any = { findOne: async () => provider };
    return new ModelsAdminService(repo, providers);
  }

  it('returns the masked default when usable', async () => {
    const svc = makeUsableService([
      { id: 'd', isDefault: true, isActive: true, apiKey: 'sk-secret-xyz' },
    ]);
    const m: any = await svc.getUsableDefault();
    expect(m?.id).toBe('d');
    expect(m?.apiKey).not.toBe('sk-secret-xyz');
  });

  it('returns null when the default is inactive or its provider is disabled', async () => {
    const inactive = makeUsableService([{ id: 'd', isDefault: true, isActive: false }]);
    await expect(inactive.getUsableDefault()).resolves.toBeNull();
    const badProv = makeUsableService(
      [{ id: 'd', isDefault: true, isActive: true, provider: 'p' }],
      { id: 'p', name: 'p', isActive: false },
    );
    await expect(badProv.getUsableDefault()).resolves.toBeNull();
  });

  it('returns null when nothing is flagged default', async () => {
    const svc = makeUsableService([{ id: 'x', isDefault: false, isActive: true }]);
    await expect(svc.getUsableDefault()).resolves.toBeNull();
  });
});
