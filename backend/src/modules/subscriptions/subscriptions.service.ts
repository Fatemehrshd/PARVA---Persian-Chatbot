import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, DataSource } from 'typeorm';
import { Subscription, SubscriptionStatus } from './subscription.entity';
import { SubscriptionPlan } from './subscription-plan.entity';
import { PlansService } from './plans.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class SubscriptionsService {
  constructor(
    @InjectRepository(Subscription)
    private subscriptionRepo: Repository<Subscription>,
    @InjectRepository(SubscriptionPlan)
    private planRepo: Repository<SubscriptionPlan>,
    private plansService: PlansService,
    private auditService: AuditService,
    private dataSource?: DataSource,
  ) {}

  /**
   * Finds the currently active subscription of the user.
   * Performs lazy expiration check if the subscription has passed its endDate.
   */
  async getActiveSubscription(userId: string): Promise<Subscription | null> {
    const active = await this.subscriptionRepo.findOne({
      where: {
        userId,
        status: SubscriptionStatus.ACTIVE,
      },
      relations: ['plan', 'plan.planModels', 'plan.planModels.model'],
      order: { createdAt: 'DESC' },
    });

    if (!active) {
      return null;
    }

    // Lazy expiration check
    if (active.endDate && new Date(active.endDate).getTime() < Date.now()) {
      active.status = SubscriptionStatus.EXPIRED;
      await this.subscriptionRepo.save(active);

      await this.auditService.log({
        actorId: userId,
        actorType: 'system',
        action: 'subscription.expired',
        entityType: 'subscription',
        entityId: active.id,
        metadata: { userId, planId: active.planId },
      });

      return null;
    }

    return active;
  }

  async getUserHistory(userId: string): Promise<Subscription[]> {
    return this.subscriptionRepo.find({
      where: { userId },
      relations: ['plan'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Assigns a plan to a user.
   * Marks any currently active subscription as EXPIRED or superseded.
   * Wrapped in an atomic database transaction to prevent inconsistent states.
   */
  async assignPlanToUser(options: {
    userId: string;
    planId: string;
    source?: string;
    paymentId?: string;
    durationDays?: number;
    actorId?: string;
    actorType?: 'admin' | 'user' | 'system';
  }): Promise<Subscription> {
    const plan = await this.plansService.findById(options.planId);
    const duration = options.durationDays !== undefined ? options.durationDays : plan.durationDays;
    const startDate = new Date();
    const endDate = duration > 0 ? new Date(startDate.getTime() + duration * 86400000) : null;

    let saved: Subscription;
    if (this.dataSource) {
      saved = await this.dataSource.transaction(async (manager) => {
        const subRepo = manager.getRepository(Subscription);

        // Deactivate previous active subscriptions atomically
        const currentActive = await subRepo.find({
          where: { userId: options.userId, status: SubscriptionStatus.ACTIVE },
        });

        for (const sub of currentActive) {
          sub.status = SubscriptionStatus.CANCELLED;
          sub.cancelledAt = new Date();
          sub.cancellationReason = 'superseded_by_new_plan';
          await subRepo.save(sub);
        }

        const newSub = subRepo.create({
          userId: options.userId,
          planId: plan.id,
          plan: plan,
          status: SubscriptionStatus.ACTIVE,
          startDate,
          endDate,
          paymentId: options.paymentId || null,
          source: options.source || 'purchase',
        });

        return await subRepo.save(newSub);
      });
    } else {
      const currentActive = await this.subscriptionRepo.find({
        where: { userId: options.userId, status: SubscriptionStatus.ACTIVE },
      });

      for (const sub of currentActive) {
        sub.status = SubscriptionStatus.CANCELLED;
        sub.cancelledAt = new Date();
        sub.cancellationReason = 'superseded_by_new_plan';
        await this.subscriptionRepo.save(sub);
      }

      const newSub = this.subscriptionRepo.create({
        userId: options.userId,
        planId: plan.id,
        plan: plan,
        status: SubscriptionStatus.ACTIVE,
        startDate,
        endDate,
        paymentId: options.paymentId || null,
        source: options.source || 'purchase',
      });

      saved = await this.subscriptionRepo.save(newSub);
    }

    await this.auditService.log({
      actorId: options.actorId ?? options.userId,
      actorType: options.actorType ?? 'user',
      action: 'subscription.assigned',
      entityType: 'subscription',
      entityId: saved.id,
      metadata: {
        userId: options.userId,
        planId: plan.id,
        planName: plan.name,
        source: options.source,
        paymentId: options.paymentId,
      },
    });

    return this.subscriptionRepo.findOneOrFail({
      where: { id: saved.id },
      relations: ['plan', 'plan.planModels', 'plan.planModels.model'],
    });
  }

  async cancelSubscription(
    id: string,
    reason?: string,
    actorId?: string,
  ): Promise<Subscription> {
    const sub = await this.subscriptionRepo.findOne({
      where: { id },
      relations: ['plan'],
    });
    if (!sub) {
      throw new NotFoundException('اشتراک مورد نظر یافت نشد.');
    }

    sub.status = SubscriptionStatus.CANCELLED;
    sub.cancelledAt = new Date();
    sub.cancellationReason = reason || 'cancelled_by_admin';
    const saved = await this.subscriptionRepo.save(sub);

    await this.auditService.log({
      actorId,
      actorType: 'admin',
      action: 'subscription.cancelled',
      entityType: 'subscription',
      entityId: sub.id,
      metadata: { userId: sub.userId, reason },
    });

    return saved;
  }

  async findAllForAdmin(options: {
    page?: number;
    limit?: number;
    userId?: string;
    status?: SubscriptionStatus;
  }) {
    const page = Math.max(1, Number(options.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(options.limit) || 20));
    const skip = (page - 1) * limit;

    const qb = this.subscriptionRepo
      .createQueryBuilder('sub')
      .leftJoinAndSelect('sub.user', 'user')
      .leftJoinAndSelect('sub.plan', 'plan');

    if (options.userId) {
      qb.andWhere('sub.userId = :userId', { userId: options.userId });
    }
    if (options.status) {
      qb.andWhere('sub.status = :status', { status: options.status });
    }

    qb.orderBy('sub.createdAt', 'DESC');
    qb.skip(skip).take(limit);

    const [items, total] = await qb.getManyAndCount();

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
