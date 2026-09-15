import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { ChatModule } from './modules/chat/chat.module';
import { ModelsAdminModule } from './modules/models-admin/models-admin.module';
import { StorageModule } from './modules/storage/storage.module';
import { AdminModule } from './modules/admin/admin.module';
import { User } from './modules/users/user.entity';
import { Conversation } from './modules/chat/conversation.entity';
import { Message } from './modules/chat/message.entity';
import { AiModel } from './modules/models-admin/ai-model.entity';
import { AiProvider } from './modules/models-admin/ai-provider.entity';
import { SystemSetting } from './modules/admin/system-setting.entity';
import { ResponseEnvelopeInterceptor } from './shared/response-envelope.interceptor';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST ?? 'localhost',
      port: Number(process.env.DB_PORT ?? 5432),
      username: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASS || 'postgres',
      database: process.env.DB_NAME || 'codeless',
      entities: [User, Conversation, Message, AiModel, AiProvider, SystemSetting],
      migrations: [__dirname + '/migrations/*{.ts,.js}'],
      synchronize: (process.env.DB_SYNC ?? 'true') === 'true',
    }),
    UsersModule,
    AuthModule,
    ChatModule,
    ModelsAdminModule,
    StorageModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseEnvelopeInterceptor,
    },
  ],
})
export class AppModule {}
