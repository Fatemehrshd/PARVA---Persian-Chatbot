import { Module, forwardRef } from '@nestjs/common';
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
import { AiModule } from '../ai/ai.module';
import { AdminModule } from '../admin/admin.module';
import { UsersModule } from '../users/users.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([AiModel, AiProvider]),
    JwtModule.register({ secret: process.env.JWT_SECRET ?? 'dev-secret' }),
    AiModule,
    // SettingsService supplies the role → model-access map used to filter models.
    forwardRef(() => AdminModule),
    forwardRef(() => UsersModule),
    forwardRef(() => SubscriptionsModule),
  ],
  controllers: [ModelsAdminController, ProvidersAdminController, ModelsController],
  providers: [ModelsAdminService, ProvidersAdminService, JwtAuthGuard, AdminGuard],
  exports: [ModelsAdminService, ProvidersAdminService],
})
export class ModelsAdminModule {}
