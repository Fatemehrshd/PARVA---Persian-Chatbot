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
      tokenLimit: 0,
      messageLimit: null,
    })

    wrapper.unmount()
  })
})
