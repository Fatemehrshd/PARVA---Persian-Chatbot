/** Reusable token-claim guard for tests: mirrors the real AdminGuard's contract. */
import { CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

export const testAdminGuard: CanActivate = {
  canActivate: (ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest();
    if (req?.user?.role !== 'admin') throw new ForbiddenException('Admin only');
    return true;
  },
};