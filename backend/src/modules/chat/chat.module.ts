import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { Conversation } from './conversation.entity';
import { Message } from './message.entity';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { OpenAiCompatController } from './openai-compat.controller';
import { ModelsAdminModule } from '../models-admin/models-admin.module';
import { JwtAuthGuard } from '../../shared/jwt-auth.guard';
@Module({
  imports: [
    TypeOrmModule.forFeature([Conversation, Message]),
    ModelsAdminModule,
    JwtModule.register({ secret: process.env.JWT_SECRET ?? 'dev-secret' }),
  ],
  controllers: [ChatController, OpenAiCompatController],
  providers: [ChatService, JwtAuthGuard],
})
export class ChatModule {}
