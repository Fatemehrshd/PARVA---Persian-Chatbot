/**
 * Soft-delete behavior for administrative entities (users, ai_models, ai_providers):
 * rows are kept (isDeleted=true) for audit, disappear from listings/lookups,
 * and a deleted user can no longer authenticate.
 */
import { ConflictException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../src/modules/users/users.service';
import { ModelsAdminService } from '../src/modules/models-admin/models-admin.service';
import { ProvidersAdminService } from '../src/modules/models-admin/providers-admin.service';

type Row = Record<string, any>;

/** In-memory repo that honors the subset of TypeORM criteria we use (equality + isDeleted). */
function makeRepo(rows: Row[] = []) {
  const matches = (row: Row, where: Row = {}) =>
    Object.entries(where).every(([k, v]) => row[k] === v);
  return {
    rows,
    findOne: jest.fn(async ({ where }: any = {}) => rows.find((r) => matches(r, where)) ?? null),
    find: jest.fn(async ({ where, order }: any = {}) => {
      const out = rows.filter((r) => matches(r, where));
      if (order?.createdAt === 'ASC') out.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
      return out;
    }),
    save: jest.fn(async (row: Row) => {
      const i = rows.indexOf(row);
      if (i === -1) rows.push(row);
      return row;
    }),
    create: jest.fn((d: Row) => ({ ...d })),
    update: jest.fn(async (criteria: Row, patch: Row) => {
      // TypeORM `In(ids)` arrives as a FindOperator with a `.value` array.
      const idList: string[] | undefined = Array.isArray(criteria?.id?.value)
        ? criteria.id.value
        : undefined;
      rows.forEach((r) => {
        if (idList ? idList.includes(r.id) : matches(r, criteria)) Object.assign(r, patch);
      });
    }),
    remove: jest.fn(async (row: Row) => {
      const i = rows.indexOf(row);
      if (i !== -1) rows.splice(i, 1);
    }),
    createQueryBuilder: jest.fn(() => {
      throw new Error('no QB in unit test');
    }),
  };
}

describe('Soft delete — UsersService', () => {
  it('soft-deletes a user: row stays, listings/lookups hide it, auth lookup returns null', async () => {
    const user = { id: 'u1', email: 'a@b.co', username: 'ali', role: 'user', isActive: true, isDeleted: false };
    const repo = makeRepo([user]);
    const svc = new UsersService(repo as any);

    await svc.deleteByAdmin('u1');

    // Row is kept (not physically removed) and flagged
    expect(repo.remove).not.toHaveBeenCalled();
    expect(user.isDeleted).toBe(true);

    // Lookups used by auth/profile no longer resolve the user
    expect(await svc.findByEmail('a@b.co')).toBeNull();
    expect(await svc.findById('u1')).toBeNull();
    expect(await svc.findByUsername('ali')).toBeNull();

    // Second delete is a clean 404, not an error
    await expect(svc.deleteByAdmin('u1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('deleteByAdmin throws 404 for an unknown user', async () => {
    const svc = new UsersService(makeRepo() as any);
    await expect(svc.deleteByAdmin('missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('Soft delete — ModelsAdminService', () => {
  const model: Row = {
    id: 'm1', name: 'GPT', provider: 'openai', apiIdentifier: 'gpt-4',
    isActive: true, isDefault: true, isDeleted: false, createdAt: new Date(),
  };

  it('soft-deletes a model: row stays, it leaves list()/listActive()/getDefault()', async () => {
    const mRepo = makeRepo([model]);
    const pRepo = makeRepo([]);
    const svc = new ModelsAdminService(mRepo as any, pRepo as any);

    await svc.remove('m1');

    expect(mRepo.remove).not.toHaveBeenCalled();
    expect(model.isDeleted).toBe(true);
    expect(await svc.list()).toHaveLength(0);
    expect(await svc.listActive()).toHaveLength(0);
    expect(await svc.getDefault()).toBeNull();
    expect(await svc.getRawById('m1')).toBeNull();

    // Provider defaultModelId pointing at the deleted model is nulled
    expect(pRepo.update).toHaveBeenCalledWith({ defaultModelId: 'm1' }, { defaultModelId: null });
  });

  it('remove() throws 404 for an unknown model', async () => {
    const svc = new ModelsAdminService(makeRepo() as any, makeRepo() as any);
    await expect(svc.remove('missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('Soft delete — ProvidersAdminService', () => {
  it('soft-deletes a provider and cascades softly to its models', async () => {
    const provider: Row = { id: 'p1', name: 'openai', isActive: true, isDeleted: false, createdAt: new Date() };
    const m1: Row = { id: 'm1', providerId: 'p1', isActive: true, isDefault: true, isDeleted: false, createdAt: new Date() };
    const pRepo = makeRepo([provider]);
    const mRepo = makeRepo([m1]);
    const svc = new ProvidersAdminService(pRepo as any, mRepo as any);

    const res = await svc.remove('p1');

    expect(res.deletedModelIds).toEqual(['m1']);
    expect(pRepo.remove).not.toHaveBeenCalled();
    expect(provider.isDeleted).toBe(true);
    // Models were flagged, not physically deleted
    expect(mRepo.update).toHaveBeenCalledWith({ id: expect.anything() }, { isDeleted: true });
    expect(mRepo.rows[0].isDeleted).toBe(true);
    // Provider leaves the admin list
    expect(await svc.list()).toHaveLength(0);
  });
});
