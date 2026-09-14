import { Controller, Get, UseGuards } from '@nestjs/common';
import { ModelsAdminService } from './models-admin.service';
import { JwtAuthGuard } from '../../shared/jwt-auth.guard';

/**
 * User-facing model listing for chat model switchers: active models whose
 * provider is active too, with credentials masked. Admin management stays
 * under /admin/models.
 */
@UseGuards(JwtAuthGuard)
@Controller('models')
export class ModelsController {
  constructor(private svc: ModelsAdminService) {}
  @Get()
  list() {
    return this.svc.listActive();
  }
}
