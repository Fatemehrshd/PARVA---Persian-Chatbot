import { ModelsAdminService } from '../src/modules/models-admin/models-admin.service';
describe('Admin models (behavior)', () => {
  it('set default happy path', async () => {
    const store: any[] = [{ id: 'm1', isDefault: false }];
    const repo: any = {
      findOne: async ({ where }: any) => store.find((m) => m.id === where.id) ?? null,
      update: async () => {},
      save: async (m: any) => m,
    };
    const s = new ModelsAdminService(repo, {} as any);
    const r = await s.setDefault('m1');
    expect(r.isDefault).toBe(true);
  });
  it('remove unknown model -> 404', async () => {
    const repo: any = { findOne: async () => null };
    const s = new ModelsAdminService(repo, {} as any);
    await expect(s.remove('nope')).rejects.toThrow('Resource not found');
  });
});
