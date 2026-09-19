import { UsersService } from '../src/modules/users/users.service';

describe('UsersService — admin edit persistence roundtrip', () => {
  function makeService() {
    const rows: any[] = [
      {
        id: 'u1',
        email: 'ali@test.com',
        displayName: 'علی رضایی',
        role: 'user',
        isActive: true,
        isDeleted: false,
        usedTokens: 800,
        tokenLimit: 5000,
        messageLimit: 42,
        usageByType: {},
        conversations: [],
      },
    ];
    const repo: any = {
      findOne: async ({ where: { id } }: any) => rows.find((r) => r.id === id && !r.isDeleted) ?? null,
      find: async () => rows.filter((r) => !r.isDeleted),
      create: (d: any) => ({ ...d }),
      save: async (u: any) => {
        const i = rows.findIndex((r) => r.id === u.id);
        if (i >= 0) rows[i] = { ...rows[i], ...u };
        return rows[i];
      },
      createQueryBuilder: () => {
        // مسیر raw همان داده‌ی فیک را برمی‌گرداند (شبیه‌سازی getRawMany)
        return {
          leftJoin: () => this,
          select: () => this,
          where: () => this,
          groupBy: () => this,
          orderBy: () => this,
          getRawMany: async () =>
            rows
              .filter((r) => !r.isDeleted)
              .map((r) => ({
                id: r.id,
                email: r.email,
                displayName: r.displayName,
                username: null,
                role: r.role,
                isActive: r.isActive,
                avatarUrl: null,
                usedTokens: r.usedTokens,
                tokenLimit: r.tokenLimit,
                messageLimit: r.messageLimit,
                periodStart: null,
                periodUsedTokens: 0,
                periodUsedMessages: 0,
                usageByType: r.usageByType,
                createdAt: new Date(),
                conversationsCount: '0',
              })),
        } as any;
      },
    };
    return { service: new UsersService(repo), rows };
  }

  it('persists admin edits and listWithStats returns them (no defaults on reopen)', async () => {
    const { service } = makeService();
    await service.updateByAdmin('u1', {
      displayName: 'نام ویرایش‌شده',
      email: 'ali@test.com',
      role: 'admin',
      tokenLimit: 9000,
      messageLimit: null,
    });
    const list = await service.listWithStats();
    const u = list.find((x) => x.id === 'u1')!;
    expect(u.displayName).toBe('نام ویرایش‌شده');
    expect(u.role).toBe('admin');
    expect(Number(u.tokenLimit)).toBe(9000);
    expect(u.messageLimit).toBeNull();
  });

  it('clearing a personal limit persists null (falls back to inheritance)', async () => {
    const { service } = makeService();
    await service.updateByAdmin('u1', { tokenLimit: null, messageLimit: null });
    const list = await service.listWithStats();
    const u = list.find((x) => x.id === 'u1')!;
    expect(u.tokenLimit).toBeNull();
    expect(u.messageLimit).toBeNull();
  });
});
