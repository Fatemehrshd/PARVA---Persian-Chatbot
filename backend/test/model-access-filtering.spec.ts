/**
 * User-facing model filtering: GET /models reflects the caller's access rights.
 */
import { SettingsService } from '../src/modules/admin/settings.service';
import { ModelsAdminService } from '../src/modules/models-admin/models-admin.service';

/** Minimal in-memory repo honoring equality criteria. */
function makeRepo(rows: any[] = []) {
  const matches = (row: any, where: any = {}) =>
    Object.entries(where).every(([k, v]) => row[k] === v);
  return {
    rows,
    findOne: jest.fn(async ({ where }: any = {}) => rows.find((r) => matches(r, where)) ?? null),
    find: jest.fn(async ({ where }: any = {}) => rows.filter((r) => matches(r, where))),
    update: jest.fn(async (criteria: any, patch: any) => {
      rows.forEach((r) => {
        if (matches(r, criteria)) Object.assign(r, patch);
      });
    }),
    save: jest.fn(async (row: any) => row),
    create: jest.fn((d: any) => ({ ...d })),
  };
}

/** SettingsService backed by a plain in-memory key/value store. */
function makeSettings() {
  const store = new Map<string, string>();
  const repo: any = {
    findOne: jest.fn(async ({ where }: any) =>
      store.has(where.key) ? { key: where.key, value: store.get(where.key) } : null,
    ),
    create: jest.fn((d: any) => ({ ...d })),
    save: jest.fn(async (row: any) => {
      store.set(row.key, row.value);
      return row;
    }),
  };
  return { svc: new SettingsService(repo), store };
}

describe('ModelsAdminService access filtering', () => {
  const rows = [
    { id: 'm-public', name: 'Public', provider: 'p', apiIdentifier: 'a', isActive: true, isDeleted: false, accessLevel: 'public', allowedUserIds: [], createdAt: new Date(1) },
    { id: 'm-commercial', name: 'Commercial', provider: 'p', apiIdentifier: 'b', isActive: true, isDeleted: false, accessLevel: 'commercial', allowedUserIds: [], createdAt: new Date(2) },
    { id: 'm-private', name: 'Private', provider: 'p', apiIdentifier: 'c', isActive: true, isDeleted: false, accessLevel: 'private', allowedUserIds: ['u1'], createdAt: new Date(3) },
  ];

  function build() {
    const { svc: settings } = makeSettings();
    const models = new ModelsAdminService(makeRepo(rows) as any, makeRepo([]) as any, undefined, settings);
    return { models, settings };
  }

  it('shows a plain user only public models', async () => {
    const { models } = build();
    const list = await models.listActive({ id: 'u2', role: 'user' });
    expect(list.map((m) => m.id)).toEqual(['m-public']);
  });

  it('shows the whitelisted user its private model as well', async () => {
    const { models } = build();
    const list = await models.listActive({ id: 'u1', role: 'user' });
    expect(list.map((m) => m.id)).toEqual(['m-public', 'm-private']);
  });

  it('shows admins every level', async () => {
    const { models } = build();
    const list = await models.listActive({ id: 'admin-1', role: 'admin' });
    expect(list.map((m) => m.id)).toEqual(['m-public', 'm-commercial', 'm-private']);
  });

  it('falls back to the first allowed model when the platform default is not accessible', async () => {
    const { svc: settings } = makeSettings();
    const commercialDefault = rows[1];
    const repo: any = {
      findOne: jest.fn(async () => commercialDefault),
      find: jest.fn(async () => rows),
    };
    const svc = new ModelsAdminService(repo, makeRepo([]) as any, undefined, settings);
    const resolved = await svc.getUsableDefault({ id: 'u2', role: 'user' });
    expect(resolved?.id).toBe('m-public');
  });

  it('grants a commercial model to a role as soon as the admin allows it', async () => {
    const { models, settings } = build();
    expect((await models.listActive({ id: 'u3', role: 'premium' })).map((m) => m.id)).toEqual(['m-public']);
    await settings.setModelAccess('premium', ['public', 'commercial']);
    expect((await models.listActive({ id: 'u3', role: 'premium' })).map((m) => m.id)).toEqual([
      'm-public',
      'm-commercial',
    ]);
  });

  it('isModelAllowedForUser is the server-side authority used by chat', async () => {
    const { models } = build();
    const commercial: any = rows[1];
    expect(await models.isModelAllowedForUser(commercial, { id: 'u2', role: 'user' })).toBe(false);
    expect(await models.isModelAllowedForUser(commercial, { id: 'u2', role: 'admin' })).toBe(true);
    expect(await models.isModelAllowedForUser(null, { id: 'u2', role: 'user' })).toBe(false);
  });
});
