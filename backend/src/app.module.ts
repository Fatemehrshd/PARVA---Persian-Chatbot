import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
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
import { FilesModule } from './modules/files/files.module';
import { User } from './modules/users/user.entity';
import { Conversation } from './modules/chat/conversation.entity';
import { Message } from './modules/chat/message.entity';
import { AiModel } from './modules/models-admin/ai-model.entity';
import { AiProvider } from './modules/models-admin/ai-provider.entity';
import { SystemSetting } from './modules/admin/system-setting.entity';
import { FileAttachment } from './modules/files/file-attachment.entity';
import { SubscriptionPlan } from './modules/subscriptions/subscription-plan.entity';
import { PlanModel } from './modules/subscriptions/plan-model.entity';
import { Subscription } from './modules/subscriptions/subscription.entity';
import { Payment } from './modules/payments/payment.entity';
import { Coupon } from './modules/payments/coupon.entity';
import { CouponUsage } from './modules/payments/coupon-usage.entity';
import { AuditLog } from './modules/audit/audit-log.entity';
import { ChatShare } from './modules/chat/chat-share.entity';
import { RefreshToken } from './modules/auth/refresh-token.entity';
import { AuditModule } from './modules/audit/audit.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { TtsModule } from './modules/tts/tts.module';
import { LoggerModule } from './shared/logger/logger.module';
import { ResponseEnvelopeInterceptor } from './shared/response-envelope.interceptor';
import { HttpLoggingInterceptor } from './shared/http-logging.interceptor';
import { TraceContextMiddleware } from './shared/trace-context.service';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST ?? 'localhost',
      port: Number(process.env.DB_PORT ?? 5432),
      username: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASS || 'postgres',
      database: process.env.DB_NAME || 'codeless',
      entities: [
        User,
        Conversation,
        Message,
        AiModel,
        AiProvider,
        SystemSetting,
        FileAttachment,
        SubscriptionPlan,
        PlanModel,
        Subscription,
        Payment,
        Coupon,
        CouponUsage,
        AuditLog,
        ChatShare,
        RefreshToken,
      ],
      migrations: [__dirname + '/migrations/*{.ts,.js}'],
      synchronize: (process.env.DB_SYNC ?? 'true') === 'true',
    }),
    LoggerModule,
    UsersModule,
    AuthModule,
    ChatModule,
    ModelsAdminModule,
    StorageModule,
    AdminModule,
    FilesModule,
    AuditModule,
    SubscriptionsModule,
    PaymentsModule,
    TtsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseEnvelopeInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: HttpLoggingInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TraceContextMiddleware).forRoutes('*');
  }
}
