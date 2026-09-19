import { CouponsService } from '../src/modules/payments/coupons.service';
import { ZarinpalPaymentGateway } from '../src/modules/payments/gateway/zarinpal-payment.gateway';
import { SandboxPaymentGateway } from '../src/modules/payments/gateway/sandbox-payment.gateway';
import { PaymentsService } from '../src/modules/payments/payments.service';
import { PaymentStatus } from '../src/modules/payments/payment.entity';
import { SubscriptionStatus } from '../src/modules/subscriptions/subscription.entity';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

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
    count: jest.fn(async (opts: any = {}) => {
      let filtered = rows;
      if (opts.where) filtered = filtered.filter((r) => matches(r, opts.where));
      return filtered.length;
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
    increment: jest.fn(async (criteria: any, field: string, value: number) => {
      rows.forEach((r) => {
        if (matches(r, criteria)) {
          r[field] = (Number(r[field]) || 0) + value;
        }
      });
    }),
    remove: jest.fn(async (item: any) => {
      rows = rows.filter((r) => r.id !== item.id);
      return item;
    }),
    createQueryBuilder: jest.fn(() => {
      const builder: any = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn(async () => [rows, rows.length]),
      };
      return builder;
    }),
  };
}

describe('CouponsService & Discount Code Logic', () => {
  let couponsService: CouponsService;
  let couponRepo: any;
  let usageRepo: any;

  beforeEach(() => {
    couponRepo = makeMockRepo([]);
    usageRepo = makeMockRepo([]);
    couponsService = new CouponsService(couponRepo, usageRepo);
  });

  it('normalizes coupon codes to uppercase and prevents duplicates', async () => {
    await couponsService.create({
      code: '  welcome20  ',
      discountType: 'PERCENTAGE',
      discountValue: 20,
    });

    expect(couponRepo.rows[0].code).toBe('WELCOME20');

    await expect(
      couponsService.create({
        code: 'welcome20',
        discountType: 'PERCENTAGE',
        discountValue: 10,
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('validates discount values for PERCENTAGE and FIXED types', async () => {
    await expect(
      couponsService.create({
        code: 'INVALID_PCT',
        discountType: 'PERCENTAGE',
        discountValue: 105,
      }),
    ).rejects.toThrow(BadRequestException);

    await expect(
      couponsService.create({
        code: 'INVALID_FIXED',
        discountType: 'FIXED',
        discountValue: 0,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('calculates PERCENTAGE discount correctly with maxDiscountAmount cap', async () => {
    const coupon = await couponsService.create({
      code: 'OFF50',
      discountType: 'PERCENTAGE',
      discountValue: 50,
      maxDiscountAmount: 200000, // max 200,000 Rials
    });

    // Plan price: 1,000,000 Rials. 50% = 500,000 -> capped at 200,000
    const res = await couponsService.validateCoupon('OFF50', 1000000, 'user-1');
    expect(res.discountAmount).toBe(200000);
    expect(res.finalAmount).toBe(800000);
  });

  it('calculates FIXED discount correctly and caps at plan price', async () => {
    await couponsService.create({
      code: 'GIFT500K',
      discountType: 'FIXED',
      discountValue: 500000,
    });

    // Plan price: 300,000 Rials -> discount capped at 300,000, finalAmount = 0
    const res = await couponsService.validateCoupon('GIFT500K', 300000, 'user-1');
    expect(res.discountAmount).toBe(300000);
    expect(res.finalAmount).toBe(0);
  });

  it('rejects expired coupons', async () => {
    await couponsService.create({
      code: 'EXPIRED',
      discountType: 'PERCENTAGE',
      discountValue: 20,
      expiresAt: new Date(Date.now() - 10000), // in the past
    });

    await expect(
      couponsService.validateCoupon('EXPIRED', 500000, 'user-1'),
    ).rejects.toThrow('مهلت استفاده از این کد تخفیف به پایان رسیده است.');
  });

  it('rejects coupons that reached usageLimit', async () => {
    const coupon = await couponsService.create({
      code: 'LIMIT1',
      discountType: 'PERCENTAGE',
      discountValue: 20,
      usageLimit: 1,
    });
    coupon.usedCount = 1;

    await expect(
      couponsService.validateCoupon('LIMIT1', 500000, 'user-1'),
    ).rejects.toThrow('سقف کل استفاده از این کد تخفیف به پایان رسیده است.');
  });

  it('rejects coupons when minOrderAmount is not met', async () => {
    await couponsService.create({
      code: 'MINORDER',
      discountType: 'PERCENTAGE',
      discountValue: 20,
      minOrderAmount: 1000000,
    });

    await expect(
      couponsService.validateCoupon('MINORDER', 500000, 'user-1'),
    ).rejects.toThrow('این کد تخفیف برای سفارش‌های بالاتر از');
  });

  it('rejects coupons when user exceeds perUserLimit', async () => {
    const coupon = await couponsService.create({
      code: 'ONE_PER_USER',
      discountType: 'PERCENTAGE',
      discountValue: 20,
      perUserLimit: 1,
    });

    usageRepo.rows.push({
      id: 'usage-1',
      couponId: coupon.id,
      userId: 'user-1',
      paymentId: 'pay-1',
      discountAmount: 20000,
    });

    await expect(
      couponsService.validateCoupon('ONE_PER_USER', 500000, 'user-1'),
    ).rejects.toThrow('شما قبلاً از این کد تخفیف استفاده کرده‌اید.');

    // Another user should still be able to use it
    const resOther = await couponsService.validateCoupon('ONE_PER_USER', 500000, 'user-2');
    expect(resOther.valid).toBe(true);
  });
});

describe('ZarinpalPaymentGateway', () => {
  let zarinpal: ZarinpalPaymentGateway;

  beforeEach(() => {
    zarinpal = new ZarinpalPaymentGateway();
  });

  it('converts Rials to Tomans correctly', () => {
    expect(zarinpal.toTomans(1000000)).toBe(100000);
    expect(zarinpal.toTomans(50000)).toBe(5000);
  });

  it('handles simulated/sandbox requests gracefully when offline or mock', async () => {
    // Spy on fetch to simulate Zarinpal Sandbox response
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          code: 100,
          message: 'Success',
          authority: 'A00000000000000000000000000000000001',
          fee_type: 'Merchant',
          fee: 0,
        },
        errors: [],
      }),
    });
    (global as any).fetch = mockFetch;

    const res = await zarinpal.requestPayment({
      paymentId: 'pay-123',
      amount: 500000, // 500,000 Rials = 50,000 Tomans
      currency: 'IRR',
      callbackUrl: 'http://localhost:5173/payment-result',
      description: 'تست زرین‌پال',
    });

    expect(res.authority).toBe('A00000000000000000000000000000000001');
    expect(res.paymentUrl).toContain('StartPay/A00000000000000000000000000000000001');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://sandbox.zarinpal.com/pg/v4/payment/request.json',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      }),
    );
  });

  it('verifies successful payment on code 100 or 101', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          code: 100,
          message: 'Paid',
          ref_id: 12345678,
          card_pan: '603799******1234',
        },
        errors: [],
      }),
    });
    (global as any).fetch = mockFetch;

    const res = await zarinpal.verifyPayment({
      authority: 'A00000000000000000000000000000000001',
      amount: 500000,
      payload: { status: 'OK' },
    });

    expect(res.success).toBe(true);
    expect(res.refId).toBe('12345678');
    expect(res.rawResponse.card_pan).toBe('603799******1234');
  });

  it('handles user cancellation or gateway errors gracefully', async () => {
    const res = await zarinpal.verifyPayment({
      authority: 'A00000000000000000000000000000000001',
      amount: 500000,
      payload: { status: 'NOK' },
    });

    expect(res.success).toBe(false);
    expect(res.message).toBe('تراکنش توسط کاربر یا درگاه بانکی زرین‌پال لغو شد.');
  });
});

describe('PaymentsService Integration with Coupons & Zarinpal', () => {
  let paymentsService: PaymentsService;
  let paymentRepo: any;
  let couponRepo: any;
  let usageRepo: any;
  let plansService: any;
  let subsService: any;
  let auditService: any;
  let couponsService: CouponsService;
  let sandboxGateway: SandboxPaymentGateway;
  let zarinpalGateway: ZarinpalPaymentGateway;
  let dataSource: any;

  beforeEach(() => {
    paymentRepo = makeMockRepo([]);
    couponRepo = makeMockRepo([]);
    usageRepo = makeMockRepo([]);
    couponsService = new CouponsService(couponRepo, usageRepo);
    sandboxGateway = new SandboxPaymentGateway();
    zarinpalGateway = new ZarinpalPaymentGateway();

    plansService = {
      findById: jest.fn(async (id: string) => ({
        id,
        name: 'پلن حرفه‌ای',
        price: '1000000',
        currency: 'IRR',
        isActive: true,
      })),
    };

    subsService = {
      getActiveSubscription: jest.fn(async () => null),
      assignPlanToUser: jest.fn(async () => ({ id: 'sub-1' })),
    };

    auditService = {
      log: jest.fn(async () => {}),
    };

    dataSource = {
      transaction: jest.fn(async (cb: any) => {
        const manager = {
          getRepository: (entity: any) => {
            if (entity.name === 'Payment' || entity === paymentRepo) return paymentRepo;
            if (entity.name === 'Coupon' || entity === couponRepo) return couponRepo;
            if (entity.name === 'CouponUsage' || entity === usageRepo) return usageRepo;
            return paymentRepo;
          },
        };
        return cb(manager);
      }),
      getRepository: (entity: any) => paymentRepo,
    };

    paymentsService = new PaymentsService(
      paymentRepo,
      plansService,
      subsService,
      sandboxGateway,
      zarinpalGateway,
      couponsService,
      auditService,
      dataSource,
    );
  });

  it('activates immediately without gateway redirect when 100% coupon applied', async () => {
    await couponsService.create({
      code: 'FREE100',
      discountType: 'PERCENTAGE',
      discountValue: 100,
    });

    const res = await paymentsService.initiateCheckout('user-1', {
      planId: 'plan-1',
      couponCode: 'FREE100',
    });

    expect(res.status).toBe(PaymentStatus.SUCCESS);
    expect(res.message).toContain('کد تخفیف ۱۰۰٪ با موفقیت اعمال شد');

    const savedPayment = paymentRepo.rows[0];
    expect(savedPayment.amount).toBe('0');
    expect(savedPayment.originalAmount).toBe('1000000');
    expect(savedPayment.discountAmount).toBe('1000000');
    expect(savedPayment.gateway).toBe('free');

    // Coupon usage should be recorded
    expect(usageRepo.rows.length).toBe(1);
    expect(couponRepo.rows[0].usedCount).toBe(1);
    expect(subsService.assignPlanToUser).toHaveBeenCalled();
  });

  it('initiates payment with discounted amount for partial coupon and selected gateway', async () => {
    await couponsService.create({
      code: 'OFF20',
      discountType: 'PERCENTAGE',
      discountValue: 20,
    });

    const res = await paymentsService.initiateCheckout('user-1', {
      planId: 'plan-1',
      couponCode: 'OFF20',
      gateway: 'sandbox',
    });

    expect(res.paymentId).toBeDefined();
    expect(res.paymentUrl).toBeDefined();

    const savedPayment = paymentRepo.rows[0];
    expect(savedPayment.originalAmount).toBe('1000000');
    expect(savedPayment.discountAmount).toBe('200000');
    expect(savedPayment.amount).toBe('800000');
    expect(savedPayment.status).toBe(PaymentStatus.PENDING);
  });
});
