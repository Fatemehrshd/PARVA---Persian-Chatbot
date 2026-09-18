import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { Conversation } from './conversation.entity';
import { Message } from './message.entity';
import { ChatService } from './chat.service';
import { ActiveStreamService } from './active-stream.service';
import { ChatController, ChatQuotaController } from './chat.controller';
import { OpenAiCompatController } from './openai-compat.controller';
import { ModelsAdminModule } from '../models-admin/models-admin.module';
import { AiModule } from '../ai/ai.module';
import { AdminModule } from '../admin/admin.module';
import { FileAttachment } from '../files/file-attachment.entity';
import { FilesModule } from '../files/files.module';
import { UsersModule } from '../users/users.module';
import { WebSearchModule } from '../web-search/web-search.module';
import { JwtAuthGuard } from '../../shared/jwt-auth.guard';
import { QuotaInterceptor } from '../../shared/response-envelope.interceptor';

@Module({
  imports: [
    TypeOrmModule.forFeature([Conversation, Message, FileAttachment]),
    ModelsAdminModule,
    AiModule,
    forwardRef(() => AdminModule),
    forwardRef(() => UsersModule),
    forwardRef(() => FilesModule),
    WebSearchModule,
    JwtModule.register({ secret: process.env.JWT_SECRET ?? 'dev-secret' }),
  ],
  controllers: [ChatController, ChatQuotaController, OpenAiCompatController],
  providers: [ChatService, ActiveStreamService, JwtAuthGuard, QuotaInterceptor],
  exports: [ChatService, ActiveStreamService],
})
export class ChatModule {}
