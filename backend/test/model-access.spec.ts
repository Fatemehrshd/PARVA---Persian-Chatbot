/**
 * Model access control (public / commercial / private-by-whitelist):
 * pure resolver, role map merge, and user-facing filtering.
 */
import {
  SettingsService,
  resolveModelAccess,
  DEFAULT_MODEL_ACCESS,
} from '../src/modules/admin/settings.service';
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
function makeSettings(initial: Record<string, string> = {}) {
  const store = new Map<string, string>(Object.entries(initial));
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

describe('resolveModelAccess (pure)', () => {
  const access = { user: ['public'], manager: ['public', 'commercial'] };

  it('hides inactive and soft-deleted models from everyone', () => {
    expect(resolveModelAccess({ isActive: false, accessLevel: 'public' }, { role: 'user' }, access)).toBe(false);
    expect(resolveModelAccess({ isDeleted: true, accessLevel: 'public' }, { role: 'admin' }, access)).toBe(false);
  });

  it('exposes public models to every role', () => {
    expect(resolveModelAccess({ accessLevel: 'public' }, { id: 'u1', role: 'user' }, access)).toBe(true);
  });

  it('gates commercial models on the role map (never for plain users by default)', () => {
    expect(resolveModelAccess({ accessLevel: 'commercial' }, { id: 'u1', role: 'user' }, access)).toBe(false);
    expect(resolveModelAccess({ accessLevel: 'commercial' }, { id: 'u2', role: 'manager' }, access)).toBe(true);
    // unknown role falls back to the defaults (public only)
    expect(resolveModelAccess({ accessLevel: 'commercial' }, { id: 'u3', role: 'premium' }, access)).toBe(false);
  });

  it('allows a future premium role as soon as the admin grants it', () => {
    const withPremium = { ...access, premium: ['public', 'commercial'] };
    expect(resolveModelAccess({ accessLevel: 'commercial' }, { id: 'u9', role: 'premium' }, withPremium)).toBe(true);
  });

  it('gates private models on the whitelist and always lets admins in', () => {
    const model = { accessLevel: 'private', allowedUserIds: ['u1'] };
    expect(resolveModelAccess(model, { id: 'u1', role: 'user' }, access)).toBe(true);
    expect(resolveModelAccess(model, { id: 'u2', role: 'user' }, access)).toBe(false);
    expect(resolveModelAccess(model, { id: 'u2', role: 'admin' }, access)).toBe(true);
  });
});

describe('SettingsService model access map', () => {
  it('defaults to public-only for user and everything for admin', async () => {
    const { svc } = makeSettings();
    const map = await svc.getModelAccess();
    expect(map.user).toEqual(['public']);
    expect(map.admin).toEqual(['public', 'commercial', 'private']);
  });

  it('merges grants, forces admin to all levels and can reset a role', async () => {
    const { svc } = makeSettings();
    await svc.setModelAccess('premium', ['public', 'commercial']);
    let map = await svc.getModelAccess();
    expect(map.premium).toEqual(['public', 'commercial']);
    expect(map.user).toEqual(['public']); // untouched roles survive

    await svc.setModelAccess('premium', null);
    map = await svc.getModelAccess();
    expect(map.premium).toBeUndefined();

    await svc.setModelAccess('admin', ['public']);
    map = await svc.getModelAccess();
    expect(map.admin).toEqual(['public', 'commercial', 'private']);
  });

  it('exposes the map through getAll()/update() so the admin panel can read and write it', async () => {
    const { svc } = makeSettings();
    await svc.update({ modelAccess: { manager: ['public', 'commercial'] } } as any);
    const all = await svc.getAll();
    expect(all.modelAccess.manager).toEqual(['public', 'commercial']);
    expect(DEFAULT_MODEL_ACCESS.user).toEqual(['public']);
  });
});
