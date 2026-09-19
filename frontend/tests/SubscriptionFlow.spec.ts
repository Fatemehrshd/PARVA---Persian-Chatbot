import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import SubscriptionView from '../src/views/SubscriptionView.vue'
import { subscriptionService } from '../src/services/subscription.service'
import { paymentService } from '../src/services/payment.service'

vi.mock('../src/services/subscription.service', () => ({
  subscriptionService: {
    getPublicPlans: vi.fn(),
    getCurrentSubscription: vi.fn(),
  },
}))

vi.mock('../src/services/payment.service', () => ({
  paymentService: {
    checkout: vi.fn(),
    verify: vi.fn(),
    getByAuthority: vi.fn(),
  },
}))

describe('Subscription & Commercialization UI Flow', () => {
  beforeEach(() => {
    localStorage.setItem('token', 'fake-valid-jwt-token')
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('renders public plans and shows active plan badge', async () => {
    vi.mocked(subscriptionService.getPublicPlans).mockResolvedValue([
      {
        id: 'p-free',
        slug: 'free',
        name: 'طرح رایگان',
        description: 'طرح پایه',
        price: '0',
        currency: 'IRR',
        durationDays: 0,
        tokenQuota: 0,
        messageQuota: null,
        resetHours: 6,
        features: { webSearch: false, thinking: false, document: false },
        isActive: true,
        isDefault: true,
        sortOrder: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'p-pro',
        slug: 'pro',
        name: 'طرح حرفه‌ای',
        description: 'دسترسی نامحدود',
        price: '500000',
        currency: 'IRR',
        durationDays: 30,
        tokenQuota: 2000000,
        messageQuota: 500,
        resetHours: 12,
        features: { webSearch: true, thinking: true, document: true },
        isActive: true,
        isDefault: false,
        sortOrder: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ])

    vi.mocked(subscriptionService.getCurrentSubscription).mockResolvedValue({
      activeSubscription: {
        id: 'sub-1',
        userId: 'u-1',
        planId: 'p-free',
        status: 'ACTIVE',
        startDate: new Date().toISOString(),
        source: 'system_default',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      entitlements: {
        userId: 'u-1',
        role: 'user',
        isAdmin: false,
        plan: null,
        hasActiveSubscription: true,
        effectiveTokenLimit: null,
        effectiveMessageLimit: null,
        limitSource: 'global',
        features: { webSearch: false, thinking: false, document: false, maxFileSizeMb: 25 },
        allowedModelIds: null,
      },
      history: [],
    })

    const wrapper = mount(SubscriptionView)
    await flushPromises()

    expect(wrapper.text()).toContain('طرح رایگان')
    expect(wrapper.text()).toContain('طرح حرفه‌ای')
    expect(wrapper.text()).toContain('طرح فعال شما')
    expect(wrapper.text()).toContain('۵۰۰')
  })

  it('checkout invokes paymentService.checkout with correct payload', async () => {
    const { useAuthStore } = await import('../src/stores/auth')
    const auth = useAuthStore()
    auth.user = { id: 'u-1', email: 'test@example.com', role: 'user' } as any

    vi.mocked(subscriptionService.getPublicPlans).mockResolvedValue([
      {
        id: 'p-pro',
        slug: 'pro',
        name: 'طرح حرفه‌ای',
        price: '500000',
        currency: 'IRR',
        durationDays: 30,
        tokenQuota: 2000000,
        resetHours: 6,
        features: {},
        isActive: true,
        isDefault: false,
        sortOrder: 0,
        createdAt: '',
        updatedAt: '',
      },
    ])

    vi.mocked(subscriptionService.getCurrentSubscription).mockResolvedValue({
      activeSubscription: null,
      entitlements: {
        userId: 'u-1',
        role: 'user',
        isAdmin: false,
        plan: null,
        hasActiveSubscription: false,
        effectiveTokenLimit: 50000,
        effectiveMessageLimit: null,
        limitSource: 'global',
        features: { webSearch: false, thinking: false, document: false, maxFileSizeMb: 25 },
        allowedModelIds: null,
      },
      history: [],
    })

    vi.mocked(paymentService.checkout).mockResolvedValue({
      paymentId: 'pay-123',
      authority: 'SBX_12345',
      paymentUrl: '/sandbox-gateway?authority=SBX_12345',
    })

    const wrapper = mount(SubscriptionView)
    await flushPromises()

    const upgradeBtn = wrapper.findAll('button').find((b) => b.text().includes('ارتقا به طرح حرفه‌ای'))
    expect(upgradeBtn).toBeDefined()
    await upgradeBtn?.trigger('click')
    await flushPromises()

    const confirmBtn = wrapper.findAll('button').find((b) => b.text().includes('انتقال به درگاه پرداخت'))
    expect(confirmBtn).toBeDefined()
    await confirmBtn?.trigger('click')
    await flushPromises()

    expect(paymentService.checkout).toHaveBeenCalledWith(
      expect.objectContaining({
        planId: 'p-pro',
      }),
    )
  })

  it('disables plan switching when user already has an active purchased plan', async () => {
    const { useAuthStore } = await import('../src/stores/auth')
    const auth = useAuthStore()
    auth.user = { id: 'u-1', email: 'test@example.com', role: 'user' } as any

    vi.mocked(subscriptionService.getPublicPlans).mockResolvedValue([
      {
        id: 'p-free',
        slug: 'free',
        name: 'طرح رایگان',
        price: '0',
        currency: 'IRR',
        durationDays: 30,
        tokenQuota: 100000,
        resetHours: 24,
        features: {},
        isActive: true,
        isDefault: true,
        sortOrder: 0,
        createdAt: '',
        updatedAt: '',
      },
      {
        id: 'p-pro',
        slug: 'pro',
        name: 'طرح حرفه‌ای',
        price: '500000',
        currency: 'IRR',
        durationDays: 30,
        tokenQuota: 2000000,
        resetHours: 6,
        features: {},
        isActive: true,
        isDefault: false,
        sortOrder: 1,
        createdAt: '',
        updatedAt: '',
      },
    ])

    vi.mocked(subscriptionService.getCurrentSubscription).mockResolvedValue({
      activeSubscription: {
        id: 'sub-pro',
        userId: 'u-1',
        planId: 'p-pro',
        status: 'ACTIVE',
        startDate: new Date().toISOString(),
        source: 'payment',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      entitlements: {
        userId: 'u-1',
        role: 'user',
        isAdmin: false,
        plan: {
          id: 'p-pro',
          slug: 'pro',
          name: 'طرح حرفه‌ای',
          price: '500000',
          currency: 'IRR',
          durationDays: 30,
          tokenQuota: 2000000,
          resetHours: 6,
          features: {},
          isActive: true,
          isDefault: false,
          sortOrder: 1,
          createdAt: '',
          updatedAt: '',
        },
        hasActiveSubscription: true,
        effectiveTokenLimit: 2000000,
        effectiveMessageLimit: null,
        limitSource: 'subscription',
        features: { webSearch: true, thinking: true, document: true, maxFileSizeMb: 50 },
        allowedModelIds: null,
      },
      history: [],
    })

    const wrapper = mount(SubscriptionView)
    await flushPromises()

    expect(wrapper.text()).toContain('شما دارای اشتراک فعال «طرح حرفه‌ای» هستید')
    expect(wrapper.text()).toContain('غیرقابل تغییر')
  })
})
