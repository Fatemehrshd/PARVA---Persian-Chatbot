import { AuthService } from '../src/modules/auth/auth.service';
describe('Auth (behavior)', () => {
  const users: any = {
    data: [] as any[],
    async findByEmail(e: string) {
      return this.data.find((u: any) => u.email === e);
    },
    async create(d: any) {
      const u = { id: 'u1', createdAt: new Date(), role: 'user', ...d };
      this.data.push(u);
      return u;
    },
  };
  const jwt: any = { sign: (p: any) => 'tok-' + p.email };
  it('signup happy path returns tokens', async () => {
    const s = new AuthService(users, jwt);
    const r = await s.signup('a@x.com', 'password123', 'Ali');
    expect(r.accessToken).toBeDefined();
    expect(r.user.email).toBe('a@x.com');
  });
  it('signup duplicate email -> 409', async () => {
    const s = new AuthService(users, jwt);
    await expect(s.signup('a@x.com', 'password123')).rejects.toThrow('Email is already registered');
  });

  it('disabled users cannot log in', async () => {
    const passwordHash = await (await import('bcryptjs')).default.hash('password123', 10);
    users.data.push({
      id: 'disabled-user',
      email: 'disabled@x.com',
      passwordHash,
      role: 'user',
      isActive: false,
    });

    const s = new AuthService(users, jwt);
    await expect(s.login('disabled@x.com', 'password123')).rejects.toThrow('حساب کاربری غیرفعال است');
  });
});
