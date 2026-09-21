import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { SubscriptionPlan } from './subscription-plan.entity';
import { PlanModel } from './plan-model.entity';
import { Subscription } from './subscription.entity';
import { User } from '../users/user.entity';
import { AiModel } from '../models-admin/ai-model.entity';
import { PlansService } from './plans.service';
import { SubscriptionsService } from './subscriptions.service';
import { EntitlementService } from './entitlement.service';
import { SubscriptionsController } from './subscriptions.controller';
import { AdminPlansController } from './admin-plans.controller';
import { AdminSubscriptionsController } from './admin-subscriptions.controller';
import { AuditModule } from '../audit/audit.module';
import { AdminModule } from '../admin/admin.module';
import { UsersModule } from '../users/users.module';
import { JwtAuthGuard } from '../../shared/jwt-auth.guard';
import { AdminGuard } from '../../shared/admin.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SubscriptionPlan,
      PlanModel,
      Subscription,
      User,
      AiModel,
    ]),
    JwtModule.register({ secret: process.env.JWT_SECRET ?? 'dev-secret' }),
    AuditModule,
    forwardRef(() => AdminModule),
    forwardRef(() => UsersModule),
  ],
  controllers: [
    SubscriptionsController,
    AdminPlansController,
    AdminSubscriptionsController,
  ],
  providers: [
    PlansService,
    SubscriptionsService,
    EntitlementService,
    JwtAuthGuard,
    AdminGuard,
  ],
  exports: [PlansService, SubscriptionsService, EntitlementService],
})
export class SubscriptionsModule {}
