import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { AiModel } from './ai-model.entity';
import { AiProvider } from './ai-provider.entity';
import { ModelsAdminService } from './models-admin.service';
import { ModelsAdminController } from './models-admin.controller';
import { ModelsController } from './models.controller';
import { ProvidersAdminService } from './providers-admin.service';
import { ProvidersAdminController } from './providers-admin.controller';
import { JwtAuthGuard } from '../../shared/jwt-auth.guard';
import { AdminGuard } from '../../shared/admin.guard';
@Module({
  imports: [
    TypeOrmModule.forFeature([AiModel, AiProvider]),
    JwtModule.register({ secret: process.env.JWT_SECRET ?? 'dev-secret' }),
  ],
  controllers: [ModelsAdminController, ProvidersAdminController, ModelsController],
  providers: [ModelsAdminService, ProvidersAdminService, JwtAuthGuard, AdminGuard],
  exports: [ModelsAdminService, ProvidersAdminService],
})
export class ModelsAdminModule {}
