import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { ChatModule } from './modules/chat/chat.module';
import { ModelsAdminModule } from './modules/models-admin/models-admin.module';
import { User } from './modules/users/user.entity';
import { Conversation } from './modules/chat/conversation.entity';
import { Message } from './modules/chat/message.entity';
import { AiModel } from './modules/models-admin/ai-model.entity';
@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST ?? 'localhost',
      port: Number(process.env.DB_PORT ?? 5432),
      username: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASS || 'postgres',
      database: process.env.DB_NAME || 'codeless',
      entities: [User, Conversation, Message, AiModel],
      synchronize: (process.env.DB_SYNC ?? 'true') === 'true',
    }),
    UsersModule,
    AuthModule,
    ChatModule,
    ModelsAdminModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
