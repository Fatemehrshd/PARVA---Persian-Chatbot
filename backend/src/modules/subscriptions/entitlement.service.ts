import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { AiModel } from '../models-admin/ai-model.entity';
import { SubscriptionsService } from './subscriptions.service';
import { PlansService } from './plans.service';
import { SettingsService } from '../admin/settings.service';
import { SubscriptionPlan } from './subscription-plan.entity';
import { PlanModel } from './plan-model.entity';
import { SubscriptionStatus } from './subscription.entity';

export interface UserEntitlements {
  userId: string;
  role: string;
  isAdmin: boolean;
  plan: SubscriptionPlan | null;
  hasActiveSubscription: boolean;
  effectiveTokenLimit: number | null;
  effectiveMessageLimit: number | null;
  limitSource: 'personal' | 'plan' | 'role' | 'global' | 'admin';
  features: {
    webSearch: boolean;
    thinking: boolean;
    document: boolean;
    maxFileSizeMb: number;
    [key: string]: any;
  };
  allowedModelIds: string[] | null; // null means all models allowed
}

@Injectable()
export class EntitlementService {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(AiModel)
    private modelRepo: Repository<AiModel>,
    @InjectRepository(PlanModel)
    private planModelRepo: Repository<PlanModel>,
    private subscriptionsService: SubscriptionsService,
    private plansService: PlansService,
    @Inject(forwardRef(() => SettingsService))
    private settingsService: SettingsService,
  ) {}

  async getUserEntitlements(userId: string): Promise<UserEntitlements> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    const role = user?.role || 'user';
    const isAdmin = role === 'admin';

    if (isAdmin) {
      return {
        userId,
        role,
        isAdmin: true,
        plan: null,
        hasActiveSubscription: true,
        effectiveTokenLimit: null,
        effectiveMessageLimit: null,
        limitSource: 'admin',
        features: {
          webSearch: true,
          thinking: true,
          document: true,
          maxFileSizeMb: 100,
        },
        allowedModelIds: null, // all models allowed
      };
    }

    // Regular user: lookup active subscription
    const activeSub = await this.subscriptionsService.getActiveSubscription(userId);
    let plan = activeSub?.plan ?? null;
    const hasActiveSubscription = !!activeSub;

    if (!plan) {
      plan = await this.plansService.findDefaultPlan();
    }

    // Fetch global limits
    const globalTokenLimit = await this.settingsService.getGlobalTokenLimit();
    const roleQuotas = await this.settingsService.getRoleQuotas();
    const roleQuotaLimit = roleQuotas[role]?.tokenLimit;

    // 1. Quota cascade: personal > plan > role > global
    let effectiveTokenLimit: number | null = null;
    let limitSource: 'personal' | 'plan' | 'role' | 'global' = 'global';

    if (user?.tokenLimit !== null && user?.tokenLimit !== undefined && Number(user.tokenLimit) > 0) {
      effectiveTokenLimit = Number(user.tokenLimit);
      limitSource = 'personal';
    } else if (hasActiveSubscription && plan && plan.tokenQuota > 0) {
      effectiveTokenLimit = Number(plan.tokenQuota);
      limitSource = 'plan';
    } else if (roleQuotaLimit !== undefined && roleQuotaLimit !== null && Number(roleQuotaLimit) > 0) {
      effectiveTokenLimit = Number(roleQuotaLimit);
      limitSource = 'role';
    } else if (globalTokenLimit > 0) {
      effectiveTokenLimit = globalTokenLimit;
      limitSource = 'global';
    }

    // Message limit cascade
    let effectiveMessageLimit: number | null = null;
    if (user?.messageLimit !== null && user?.messageLimit !== undefined && Number(user.messageLimit) > 0) {
      effectiveMessageLimit = Number(user.messageLimit);
    } else if (hasActiveSubscription && plan && plan.messageQuota) {
      effectiveMessageLimit = Number(plan.messageQuota);
    } else if (roleQuotas[role]?.messageLimit) {
      effectiveMessageLimit = Number(roleQuotas[role].messageLimit);
    }

    // Features
    const planFeatures = plan?.features || {};
    const features = {
      webSearch: !!planFeatures.webSearch,
      thinking: !!planFeatures.thinking,
      document: !!planFeatures.document,
      maxFileSizeMb: planFeatures.maxFileSizeMb || 25,
    };

    // Allowed model IDs
    let allowedModelIds: string[] | null = null;
    if (plan?.planModels) {
      const planAssignedModelIds = plan.planModels.map((pm) => pm.modelId);
      // Public models are always accessible
      const publicModels = await this.modelRepo.find({
        where: { accessLevel: 'public', isDeleted: false, isActive: true },
        select: ['id'],
      });
      const publicIds = publicModels.map((m) => m.id);
      allowedModelIds = Array.from(new Set([...planAssignedModelIds, ...publicIds]));
    }

    return {
      userId,
      role,
      isAdmin: false,
      plan,
      hasActiveSubscription,
      effectiveTokenLimit,
      effectiveMessageLimit,
      limitSource,
      features,
      allowedModelIds,
    };
  }

  async isModelAllowedForUser(
    model: AiModel,
    user: { id: string; role?: string },
  ): Promise<boolean> {
    if (model.isActive === false || model.isDeleted === true) return false;
    if (user.role === 'admin') return true;

    // 1. Private access check
    if (model.accessLevel === 'private') {
      return (
        !!user.id &&
        Array.isArray(model.allowedUserIds) &&
        model.allowedUserIds.includes(user.id)
      );
    }

    // 2. Check if this model is assigned to any active, paid subscription plan(s)
    const planModels = await this.planModelRepo.find({
      where: { modelId: model.id },
      relations: ['plan'],
    });

    const activePaidPlansWithModel = planModels
      .map((pm) => pm.plan)
      .filter((p) => p && p.isActive && !p.isDeleted && !p.isDefault && Number(p.price) > 0);

    if (activePaidPlansWithModel.length > 0) {
      // Model is tied to paid plan(s): User MUST have an active subscription to one of them
      const activeSub = await this.subscriptionsService.getActiveSubscription(user.id);
      if (!activeSub || activeSub.status !== SubscriptionStatus.ACTIVE) {
        return false;
      }
      return activePaidPlansWithModel.some((p) => p.id === activeSub.planId);
    }

    // 3. Commercial access level check (for models marked commercial without explicit plan binding)
    if (model.accessLevel === 'commercial') {
      const entitlements = await this.getUserEntitlements(user.id);
      if (!entitlements.hasActiveSubscription) {
        return false;
      }
      if (entitlements.allowedModelIds && !entitlements.allowedModelIds.includes(model.id)) {
        return false;
      }
      return true;
    }

    return true;
  }
}
