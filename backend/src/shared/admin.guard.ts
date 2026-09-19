import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Optional } from '@nestjs/common';
import { UsersService } from '../modules/users/users.service';

/**
 * Admin endpoints must never trust the JWT `role` claim: the role assigned in
 * the database is authoritative and is re-read on every admin request, so a
 * user promoted (or demoted) by an admin gets the new access set immediately —
 * even with an old token (max token lifetime applies: 1h access token).
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(@Optional() private users?: UsersService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const userId = req.user?.sub;
    if (!userId) throw new ForbiddenException('Admin only');
    const user =
      typeof this.users?.findById === 'function'
        ? await this.users.findById(userId).catch(() => null)
        : null;
    const role = user?.role ?? req.user?.role;
    if (role !== 'admin') throw new ForbiddenException('Admin only');
    return true;
  }
}
