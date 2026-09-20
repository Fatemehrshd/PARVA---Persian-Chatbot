import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import UserEditorModal from '../src/components/admin/modals/UserEditorModal.vue'

vi.mock('../src/services/subscription.service', () => ({
  subscriptionService: {
    getAllPlans: vi.fn().mockResolvedValue([]),
  },
}))

describe('UserEditorModal default subscription', () => {
  it('shows the free plan for a regular user without an active plan', async () => {
    const wrapper = mount(UserEditorModal, {
      props: {
        open: true,
        user: {
          id: 'u1',
          email: 'user@example.com',
          role: 'user',
          isActive: true,
          usedTokens: 0,
          tokenLimit: null,
          messageLimit: null,
          conversationsCount: 0,
          planName: null,
        } as any,
        tokenRatePer1000: 10,
      },
      global: {
        stubs: {
          AdminModal: { template: '<div><slot /></div>' },
          BaseButton: { template: '<button><slot /></button>' },
        },
      },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('طرح رایگان')
    expect(wrapper.text()).not.toContain('طرح پیش‌فرض سیستم')
  })
})
