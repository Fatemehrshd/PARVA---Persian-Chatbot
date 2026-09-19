import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { AdminGuard } from '../src/shared/admin.guard';

describe('AdminGuard — database role is authoritative (not the JWT claim)', () => {
  const ctxFor = (user: any) =>
    ({ switchToHttp: () => ({ getRequest: () => ({ user }) }) }) as ExecutionContext;

  it('grants access when the database says admin even if the token says user', async () => {
    const users = { findById: jest.fn(async () => ({ id: 'u1', role: 'admin' })) };
    const guard = new AdminGuard(users as any);
    await expect(guard.canActivate(ctxFor({ sub: 'u1', role: 'user' }))).resolves.toBe(true);
  });

  it('denies access when the database says user even if the token says admin', async () => {
    const users = { findById: jest.fn(async () => ({ id: 'u2', role: 'user' })) };
    const guard = new AdminGuard(users as any);
    await expect(guard.canActivate(ctxFor({ sub: 'u2', role: 'admin' }))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('denies anonymous requests without a subject', async () => {
    const guard = new AdminGuard({ findById: jest.fn() } as any);
    await expect(guard.canActivate(ctxFor(null))).rejects.toBeInstanceOf(ForbiddenException);
  });
});