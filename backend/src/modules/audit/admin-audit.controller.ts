import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../../shared/jwt-auth.guard';
import { AdminGuard } from '../../shared/admin.guard';

@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin/audit-logs')
export class AdminAuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  async getAuditLogs(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('action') action?: string,
    @Query('entityType') entityType?: string,
    @Query('actorId') actorId?: string,
  ) {
    return this.auditService.findAll({
      page,
      limit,
      action,
      entityType,
      actorId,
    });
  }
}
