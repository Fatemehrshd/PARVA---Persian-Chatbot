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

  @Get('system-logs')
  async getSystemLogs(
    @Query('type') type?: 'app' | 'error',
    @Query('lines') lines?: number,
  ) {
    return this.auditService.getSystemLogs(type, lines ? Number(lines) : 100);
  }

  @Get()
  async getAuditLogs(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('traceId') traceId?: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('action') action?: string,
    @Query('entityType') entityType?: string,
    @Query('actorId') actorId?: string,
    @Query('id') id?: string,
    @Query('actorEmail') actorEmail?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.auditService.findAll({
      page,
      limit,
      search,
      traceId,
      status,
      type,
      action,
      entityType,
      actorId,
      id,
      actorEmail,
      startDate,
      endDate,
    });
  }
}
