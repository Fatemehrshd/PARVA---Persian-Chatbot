import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { Payment } from './payment.entity';
import { Coupon } from './coupon.entity';
import { CouponUsage } from './coupon-usage.entity';
import { PaymentsService } from './payments.service';
import { CouponsService } from './coupons.service';
import { SandboxPaymentGateway } from './gateway/sandbox-payment.gateway';
import { ZarinpalPaymentGateway } from './gateway/zarinpal-payment.gateway';
import { PaymentsController } from './payments.controller';
import { AdminPaymentsController } from './admin-payments.controller';
import { AdminCouponsController } from './admin-coupons.controller';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { AuditModule } from '../audit/audit.module';
import { UsersModule } from '../users/users.module';
import { JwtAuthGuard } from '../../shared/jwt-auth.guard';
import { AdminGuard } from '../../shared/admin.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment, Coupon, CouponUsage]),
    JwtModule.register({ secret: process.env.JWT_SECRET ?? 'dev-secret' }),
    SubscriptionsModule,
    AuditModule,
    forwardRef(() => UsersModule),
  ],
  controllers: [
    PaymentsController,
    AdminPaymentsController,
    AdminCouponsController,
  ],
  providers: [
    PaymentsService,
    CouponsService,
    SandboxPaymentGateway,
    ZarinpalPaymentGateway,
    JwtAuthGuard,
    AdminGuard,
  ],
  exports: [
    PaymentsService,
    CouponsService,
    SandboxPaymentGateway,
    ZarinpalPaymentGateway,
  ],
})
export class PaymentsModule {}
