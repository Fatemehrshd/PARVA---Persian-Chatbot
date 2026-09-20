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

it('adds the selected default model to the free plan without duplicates', async () => {
  const rows = new Map<string, any>([
    ['m1', { id: 'm1', name: 'Old', isDefault: true, apiKey: null }],
    ['m2', { id: 'm2', name: 'New', isDefault: false, apiKey: null }],
  ]);
  const planModels: any[] = [];
  const repo: any = {
    findOne: async ({ where }: any) => rows.get(where.id) ?? null,
    update: async (criteria: any, partial: any) => {
      for (const row of rows.values()) {
        if (Object.entries(criteria).every(([key, value]) => row[key] === value)) Object.assign(row, partial);
      }
    },
    save: async (model: any) => {
      rows.set(model.id, { ...model });
      return { ...model };
    },
  };
  const freePlanRepo: any = {
    findOne: async () => ({ id: 'free-plan', slug: 'free', isDefault: true }),
  };
  const planModelRepo: any = {
    findOne: async ({ where }: any) => planModels.find(
      (item) => item.planId === where.planId && item.modelId === where.modelId,
    ) ?? null,
    create: (data: any) => ({ ...data }),
    save: async (item: any) => {
      planModels.push(item);
      return item;
    },
  };

  const svc = new ModelsAdminService(
    repo,
    {} as any,
    undefined,
    undefined,
    undefined,
    planModelRepo,
    freePlanRepo,
  );

  await svc.setDefault('m2');
  await svc.setDefault('m2');

  expect(planModels).toHaveLength(1);
  expect(planModels[0]).toMatchObject({ planId: 'free-plan', modelId: 'm2' });
});

it('refuses to disable the current default model until another default is chosen', async () => {
  const rows = new Map<string, any>([
    ['m1', { id: 'm1', name: 'Current Default', isDefault: true, isActive: true, apiKey: 'sk-secret-12345' }],
    ['m2', { id: 'm2', name: 'Fallback', isDefault: false, isActive: true, apiKey: null }],
  ]);
  const repo: any = {
    findOne: async ({ where }: any) => {
      if (where.id) return rows.get(where.id) ?? null;
      if (where.isDefault) return [...rows.values()].find((row) => row.isDefault && row.isDeleted !== true) ?? null;
      return null;
    },
    update: async (criteria: any, partial: any) => {
      if (!criteria || Object.keys(criteria).length === 0) {
        throw new Error('Empty criteria(s) are not allowed for the update method.');
      }
      for (const row of rows.values()) {
        const match = Object.entries(criteria).every(([k, v]) => (row as any)[k] === v);
        if (match) Object.assign(row, partial);
      }
    },
    save: async (o: any) => {
      rows.set(o.id, { ...o });
      return { ...o };
    },
  };
  const providers: any = { findOne: async () => null };
  const svc = new ModelsAdminService(repo, providers);

  await expect(svc.updateStatus('m1', false)).rejects.toThrow('مدل پیش‌فرض');

  await svc.setDefault('m2');
  await expect(svc.updateStatus('m1', false)).resolves.toMatchObject({ id: 'm1', isActive: false });
  expect([...rows.values()].filter((row) => row.isDefault).length).toBe(1);
});

it('refuses to disable a provider-default model even when it is not the platform default', async () => {
  const rows = new Map<string, any>([
    ['m1', { id: 'm1', name: 'Current Provider Default', isDefault: false, isActive: true, providerId: 'p1', provider: 'openai', apiKey: 'sk-abc' }],
    ['m2', { id: 'm2', name: 'Other Model', isDefault: false, isActive: true, providerId: 'p1', provider: 'openai', apiKey: null }],
  ]);
  const repo: any = {
    findOne: async ({ where }: any) => {
      if (where.id) return rows.get(where.id) ?? null;
      if (where.isDefault) return [...rows.values()].find((row) => row.isDefault && row.isDeleted !== true) ?? null;
      return null;
    },
    find: async ({ where, order }: any = {}) => {
      const out = [...rows.values()].filter(
        (row) =>
          (where?.providerId === undefined || row.providerId === where.providerId) &&
          (where?.isActive === undefined || row.isActive === where.isActive) &&
          (where?.isDeleted === undefined || row.isDeleted === where.isDeleted),
      );
      if (order?.createdAt === 'ASC') out.sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
      return out;
    },
    update: async (criteria: any, partial: any) => {
      for (const row of rows.values()) {
        const match = Object.entries(criteria).every(([k, v]) => (row as any)[k] === v);
        if (match) Object.assign(row, partial);
      }
    },
    save: async (o: any) => ({ ...o }),
  };
  const providers: any = {
    findOne: async ({ where }: any) =>
      where?.id === 'p1' ? { id: 'p1', isDeleted: false, isActive: true, defaultModelId: 'm1' } : null,
  };

  const svc = new ModelsAdminService(repo, providers as any);
  await expect(svc.updateStatus('m1', false)).rejects.toThrow('پیش‌فرض');
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
