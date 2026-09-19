import { Module, Global, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { AuditLog } from './audit-log.entity';
import { AuditService } from './audit.service';
import { AdminAuditController } from './admin-audit.controller';
import { JwtAuthGuard } from '../../shared/jwt-auth.guard';
import { AdminGuard } from '../../shared/admin.guard';
import { UsersModule } from '../users/users.module';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([AuditLog]),
    JwtModule.register({ secret: process.env.JWT_SECRET ?? 'dev-secret' }),
    forwardRef(() => UsersModule),
  ],
  controllers: [AdminAuditController],
  providers: [AuditService, JwtAuthGuard, AdminGuard],
  exports: [AuditService],
})
export class AuditModule {}
