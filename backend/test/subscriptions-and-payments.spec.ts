import { sanitizeAuditData, AuditService } from '../src/modules/audit/audit.service';
import { PlansService } from '../src/modules/subscriptions/plans.service';
import { SubscriptionsService } from '../src/modules/subscriptions/subscriptions.service';
import { EntitlementService } from '../src/modules/subscriptions/entitlement.service';
import { PaymentsService } from '../src/modules/payments/payments.service';
import { SandboxPaymentGateway } from '../src/modules/payments/gateway/sandbox-payment.gateway';
import { ZarinpalPaymentGateway } from '../src/modules/payments/gateway/zarinpal-payment.gateway';
import { CouponsService } from '../src/modules/payments/coupons.service';
import { PaymentStatus } from '../src/modules/payments/payment.entity';
import { SubscriptionStatus } from '../src/modules/subscriptions/subscription.entity';

function makeMockRepo(initialRows: any[] = []) {
  let rows = [...initialRows];
  const matches = (row: any, where: any = {}) => {
    if (!where) return true;
    return Object.entries(where).every(([k, v]) => {
      if (v === null || v === undefined) return row[k] === v;
      return row[k] === v;
    });
  };

  return {
    rows,
    find: jest.fn(async (opts: any = {}) => {
      let filtered = rows;
      if (opts.where) filtered = filtered.filter((r) => matches(r, opts.where));
      return filtered;
    }),
    findOne: jest.fn(async (opts: any = {}) => {
      let filtered = rows;
      if (opts.where) filtered = filtered.filter((r) => matches(r, opts.where));
      return filtered[0] ?? null;
    }),
    findOneOrFail: jest.fn(async (opts: any = {}) => {
      let filtered = rows;
      if (opts.where) filtered = filtered.filter((r) => matches(r, opts.where));
      if (!filtered[0]) throw new Error('Not found');
      return filtered[0];
    }),
    create: jest.fn((d: any) => ({ id: d.id || 'id_' + Math.random().toString(36).slice(2), ...d })),
    save: jest.fn(async (item: any) => {
      const idx = rows.findIndex((r) => r.id === item.id);
      if (idx >= 0) {
        rows[idx] = { ...rows[idx], ...item };
        return rows[idx];
      } else {
        rows.push(item);
        return item;
      }
    }),
    update: jest.fn(async (criteria: any, patch: any) => {
      rows.forEach((r) => {
        if (matches(r, criteria)) Object.assign(r, patch);
      });
    }),
    delete: jest.fn(async (criteria: any) => {
      rows = rows.filter((r) => !matches(r, criteria));
    }),
    createQueryBuilder: jest.fn(() => {
      let currentWhere = '';
      let whereParams: any = {};
      const builder: any = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn((clause: string, params?: any) => {
          currentWhere = clause;
          whereParams = params || {};
          return builder;
        }),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        setLock: jest.fn().mockReturnThis(),
        getOne: jest.fn(async () => {
          if (whereParams?.authority) {
            return rows.find((r) => r.authority === whereParams.authority) ?? null;
          }
          return rows[0] ?? null;
        }),
        getMany: jest.fn(async () => rows.filter((r) => !r.isDeleted)),
        getManyAndCount: jest.fn(async () => [rows.filter((r) => !r.isDeleted), rows.length]),
      };
      return builder;
    }),
  };
}

describe('Audit Logging & Secret Sanitization', () => {
  it('recursively redacts passwords, tokens, and sensitive keys', () => {
    const raw = {
      user: 'alice',
      password: 'secretPassword123',
      nested: {
        token: 'ey123456',
        apiKey: 'sk-1234',
        safeField: 'hello',
        secretCode: '9999',
      },
      list: [{ cardNumber: '1234-5678', label: 'visa' }],
    };

    const sanitized = sanitizeAuditData(raw);
    expect(sanitized.password).toBe('[REDACTED]');
    expect(sanitized.nested.token).toBe('[REDACTED]');
    expect(sanitized.nested.apiKey).toBe('[REDACTED]');
    expect(sanitized.nested.secretCode).toBe('[REDACTED]');
    expect(sanitized.nested.safeField).toBe('hello');
    expect(sanitized.list[0].cardNumber).toBe('[REDACTED]');
    expect(sanitized.list[0].label).toBe('visa');
  });

  it('AuditService logs sanitized events safely', async () => {
    const repo = makeMockRepo([]);
    const auditService = new AuditService(repo as any);

    await auditService.log({
      actorId: 'admin1',
      actorType: 'admin',
      action: 'test.action',
      entityType: 'subscription',
      entityId: 'sub123',
      changes: { before: { password: 'old' }, after: { password: 'new' } },
      metadata: { apiKey: 'key_123' },
    });

    expect(repo.save).toHaveBeenCalled();
    const saved = repo.rows[0];
    expect(saved.changes.before.password).toBe('[REDACTED]');
    expect(saved.changes.after.password).toBe('[REDACTED]');
    expect(saved.metadata.apiKey).toBe('[REDACTED]');
  });
});

describe('Subscriptions & Entitlement Engine', () => {
  let auditService: AuditService;
  let plansRepo: any;
  let planModelRepo: any;
  let aiModelRepo: any;
  let plansService: PlansService;
  let subscriptionRepo: any;
  let subscriptionsService: SubscriptionsService;
  let userRepo: any;
  let settingsService: any;
  let entitlementService: EntitlementService;

  beforeEach(() => {
    const auditRepo = makeMockRepo([]);
    auditService = new AuditService(auditRepo as any);

    const initialPlans = [
      {
        id: 'plan_free',
        slug: 'free',
        name: 'طرح رایگان',
        price: '0',
        currency: 'IRR',
        durationDays: 0,
        tokenQuota: 0, // inherits global limit
        messageQuota: null,
        resetHours: 6,
        features: { webSearch: false, thinking: false },
        isActive: true,
        isDefault: true,
        isDeleted: false,
        planModels: [],
      },
      {
        id: 'plan_pro',
        slug: 'pro',
        name: 'طرح حرفه‌ای',
        price: '500000',
        currency: 'IRR',
        durationDays: 30,
        tokenQuota: 2000000,
        messageQuota: 500,
        resetHours: 12,
        features: { webSearch: true, thinking: true },
        isActive: true,
        isDefault: false,
        isDeleted: false,
        planModels: [{ planId: 'plan_pro', modelId: 'model_commercial' }],
      },
    ];

    plansRepo = makeMockRepo(initialPlans);
    planModelRepo = makeMockRepo([]);
    aiModelRepo = makeMockRepo([
      { id: 'model_public', name: 'Public AI', accessLevel: 'public', isActive: true, isDeleted: false },
      { id: 'model_commercial', name: 'Pro AI', accessLevel: 'commercial', isActive: true, isDeleted: false },
    ]);

    plansService = new PlansService(plansRepo as any, planModelRepo as any, aiModelRepo as any, auditService);

    subscriptionRepo = makeMockRepo([]);
    subscriptionsService = new SubscriptionsService(subscriptionRepo as any, plansRepo as any, plansService, auditService);

    userRepo = makeMockRepo([
      { id: 'u_regular', email: 'regular@example.com', role: 'user', tokenLimit: null },
      { id: 'u_override', email: 'override@example.com', role: 'user', tokenLimit: 100000 },
      { id: 'u_admin', email: 'admin@example.com', role: 'admin', tokenLimit: null },
    ]);

    settingsService = {
      getGlobalTokenLimit: jest.fn(async () => 50000),
      getRoleQuotas: jest.fn(async () => ({ user: { tokenLimit: null, messageLimit: null } })),
    };

    entitlementService = new EntitlementService(
      userRepo as any,
      aiModelRepo as any,
      planModelRepo as any,
      subscriptionsService,
      plansService,
      settingsService,
    );
  });

  it('admin has unlimited quotas and full model/feature access', async () => {
    const ent = await entitlementService.getUserEntitlements('u_admin');
    expect(ent.isAdmin).toBe(true);
    expect(ent.effectiveTokenLimit).toBeNull();
    expect(ent.features.webSearch).toBe(true);
    expect(ent.features.thinking).toBe(true);
    expect(ent.allowedModelIds).toBeNull();
  });

  it('regular user on default plan inherits global quota and has no pro features', async () => {
    const ent = await entitlementService.getUserEntitlements('u_regular');
    expect(ent.isAdmin).toBe(false);
    expect(ent.hasActiveSubscription).toBe(false);
    expect(ent.effectiveTokenLimit).toBe(50000);
    expect(ent.limitSource).toBe('global');
    expect(ent.features.webSearch).toBe(false);
  });

  it('exposes only models assigned to the free plan for a free user', async () => {
    plansRepo.rows[0].planModels = [
      { modelId: 'model_free_1' },
      { modelId: 'model_free_2' },
      { modelId: 'model_free_3' },
    ];
    aiModelRepo.rows.push(
      { id: 'model_free_1', accessLevel: 'public', isActive: true, isDeleted: false },
      { id: 'model_free_2', accessLevel: 'public', isActive: true, isDeleted: false },
      { id: 'model_free_3', accessLevel: 'public', isActive: true, isDeleted: false },
      { id: 'model_not_in_free', accessLevel: 'public', isActive: true, isDeleted: false },
    );

    const ent = await entitlementService.getUserEntitlements('u_regular');

    expect(ent.allowedModelIds).toEqual(['model_free_1', 'model_free_2', 'model_free_3']);
    expect(await entitlementService.isModelAllowedForUser(
      aiModelRepo.rows.find((model: any) => model.id === 'model_free_1'),
      { id: 'u_regular', role: 'user' },
    )).toBe(true);
    expect(await entitlementService.isModelAllowedForUser(
      aiModelRepo.rows.find((model: any) => model.id === 'model_not_in_free'),
      { id: 'u_regular', role: 'user' },
    )).toBe(false);
  });

  it('assigning Pro subscription updates entitlements, quotas and allowed models', async () => {
    const commercialModel = { id: 'model_commercial', accessLevel: 'commercial', isActive: true, isDeleted: false } as any;
    // Set planModelRepo so model_commercial is known to belong to plan_pro
    planModelRepo.rows = [{ planId: 'plan_pro', modelId: 'model_commercial' }];

    // Non-subscribed user is denied access to commercial model assigned to paid plan
    const deniedBefore = await entitlementService.isModelAllowedForUser(commercialModel, { id: 'u_regular', role: 'user' });
    expect(deniedBefore).toBe(false);

    await subscriptionsService.assignPlanToUser({
      userId: 'u_regular',
      planId: 'plan_pro',
      source: 'test',
    });

    const ent = await entitlementService.getUserEntitlements('u_regular');
    expect(ent.hasActiveSubscription).toBe(true);
    expect(ent.plan?.slug).toBe('pro');
    expect(ent.effectiveTokenLimit).toBe(2000000);
    expect(ent.limitSource).toBe('plan');
    expect(ent.features.webSearch).toBe(true);
    expect(ent.features.thinking).toBe(true);

    const allowed = await entitlementService.isModelAllowedForUser(commercialModel, { id: 'u_regular', role: 'user' });
    expect(allowed).toBe(true);
  });

  it('personal override takes highest precedence over active subscription and global quota', async () => {
    await subscriptionsService.assignPlanToUser({
      userId: 'u_override',
      planId: 'plan_pro',
      source: 'test',
    });

    const ent = await entitlementService.getUserEntitlements('u_override');
    expect(ent.effectiveTokenLimit).toBe(100000);
    expect(ent.limitSource).toBe('personal');
  });

  it('lazy expiration marks outdated subscription as EXPIRED on access', async () => {
    const pastDate = new Date(Date.now() - 3600000);
    subscriptionRepo.rows.push({
      id: 'sub_expired',
      userId: 'u_regular',
      planId: 'plan_pro',
      status: SubscriptionStatus.ACTIVE,
      startDate: new Date(Date.now() - 86400000 * 35),
      endDate: pastDate,
      plan: plansRepo.rows[1],
    });

    const active = await subscriptionsService.getActiveSubscription('u_regular');
    expect(active).toBeNull();
    expect(subscriptionRepo.rows[0].status).toBe(SubscriptionStatus.EXPIRED);

    const entitlements = await entitlementService.getUserEntitlements('u_regular');
    expect(entitlements.subscriptionExpired).toBe(true);
    expect(entitlements.expiredPlanName).toBe('طرح حرفه‌ای');
    expect(entitlements.plan?.slug).toBe('free');
    expect(entitlements.hasActiveSubscription).toBe(false);
    expect(entitlements.features.thinking).toBe(false);
    expect(entitlements.features.webSearch).toBe(false);
  });
});

describe('Payments & Sandbox Gateway Flow', () => {
  let paymentRepo: any;
  let subscriptionRepo: any;
  let plansRepo: any;
  let plansService: PlansService;
  let subscriptionsService: SubscriptionsService;
  let sandboxGateway: SandboxPaymentGateway;
  let auditService: AuditService;
  let paymentsService: PaymentsService;
  let mockDataSource: any;

  beforeEach(() => {
    paymentRepo = makeMockRepo([]);
    subscriptionRepo = makeMockRepo([]);
    plansRepo = makeMockRepo([
      { id: 'plan_free', slug: 'free', name: 'رایگان', price: '0', currency: 'IRR', durationDays: 0, isActive: true, isDeleted: false },
      { id: 'plan_pro', slug: 'pro', name: 'پرو', price: '250000', currency: 'IRR', durationDays: 30, isActive: true, isDeleted: false },
    ]);

    const auditRepo = makeMockRepo([]);
    auditService = new AuditService(auditRepo as any);
    plansService = new PlansService(plansRepo as any, makeMockRepo([]) as any, makeMockRepo([]) as any, auditService);
    subscriptionsService = new SubscriptionsService(subscriptionRepo as any, plansRepo as any, plansService, auditService);
    sandboxGateway = new SandboxPaymentGateway();

    // Mock DataSource with transaction helper that executes callback with manager
    mockDataSource = {
      transaction: jest.fn(async (cb: any) => {
        const manager = {
          getRepository: (entity: any) => paymentRepo,
        };
        return cb(manager);
      }),
    };

    const zarinpalGateway = new ZarinpalPaymentGateway();
    const couponRepo = makeMockRepo([]);
    const usageRepo = makeMockRepo([]);
    const couponsService = new CouponsService(couponRepo as any, usageRepo as any);

    paymentsService = new PaymentsService(
      paymentRepo as any,
      plansService,
      subscriptionsService,
      sandboxGateway,
      zarinpalGateway,
      couponsService,
      auditService,
      mockDataSource as any,
    );
  });

  it('free plan checkout activates immediately without gateway invocation', async () => {
    const res = await paymentsService.initiateCheckout('u1', { planId: 'plan_free' });
    expect(res.status).toBe(PaymentStatus.SUCCESS);
    expect(subscriptionRepo.rows.length).toBe(1);
    expect(subscriptionRepo.rows[0].planId).toBe('plan_free');
    expect(paymentRepo.rows[0].status).toBe(PaymentStatus.SUCCESS);
  });

  it('paid plan checkout generates sandbox authority and payment URL', async () => {
    const res = await paymentsService.initiateCheckout('u1', { planId: 'plan_pro' });
    expect(res.authority).toBeDefined();
    expect(res.authority.startsWith('SBX_')).toBe(true);
    expect(res.paymentUrl).toContain('/sandbox-gateway?authority=');
    expect(paymentRepo.rows[0].status).toBe(PaymentStatus.PENDING);
  });

  it('payment verification succeeds and activates user subscription atomically', async () => {
    const checkout = await paymentsService.initiateCheckout('u1', { planId: 'plan_pro' });
    const verifyRes = await paymentsService.verifyPayment({
      authority: checkout.authority,
      status: 'OK',
    });

    expect(verifyRes.success).toBe(true);
    expect(verifyRes.refId).toBeDefined();
    expect(paymentRepo.rows[0].status).toBe(PaymentStatus.SUCCESS);
    expect(subscriptionRepo.rows.length).toBe(1);
    expect(subscriptionRepo.rows[0].planId).toBe('plan_pro');
    expect(subscriptionRepo.rows[0].status).toBe(SubscriptionStatus.ACTIVE);
  });

  it('payment verification is idempotent: repeated call returns success without duplicate side-effects', async () => {
    const checkout = await paymentsService.initiateCheckout('u1', { planId: 'plan_pro' });
    await paymentsService.verifyPayment({ authority: checkout.authority, status: 'OK' });
    expect(subscriptionRepo.rows.length).toBe(1);

    // Call verify again
    const secondCall = await paymentsService.verifyPayment({ authority: checkout.authority, status: 'OK' });
    expect(secondCall.success).toBe(true);
    expect(secondCall.alreadyVerified).toBe(true);
    // No duplicate subscription row
    expect(subscriptionRepo.rows.length).toBe(1);
  });

  it('failed gateway callback marks payment as FAILED and does not activate plan', async () => {
    const checkout = await paymentsService.initiateCheckout('u1', { planId: 'plan_pro' });
    const verifyRes = await paymentsService.verifyPayment({
      authority: checkout.authority,
      status: 'NOK',
      payload: { cancel: true },
    });

    expect(verifyRes.success).toBe(false);
    expect(paymentRepo.rows[0].status).toBe(PaymentStatus.FAILED);
    expect(subscriptionRepo.rows.length).toBe(0);
  });

  it('checkout is rejected if user already has an active purchased plan', async () => {
    await subscriptionsService.assignPlanToUser({
      userId: 'u_paid',
      planId: 'plan_pro',
      source: 'test',
    });

    await expect(
      paymentsService.initiateCheckout('u_paid', { planId: 'plan_pro' }),
    ).rejects.toThrow('شما در حال حاضر دارای اشتراک فعال هستید و امکان تغییر اشتراک وجود ندارد');
  });

  it('findUserPayments returns user payments filtered by userId', async () => {
    await paymentsService.initiateCheckout('u1', { planId: 'plan_pro' });
    await paymentsService.initiateCheckout('u2', { planId: 'plan_pro' });

    const u1Payments = await paymentsService.findUserPayments('u1');
    expect(u1Payments.length).toBe(1);
    expect(u1Payments[0].userId).toBe('u1');

    const u2Payments = await paymentsService.findUserPayments('u2');
    expect(u2Payments.length).toBe(1);
    expect(u2Payments[0].userId).toBe('u2');

    const emptyPayments = await paymentsService.findUserPayments('non_existent');
    expect(emptyPayments.length).toBe(0);
  });
});
