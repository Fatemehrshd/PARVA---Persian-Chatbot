import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import UserEditorModal from '../src/components/admin/modals/UserEditorModal.vue'

describe('UserEditorModal', () => {
  it('treats an empty token field as infinite tokens when saving', async () => {
    const wrapper = mount(UserEditorModal, {
      props: {
        open: true,
        user: {
          id: 'u1',
          email: 'user@example.com',
          displayName: 'کاربر تست',
          role: 'user',
          isActive: true,
          usedTokens: 1500,
          tokenLimit: null,
          messageLimit: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          conversationCount: 0,
          usedCostUsd: 0,
        },
        tokenRatePer1000: 10,
      },
    })

    await wrapper.vm.onTokenLimitInput('')
    await wrapper.vm.handleSubmit()

    const saved = wrapper.emitted('save')?.[0]?.[0]
    expect(saved).toMatchObject({
      tokenLimit: null,
      messageLimit: null,
    })

    wrapper.unmount()
  })

  it('saves an explicit personal token and message limit override', async () => {
    const wrapper = mount(UserEditorModal, {
      props: {
        open: true,
        user: {
          id: 'u1',
          email: 'user@example.com',
          displayName: 'کاربر تست',
          role: 'user',
          isActive: true,
          usedTokens: 1500,
          tokenLimit: null,
          messageLimit: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          conversationCount: 0,
          usedCostUsd: 0,
        },
        tokenRatePer1000: 10,
        inheritedTokenLimit: 50000,
        inheritedMessageLimit: 20,
      },
    })

    await wrapper.vm.onTokenLimitInput('25000')
    await wrapper.vm.onMessageLimitInput('10')
    await wrapper.vm.handleSubmit()

    const saved = wrapper.emitted('save')?.[0]?.[0]
    expect(saved).toMatchObject({
      tokenLimit: 25000,
      messageLimit: 10,
    })

    wrapper.unmount()
  })

  it('allows clearing personal limit to return to inheritance', async () => {
    const wrapper = mount(UserEditorModal, {
      props: {
        open: true,
        user: {
          id: 'u1',
          email: 'user@example.com',
          displayName: 'کاربر تست',
          role: 'user',
          isActive: true,
          usedTokens: 1500,
          tokenLimit: 25000,
          messageLimit: 10,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          conversationCount: 0,
          usedCostUsd: 0,
        },
        tokenRatePer1000: 10,
        inheritedTokenLimit: 50000,
      },
    })

    wrapper.vm.clearPersonalLimits()
    await wrapper.vm.handleSubmit()

    const saved = wrapper.emitted('save')?.[0]?.[0]
    expect(saved).toMatchObject({
      tokenLimit: null,
      messageLimit: null,
    })

    wrapper.unmount()
  })
})
