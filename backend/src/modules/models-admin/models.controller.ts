import { Controller, Get, NotFoundException, Optional, Req, UseGuards } from '@nestjs/common';
import { ModelsAdminService } from './models-admin.service';
import { JwtAuthGuard } from '../../shared/jwt-auth.guard';
import { UsersService } from '../users/users.service';

/**
 * User-facing model listing for chat model switchers: active models whose
 * provider is active too, filtered by the caller's access rights
 * (public / commercial-by-role / private-by-whitelist) and credentials masked.
 * Admin management stays under /admin/models.
 */
@UseGuards(JwtAuthGuard)
@Controller('models')
export class ModelsController {
  constructor(
    private svc: ModelsAdminService,
    @Optional() private users?: UsersService,
  ) {}

  private async currentUser(req: any) {
    const dbUser = this.users ? await this.users.findById(req.user?.sub).catch(() => null) : null;
    return {
      id: req.user?.sub,
      role: dbUser?.role ?? req.user?.role ?? 'user',
    };
  }

  @Get()
  async list(@Req() req: any) {
    return this.svc.listActive(await this.currentUser(req));
  }

  @Get('default')
  async getDefault(@Req() req: any) {
    const m = await this.svc.getUsableDefault(await this.currentUser(req));
    if (!m) throw new NotFoundException('Resource not found');
    return m;
  }
}
