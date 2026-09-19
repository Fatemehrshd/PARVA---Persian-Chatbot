import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import AdminSubscriptionsSection from '../src/views/admin/AdminSubscriptionsSection.vue'
import { subscriptionService } from '../src/services/subscription.service'

vi.mock('../src/services/subscription.service', () => ({
  subscriptionService: {
    getAllSubscriptions: vi.fn(),
    assignPlan: vi.fn(),
    cancelSubscription: vi.fn(),
  },
}))

describe('AdminSubscriptionsSection search', () => {
  it('searches subscriptions by nested user and plan fields', async () => {
    setActivePinia(createPinia())
    vi.mocked(subscriptionService.getAllSubscriptions).mockResolvedValue({
      items: [
        {
          id: 'sub-1', userId: 'u1', planId: 'p1', status: 'ACTIVE', source: 'payment',
          user: { id: 'u1', email: 'alice@example.com', displayName: 'آلیس' },
          plan: { id: 'p1', name: 'طرح حرفه‌ای' },
        },
        {
          id: 'sub-2', userId: 'u2', planId: 'p2', status: 'EXPIRED', source: 'admin',
          user: { id: 'u2', email: 'bob@example.com', displayName: 'باب' },
          plan: { id: 'p2', name: 'طرح رایگان' },
        },
      ],
      total: 2,
      page: 1,
      limit: 10,
      totalPages: 1,
    } as any)

    const wrapper = mount(AdminSubscriptionsSection, {
      global: {
        stubs: {
          BaseButton: { template: '<button><slot /></button>' },
          AssignSubscriptionModal: { template: '<div />' },
          DeleteConfirmModal: { template: '<div />' },
        },
      },
    })
    await flushPromises()

    const search = wrapper.find('.search-text-input')
    await wrapper.find('.search-field-select').setValue('user.email')
    await search.setValue('alice')
    await new Promise((resolve) => setTimeout(resolve, 260))

    expect(wrapper.findAll('tbody tr.table-row')).toHaveLength(1)
    expect(wrapper.text()).toContain('alice@example.com')
    expect(wrapper.text()).not.toContain('bob@example.com')
  })
})
