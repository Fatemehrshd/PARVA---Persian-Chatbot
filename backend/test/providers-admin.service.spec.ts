import { ConflictException, BadRequestException } from '@nestjs/common';
import { ProvidersAdminService } from '../src/modules/models-admin/providers-admin.service';
import { maskSecret } from '../src/modules/models-admin/mask-secret';

function fakeStores() {
  const providers: any[] = [];
  const models: any[] = [];
  let seq = 0;
  const pRepo: any = {
    create: (o: any) => ({ ...o }),
    save: async (p: any) => {
      if (!p.id) Object.assign(p, { id: `p-${++seq}`, createdAt: new Date() });
      const i = providers.findIndex((x) => x.id === p.id);
      if (i < 0) providers.push(p);
      else providers[i] = p;
      return p;
    },
    findOne: async ({ where }: any) =>
      providers.find(
        (p) =>
          (where.id ? p.id === where.id : p.name === where.name) &&
          (where.isDeleted === undefined || (p.isDeleted ?? false) === where.isDeleted),
      ) ?? null,
    find: async ({ where }: any = {}) =>
      providers.filter((p) => where?.isDeleted === undefined || (p.isDeleted ?? false) === where.isDeleted),
    update: async (where: any, patch: any) => {
      providers.forEach((p) => {
        if (
          (where.defaultModelId === undefined || p.defaultModelId === where.defaultModelId) &&
          (where.id === undefined || p.id === where.id)
        )
          Object.assign(p, patch);
      });
    },
    remove: async (p: any) => {
      const i = providers.findIndex((x) => x.id === p.id);
      if (i >= 0) providers.splice(i, 1);
    },
  };
  const mRepo: any = {
    findOne: async ({ where }: any) =>
      models.find(
        (m) => m.id === where.id && (where.isDeleted === undefined || (m.isDeleted ?? false) === where.isDeleted),
      ) ?? null,
    find: async ({ where, order }: any = {}) => {
      const out = models.filter(
        (m) =>
          (where?.providerId ? m.providerId === where.providerId : true) &&
          (where?.isActive === undefined || m.isActive === where.isActive) &&
          (where?.isDeleted === undefined || (m.isDeleted ?? false) === where.isDeleted),
      );
      if (order?.createdAt === 'ASC') out.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
      return out;
    },
    update: async (where: any, patch: any) => {
      // TypeORM `In(ids)` arrives as a FindOperator with a `.value` array.
      const idList: string[] | undefined = Array.isArray(where?.id?.value)
        ? where.id.value
        : undefined;
      models.forEach((m) => {
        const idOk =
          where.id === undefined ? true : idList ? idList.includes(m.id) : m.id === where.id;
        if (idOk && (where.isDefault === undefined || m.isDefault === where.isDefault))
          Object.assign(m, patch);
      });
    },
  };
  return { pRepo, mRepo, providers, models };
}

describe('ProvidersAdminService', () => {
  it('creates and masks the stored key; never returns it raw', async () => {
    const { pRepo, mRepo } = fakeStores();
    const svc = new ProvidersAdminService(pRepo, mRepo);
    const created: any = await svc.create({
      name: 'openai',
      baseUrl: 'http://x',
      apiKey: 'sk-secret-key-1234',
    });
    expect(created.apiKey).toBe('sk-...1234');
    const list: any = await svc.list();
    expect(list[0].apiKey).toBe('sk-...1234');
  });

  it('rejects duplicate provider names with 409', async () => {
    const { pRepo, mRepo } = fakeStores();
    const svc = new ProvidersAdminService(pRepo, mRepo);
    await svc.create({ name: 'ollama' });
    await expect(svc.create({ name: 'ollama' })).rejects.toBeInstanceOf(ConflictException);
  });

  it('update with empty apiKey keeps the existing key; a real one rotates it', async () => {
    const { pRepo, mRepo } = fakeStores();
    const svc = new ProvidersAdminService(pRepo, mRepo);
    const p: any = await svc.create({ name: 'openai', apiKey: 'sk-first-key-aaaa' });
    const after: any = await svc.update(p.id, { apiKey: '', baseUrl: 'http://new' });
    expect(after.apiKey).toBe('sk-...aaaa');
    const rotated: any = await svc.update(p.id, { apiKey: 'sk-second-key-bbbb' });
    expect(rotated.apiKey).toBe('sk-...bbbb');
  });

  it('setDefaultModel requires membership + active; success stores defaultModelId', async () => {
    const { pRepo, mRepo, providers, models } = fakeStores();
    const svc = new ProvidersAdminService(pRepo, mRepo);
    const p: any = await svc.create({ name: 'openai' });
    models.push({
      id: 'mm',
      providerId: p.id,
      provider: 'openai',
      isActive: true,
      isDefault: false,
    });
    models.push({ id: 'other', providerId: 'p-other', provider: 'x', isActive: true });
    await expect(svc.setDefaultModel(p.id, 'nope')).rejects.toBeInstanceOf(BadRequestException);
    await expect(svc.setDefaultModel(p.id, 'other')).rejects.toBeInstanceOf(BadRequestException);
    const r: any = await svc.setDefaultModel(p.id, 'mm');
    expect(r.defaultModelId).toBe('mm');
    expect(providers.find((x) => x.id === p.id).defaultModelId).toBe('mm');
  });

  it('remove cascades its models and reassigns a swallowed platform default', async () => {
    const { pRepo, mRepo, providers, models } = fakeStores();
    const svc = new ProvidersAdminService(pRepo, mRepo);
    const doomed: any = await svc.create({ name: 'doomed' });
    const keeper: any = await svc.create({ name: 'keeper' });
    models.push(
      { id: 'd1', providerId: doomed.id, provider: 'doomed', isActive: true, isDefault: true },
      { id: 'd2', providerId: doomed.id, provider: 'doomed', isActive: true, isDefault: false },
      { id: 'k1', providerId: keeper.id, provider: 'keeper', isActive: true, isDefault: false },
    );
    const res = await svc.remove(doomed.id);
    expect(res.deletedModelIds.sort()).toEqual(['d1', 'd2']);
    // soft delete: rows stay in storage, flagged and hidden from listings
    expect(providers.find((p) => p.id === doomed.id).isDeleted).toBe(true);
    expect(models.find((m) => m.id === 'd1').isDeleted).toBe(true);
    expect(models.find((m) => m.id === 'd2').isDeleted).toBe(true);
    // platform default moved to the oldest remaining usable model
    expect(models.find((m) => m.id === 'k1').isDefault).toBe(true);
  });
});

describe('maskSecret', () => {
  it('masks long and short keys, passes through empty', () => {
    expect(maskSecret('sk-abcdefghij9999')).toBe('sk-...9999');
    expect(maskSecret('short')).toBe('***');
    expect(maskSecret(undefined)).toBeUndefined();
    expect(maskSecret('')).toBe('');
  });
});
