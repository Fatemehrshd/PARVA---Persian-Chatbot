import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Payment, PaymentStatus } from './payment.entity';
import { SubscriptionPlan } from '../subscriptions/subscription-plan.entity';
import { Subscription, SubscriptionStatus } from '../subscriptions/subscription.entity';
import { PlansService } from '../subscriptions/plans.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { SandboxPaymentGateway } from './gateway/sandbox-payment.gateway';
import { ZarinpalPaymentGateway } from './gateway/zarinpal-payment.gateway';
import { CouponsService } from './coupons.service';
import { CheckoutDto } from './dto/checkout.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment)
    private paymentRepo: Repository<Payment>,
    private plansService: PlansService,
    private subscriptionsService: SubscriptionsService,
    private sandboxGateway: SandboxPaymentGateway,
    private zarinpalGateway: ZarinpalPaymentGateway,
    private couponsService: CouponsService,
    private auditService: AuditService,
    private dataSource: DataSource,
  ) {}

  async initiateCheckout(
    userId: string,
    dto: CheckoutDto,
    clientInfo?: { ip?: string; userAgent?: string },
  ) {
    // Prevent purchasing or changing plan if user already has an active purchased plan
    const activeSub = await this.subscriptionsService.getActiveSubscription(userId);
    if (
      activeSub &&
      activeSub.status === SubscriptionStatus.ACTIVE &&
      !activeSub.plan?.isDefault &&
      Number(activeSub.plan?.price) > 0
    ) {
      throw new BadRequestException(
        'شما در حال حاضر دارای اشتراک فعال هستید و امکان تغییر اشتراک وجود ندارد مگر اینکه توسط مدیر سیستم لغو شود.',
      );
    }

    const plan = await this.plansService.findById(dto.planId);
    if (!plan.isActive) {
      throw new BadRequestException('این پلن در حال حاضر غیرفعال است.');
    }

    // Check idempotency if key provided
    if (dto.idempotencyKey) {
      const existing = await this.paymentRepo.findOne({
        where: { idempotencyKey: dto.idempotencyKey },
        relations: ['plan'],
      });
      if (existing) {
        if (existing.status === PaymentStatus.PENDING && existing.authority) {
          return {
            paymentId: existing.id,
            authority: existing.authority,
            paymentUrl: `/sandbox-gateway?authority=${existing.authority}&amount=${existing.amount}`,
            isExisting: true,
          };
        }
        if (existing.status === PaymentStatus.SUCCESS) {
          return {
            paymentId: existing.id,
            status: 'ALREADY_PAID',
            message: 'این سفارش قبلاً با موفقیت پرداخت شده است.',
          };
        }
      }
    }

    const originalAmount = Number(plan.price);
    let discountAmount = 0;
    let finalAmount = originalAmount;
    let appliedCouponId: string | null = null;

    if (dto.couponCode) {
      const validation = await this.couponsService.validateCoupon(
        dto.couponCode,
        originalAmount,
        userId,
      );
      discountAmount = validation.discountAmount;
      finalAmount = validation.finalAmount;
      appliedCouponId = validation.couponId;
    }

    // Free plan or 100% discount bypass: 0 cost activates immediately without gateway
    if (finalAmount === 0) {
      const payment = this.paymentRepo.create({
        userId,
        planId: plan.id,
        amount: '0',
        originalAmount: String(originalAmount),
        discountAmount: String(discountAmount),
        couponId: appliedCouponId,
        currency: plan.currency,
        status: PaymentStatus.SUCCESS,
        gateway: 'free',
        refId: `FREE_${Date.now()}`,
        verifiedAt: new Date(),
        idempotencyKey: dto.idempotencyKey || null,
        ip: clientInfo?.ip || null,
        userAgent: clientInfo?.userAgent || null,
      });
      const savedPayment = await this.paymentRepo.save(payment);

      if (appliedCouponId) {
        await this.couponsService.recordUsage(
          appliedCouponId,
          userId,
          savedPayment.id,
          discountAmount,
        );
      }

      await this.subscriptionsService.assignPlanToUser({
        userId,
        planId: plan.id,
        paymentId: savedPayment.id,
        source: 'free_activation',
      });

      return {
        paymentId: savedPayment.id,
        status: PaymentStatus.SUCCESS,
        message: appliedCouponId
          ? 'کد تخفیف ۱۰۰٪ با موفقیت اعمال شد و پلن اشتراک فعال گردید.'
          : 'پلن رایگان با موفقیت فعال شد.',
      };
    }

    // Paid plan: create pending payment and invoke gateway
    const selectedGateway = dto.gateway === 'zarinpal' ? 'zarinpal' : (dto.gateway || 'sandbox');

    const payment = this.paymentRepo.create({
      userId,
      planId: plan.id,
      amount: String(finalAmount),
      originalAmount: String(originalAmount),
      discountAmount: String(discountAmount),
      couponId: appliedCouponId,
      currency: plan.currency,
      status: PaymentStatus.PENDING,
      gateway: selectedGateway,
      idempotencyKey: dto.idempotencyKey || null,
      ip: clientInfo?.ip || null,
      userAgent: clientInfo?.userAgent || null,
    });

    const saved = await this.paymentRepo.save(payment);

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    let callbackUrl = dto.callbackUrl || '/payment-result';
    if (callbackUrl.startsWith('/')) {
      callbackUrl = `${frontendUrl}${callbackUrl}`;
    }
    const gatewayProvider =
      selectedGateway === 'zarinpal' ? this.zarinpalGateway : this.sandboxGateway;

    const gatewayResult = await gatewayProvider.requestPayment({
      paymentId: saved.id,
      amount: finalAmount,
      currency: plan.currency,
      callbackUrl,
      description: `خرید اشتراک ${plan.name}`,
    });

    saved.authority = gatewayResult.authority;
    await this.paymentRepo.save(saved);

    await this.auditService.log({
      actorId: userId,
      actorType: 'user',
      action: 'payment.initiated',
      entityType: 'payment',
      entityId: saved.id,
      metadata: {
        planId: plan.id,
        amount: finalAmount,
        originalAmount,
        discountAmount,
        couponId: appliedCouponId,
        authority: saved.authority,
        gateway: selectedGateway,
      },
      ip: clientInfo?.ip,
      userAgent: clientInfo?.userAgent,
    });

    return {
      paymentId: saved.id,
      authority: saved.authority,
      paymentUrl: gatewayResult.paymentUrl,
    };
  }

  async verifyPayment(dto: VerifyPaymentDto, actorId?: string) {
    // 1. Atomically lock, verify and persist payment status in transaction
    const txResult = await this.dataSource.transaction(async (manager) => {
      const paymentRepo = manager.getRepository(Payment);

      const payment = await paymentRepo
        .createQueryBuilder('p')
        .where('p.authority = :authority', { authority: dto.authority })
        .setLock('pessimistic_write')
        .getOne();

      if (!payment) {
        throw new NotFoundException('تراکنش با این شناسه مرجع (authority) یافت نشد.');
      }

      if (payment.planId) {
        payment.plan = (await manager.getRepository(SubscriptionPlan).findOne({
          where: { id: payment.planId },
        })) as any;
      }

      // Idempotency: if already SUCCESS, return success state safely
      if (payment.status === PaymentStatus.SUCCESS) {
        return {
          alreadyVerified: true,
          payment,
        };
      }

      if (payment.status === PaymentStatus.CANCELLED || payment.status === PaymentStatus.FAILED) {
        return {
          cancelled: true,
          payment,
        };
      }

      // Verify with the appropriate gateway provider
      const gatewayProvider =
        payment.gateway === 'zarinpal' ? this.zarinpalGateway : this.sandboxGateway;

      const verifyResult = await gatewayProvider.verifyPayment({
        authority: dto.authority,
        amount: Number(payment.amount),
        payload: dto.payload || { status: dto.status },
      });

      if (!verifyResult.success) {
        const isCancellation =
          dto.status?.toUpperCase() === 'NOK' ||
          dto.payload?.cancel === true ||
          dto.payload?.status?.toUpperCase() === 'NOK' ||
          dto.payload?.Status?.toUpperCase() === 'NOK' ||
          verifyResult.message?.includes('لغو') ||
          verifyResult.message?.includes('انصراف');

        payment.status = isCancellation ? PaymentStatus.CANCELLED : PaymentStatus.FAILED;
        payment.metadata = {
          ...payment.metadata,
          failureReason: verifyResult.message,
          cancelledAt: isCancellation ? new Date() : undefined,
        };
        await paymentRepo.save(payment);

        return {
          failed: true,
          isCancellation,
          verifyResult,
          payment,
        };
      }

      // Mark payment SUCCESS
      payment.status = PaymentStatus.SUCCESS;
      payment.refId = verifyResult.refId;
      payment.verifiedAt = new Date();
      payment.metadata = { ...payment.metadata, gatewayResponse: verifyResult.rawResponse };
      await paymentRepo.save(payment);

      // Record coupon usage if a coupon was applied
      if (payment.couponId) {
        await this.couponsService.recordUsage(
          payment.couponId,
          payment.userId,
          payment.id,
          Number(payment.discountAmount || 0),
          manager,
        );
      }

      return {
        success: true,
        verifyResult,
        payment,
      };
    });

    // 2. Handle early exits after transaction has committed and released locks
    if (txResult.alreadyVerified) {
      return {
        success: true,
        refId: txResult.payment.refId,
        status: PaymentStatus.SUCCESS,
        message: 'این تراکنش قبلاً با موفقیت تأیید شده است.',
        alreadyVerified: true,
        payment: txResult.payment,
      };
    }

    if (txResult.cancelled) {
      return {
        success: false,
        refId: null,
        status: txResult.payment.status,
        message:
          txResult.payment.status === PaymentStatus.CANCELLED
            ? 'این تراکنش قبلاً لغو شده است.'
            : 'این تراکنش قبلاً ناموفق بوده است.',
        payment: txResult.payment,
      };
    }

    if (txResult.failed) {
      const actionName = txResult.isCancellation ? 'payment.cancelled' : 'payment.failed';
      await this.auditService.log({
        actorId: actorId || txResult.payment.userId,
        actorType: 'user',
        action: actionName,
        entityType: 'payment',
        entityId: txResult.payment.id,
        metadata: {
          authority: dto.authority,
          reason: txResult.verifyResult.message,
          status: txResult.payment.status,
        },
      });

      return {
        success: false,
        refId: null,
        status: txResult.payment.status,
        message:
          txResult.verifyResult.message ||
          (txResult.isCancellation ? 'تراکنش توسط کاربر لغو شد.' : 'پرداخت ناموفق بود.'),
        payment: txResult.payment,
      };
    }

    // 3. Activate subscription outside the payment lock transaction (avoids FK deadlock)
    await this.subscriptionsService.assignPlanToUser({
      userId: txResult.payment.userId,
      planId: txResult.payment.planId,
      paymentId: txResult.payment.id,
      source: 'purchase',
      actorId: txResult.payment.userId,
    });

    await this.auditService.log({
      actorId: actorId || txResult.payment.userId,
      actorType: 'user',
      action: 'payment.verified',
      entityType: 'payment',
      entityId: txResult.payment.id,
      metadata: {
        planId: txResult.payment.planId,
        amount: txResult.payment.amount,
        refId: txResult.payment.refId,
      },
    });

    return {
      success: true,
      refId: txResult.payment.refId,
      message: 'پرداخت با موفقیت تأیید و اشتراک فعال گردید.',
      payment: txResult.payment,
    };
  }

  /**
   * Automatically transition stale PENDING payments older than 20 minutes (standard gateway expiration window)
   * to CANCELLED status so abandoned sessions don't remain PENDING indefinitely.
   */
  async expireStalePendingPayments(): Promise<void> {
    try {
      const twentyMinutesAgo = new Date(Date.now() - 20 * 60 * 1000);
      await this.paymentRepo
        .createQueryBuilder()
        .update(Payment)
        .set({
          status: PaymentStatus.CANCELLED,
        })
        .where('status = :pending AND "createdAt" < :cutoff', {
          pending: PaymentStatus.PENDING,
          cutoff: twentyMinutesAgo,
        })
        .execute();
    } catch {
      // Fail-soft for in-memory mock or testing environments
    }
  }

  async getPaymentByAuthority(authority: string): Promise<Payment> {
    const payment = await this.paymentRepo.findOne({
      where: { authority },
      relations: ['plan'],
    });
    if (!payment) {
      throw new NotFoundException('تراکنش یافت نشد.');
    }
    if (
      payment.status === PaymentStatus.PENDING &&
      payment.createdAt &&
      Date.now() - new Date(payment.createdAt).getTime() > 20 * 60 * 1000
    ) {
      payment.status = PaymentStatus.CANCELLED;
      payment.metadata = {
        ...payment.metadata,
        failureReason: 'انقضای مهلت پرداخت در درگاه بانکی',
      };
      await this.paymentRepo.save(payment).catch(() => {});
    }
    return payment;
  }

  async findUserPayments(userId: string): Promise<Payment[]> {
    await this.expireStalePendingPayments();
    return this.paymentRepo.find({
      where: { userId },
      relations: ['plan'],
      order: { createdAt: 'DESC' },
    });
  }

  async findAllForAdmin(options: {
    page?: number;
    limit?: number;
    userId?: string;
    status?: PaymentStatus;
  }) {
    await this.expireStalePendingPayments();
    const page = Math.max(1, Number(options.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(options.limit) || 20));
    const skip = (page - 1) * limit;

    const qb = this.paymentRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.user', 'user')
      .leftJoinAndSelect('p.plan', 'plan');

    if (options.userId) {
      qb.andWhere('p.userId = :userId', { userId: options.userId });
    }
    if (options.status) {
      qb.andWhere('p.status = :status', { status: options.status });
    }

    qb.orderBy('p.createdAt', 'DESC');
    qb.skip(skip).take(limit);

    const [items, total] = await qb.getManyAndCount();

    // Aggregated revenue & count for successful payments
    const statsRaw = await this.paymentRepo
      .createQueryBuilder('p')
      .select([
        'COALESCE(SUM(CASE WHEN p.status = :success THEN CAST(p.amount AS BIGINT) ELSE 0 END), 0) AS "totalRevenue"',
        'COUNT(CASE WHEN p.status = :success THEN 1 END) AS "successfulCount"',
      ])
      .setParameter('success', PaymentStatus.SUCCESS)
      .getRawOne();

    const totalRevenue = Number(statsRaw?.totalRevenue || 0);
    const successfulCount = Number(statsRaw?.successfulCount || 0);

    // Active subscriptions count breakdown by plan
    const subsRaw = await this.dataSource
      .getRepository(Subscription)
      .createQueryBuilder('s')
      .leftJoin('s.plan', 'plan')
      .select([
        'plan.id AS "planId"',
        'COALESCE(plan.name, \'نامشخص\') AS "planName"',
        'COUNT(s.id) AS count',
      ])
      .where('s.status = :active', { active: SubscriptionStatus.ACTIVE })
      .groupBy('plan.id, plan.name')
      .getRawMany();

    const subscriptionsByPlan = subsRaw.map((r) => ({
      planId: r.planId,
      planName: r.planName,
      count: Number(r.count || 0),
    }));

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      stats: {
        totalRevenue,
        successfulCount,
        subscriptionsByPlan,
      },
    };
  }

  async validateCouponForUser(code: string, planId: string, userId: string) {
    const plan = await this.plansService.findById(planId);
    if (!plan) {
      throw new NotFoundException('پلن اشتراک یافت نشد.');
    }
    return this.couponsService.validateCoupon(code, Number(plan.price), userId);
  }
}

