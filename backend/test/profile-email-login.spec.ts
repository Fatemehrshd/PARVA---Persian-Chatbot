import bcrypt from 'bcryptjs';
import { AuthService } from '../src/modules/auth/auth.service';
import { ProfileService } from '../src/modules/users/profile.service';

it('logs in with the normalized email saved by profile change', async () => {
  const user: any = {
    id: 'u1',
    email: 'old@example.com',
    passwordHash: await bcrypt.hash('current123', 4),
    role: 'user',
  };
  const users: any = {
    findById: async () => user,
    findByEmail: async (email: string) => (email === user.email ? user : null),
    findByUsername: async () => null,
    save: async (next: any) => next,
  };
  const profile = new ProfileService(users, {} as any);
  await profile.changeEmail('u1', { email: ' New@Example.COM ', password: 'current123' } as any);

  const auth = new AuthService(users, { sign: () => 'token' } as any);
  await expect(auth.login('new@example.com', 'current123')).resolves.toMatchObject({
    user: { email: 'new@example.com' },
  });
});