import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ProfileMenu from '../src/components/layout/ProfileMenu.vue'

describe('ProfileMenu', () => {
  it('emits open-profile when the profile item is selected', async () => {
    setActivePinia(createPinia())
    const wrapper = mount(ProfileMenu)

    await wrapper.get('[role="menuitem"]').trigger('click')

    expect(wrapper.emitted('openProfile')).toHaveLength(1)
  })

  it('emits openPayments when the payment history item is selected', async () => {
    setActivePinia(createPinia())
    const wrapper = mount(ProfileMenu)

    const menuItems = wrapper.findAll('[role="menuitem"]')
    const paymentsItem = menuItems.find((w) => w.text().includes('سوابق پرداخت'))
    expect(paymentsItem).toBeDefined()
    await paymentsItem!.trigger('click')

    expect(wrapper.emitted('openPayments')).toHaveLength(1)
  })

  it('shows the quota snapshot for the current session user', async () => {
    setActivePinia(createPinia())
    const { useAuthStore } = await import('../src/stores/auth')
    const authStore = useAuthStore()
    authStore.quotaLoaded = true
    authStore.quota = {
      blocked: false,
      reason: null,
      remainingTokens: 420,
      remainingMessages: null,
      remainingPercent: 42,
      resetAt: null,
    }

    const wrapper = mount(ProfileMenu)

    expect(wrapper.get('[data-testid="quota-summary"]').text()).toContain('۴۲٪')
  })
})