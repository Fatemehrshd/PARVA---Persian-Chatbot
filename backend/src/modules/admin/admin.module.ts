import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SystemSetting } from './system-setting.entity';
import { User } from '../users/user.entity';
import { Conversation } from '../chat/conversation.entity';
import { Message } from '../chat/message.entity';
import { AiModel } from '../models-admin/ai-model.entity';
import { AiProvider } from '../models-admin/ai-provider.entity';
import { SettingsService } from './settings.service';
import { AdminSettingsController } from './admin-settings.controller';
import { AdminUsersController } from './admin-users.controller';
import { AdminDashboardController } from './admin-dashboard.controller';
import { AdminConversationsController } from './admin-conversations.controller';
import { UsersModule } from '../users/users.module';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from '../../shared/jwt-auth.guard';
import { AdminGuard } from '../../shared/admin.guard';

import { FileAttachment } from '../files/file-attachment.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SystemSetting,
      User,
      Conversation,
      Message,
      AiModel,
      AiProvider,
      FileAttachment,
    ]),
    JwtModule.register({ secret: process.env.JWT_SECRET ?? 'dev-secret' }),
    forwardRef(() => UsersModule),
  ],
  controllers: [
    AdminSettingsController,
    AdminUsersController,
    AdminDashboardController,
    AdminConversationsController,
  ],
  providers: [SettingsService, JwtAuthGuard, AdminGuard],
  exports: [SettingsService],
})
export class AdminModule {}
