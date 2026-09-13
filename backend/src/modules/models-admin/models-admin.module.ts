import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { AiModel } from './ai-model.entity';
import { ModelsAdminService } from './models-admin.service';
import { ModelsAdminController } from './models-admin.controller';
import { JwtAuthGuard } from '../../shared/jwt-auth.guard';
import { AdminGuard } from '../../shared/admin.guard';
@Module({ imports: [TypeOrmModule.forFeature([AiModel]), JwtModule.register({ secret: process.env.JWT_SECRET ?? 'dev-secret' })], controllers: [ModelsAdminController], providers: [ModelsAdminService, JwtAuthGuard, AdminGuard], exports: [ModelsAdminService] })
export class ModelsAdminModule {}
