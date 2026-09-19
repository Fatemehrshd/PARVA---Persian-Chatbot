import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import CheckoutModal from '../src/components/subscription/CheckoutModal.vue'
import AdminCouponsSection from '../src/views/admin/AdminCouponsSection.vue'
import { paymentService } from '../src/services/payment.service'
import type { SubscriptionPlan, Coupon } from '../src/types'

vi.mock('../src/services/payment.service', () => ({
  paymentService: {
    checkout: vi.fn(),
    validateCoupon: vi.fn(),
    adminGetCoupons: vi.fn(),
    adminCreateCoupon: vi.fn(),
    adminUpdateCoupon: vi.fn(),
    adminDeleteCoupon: vi.fn(),
  },
}))

describe('Coupons & Gateway Selection Flow', () => {
  const mockPlan: SubscriptionPlan = {
    id: 'p-pro',
    slug: 'pro',
    name: 'طرح حرفه‌ای',
    description: 'توضیحات طرح',
    price: '1000000', // 100,000 Tomans
    currency: 'IRR',
    durationDays: 30,
    tokenQuota: 1000000,
    messageQuota: 500,
    resetHours: 12,
    features: { webSearch: true, thinking: true, document: true },
    isActive: true,
    isDefault: false,
    sortOrder: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('renders plan summary and initial gateway options', () => {
    const wrapper = mount(CheckoutModal, {
      props: {
        open: true,
        plan: mockPlan,
      },
    })

    expect(wrapper.text()).toContain('طرح حرفه‌ای')
    expect(wrapper.text()).toContain('۱۰۰٬۰۰۰ تومان')
    expect(wrapper.text()).toContain('درگاه زرین‌پال (سندباکس)')
    expect(wrapper.text()).toContain('شبیه‌ساز پرداخت سریع')
  })

  it('validates and applies coupon, updating final price', async () => {
    vi.mocked(paymentService.validateCoupon).mockResolvedValue({
      valid: true,
      couponId: 'c-1',
      code: 'OFF20',
      discountType: 'PERCENTAGE',
      discountValue: 20,
      discountAmount: 200000, // 20,000 Tomans
      originalAmount: 1000000,
      finalAmount: 800000, // 80,000 Tomans
      message: 'کد تخفیف اعمال شد',
    })

    const wrapper = mount(CheckoutModal, {
      props: {
        open: true,
        plan: mockPlan,
      },
    })

    const input = wrapper.find('input[type="text"]')
    await input.setValue('off20')

    const applyBtn = wrapper.findAll('button').find((b) => b.text().includes('اعمال کد'))
    expect(applyBtn).toBeDefined()
    await applyBtn!.trigger('click')
    await flushPromises()

    expect(paymentService.validateCoupon).toHaveBeenCalledWith({
      code: 'off20',
      planId: 'p-pro',
    })

    expect(wrapper.text()).toContain('OFF20')
    expect(wrapper.text()).toContain('۲۰٪ تخفیف')
    expect(wrapper.text()).toContain('۸۰٬۰۰۰ تومان')
  })

  it('handles 100% coupon discount and enables free activation', async () => {
    vi.mocked(paymentService.validateCoupon).mockResolvedValue({
      valid: true,
      couponId: 'c-100',
      code: 'FREE100',
      discountType: 'PERCENTAGE',
      discountValue: 100,
      discountAmount: 1000000,
      originalAmount: 1000000,
      finalAmount: 0,
      message: 'کد تخفیف ۱۰۰٪ اعمال شد',
    })

    const wrapper = mount(CheckoutModal, {
      props: {
        open: true,
        plan: mockPlan,
      },
    })

    const input = wrapper.find('input[type="text"]')
    await input.setValue('FREE100')

    const applyBtn = wrapper.findAll('button').find((b) => b.text().includes('اعمال کد'))
    await applyBtn!.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('رایگان (۱۰۰٪ تخفیف)')
    // Gateway selection hidden when price is 0
    expect(wrapper.find('input[name="gateway"]').exists()).toBe(false)

    // Confirm button says free activation
    const confirmBtn = wrapper.findAll('button').find((b) => b.text().includes('فعال‌سازی رایگان اشتراک'))
    expect(confirmBtn).toBeDefined()

    await confirmBtn!.trigger('click')
    expect(wrapper.emitted('checkout')).toHaveLength(1)
    expect(wrapper.emitted('checkout')![0][0]).toEqual({
      planId: 'p-pro',
      gateway: 'zarinpal',
      couponCode: 'FREE100',
    })
  })

  it('emits checkout event with selected gateway (zarinpal vs sandbox)', async () => {
    const wrapper = mount(CheckoutModal, {
      props: {
        open: true,
        plan: mockPlan,
      },
    })

    // Switch gateway to sandbox
    const sandboxRadio = wrapper.find('input[value="sandbox"]')
    await sandboxRadio.setValue()

    const confirmBtn = wrapper.findAll('button').find((b) => b.text().includes('انتقال به درگاه پرداخت'))
    await confirmBtn!.trigger('click')

    expect(wrapper.emitted('checkout')).toHaveLength(1)
    expect(wrapper.emitted('checkout')![0][0]).toEqual({
      planId: 'p-pro',
      gateway: 'sandbox',
      couponCode: undefined,
    })
  })

  it('renders AdminCouponsSection and lists coupons', async () => {
    const mockCoupons: Coupon[] = [
      {
        id: 'c-1',
        code: 'WELCOME20',
        description: 'تخفیف خوش‌آمدگویی',
        discountType: 'PERCENTAGE',
        discountValue: 20,
        maxDiscountAmount: 500000,
        minOrderAmount: 100000,
        usageLimit: 100,
        usedCount: 15,
        perUserLimit: 1,
        expiresAt: null,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]

    vi.mocked(paymentService.adminGetCoupons).mockResolvedValue({
      items: mockCoupons,
      total: 1,
      page: 1,
      limit: 10,
      totalPages: 1,
    })

    const wrapper = mount(AdminCouponsSection)
    await flushPromises()

    expect(wrapper.text()).toContain('WELCOME20')
    expect(wrapper.text()).toContain('تخفیف خوش‌آمدگویی')
    expect(wrapper.text()).toContain('۲۰٪')
    expect(wrapper.text()).toContain('فعال')
  })
})
