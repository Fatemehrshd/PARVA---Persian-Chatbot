import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ChatComposer from '../src/components/chat/ChatComposer.vue'
import { useChatStore } from '../src/stores/chat'

describe('ChatComposer web-search toggle', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('flips the per-conversation web flag', async () => {
    const wrapper = mount(ChatComposer, {
      global: {
        stubs: {
          FilePreviewCard: true,
          BaseToggle: true,
        },
      },
    })
    const chatStore = useChatStore()
    chatStore.currentConversationId = 'c1'
    await wrapper.find('.attachment-btn').trigger('click')
    const btn = wrapper.find('[data-testid="toggle-web-search"]')
    expect(btn.exists()).toBe(true)
    expect(chatStore.getConvFlag('c1').web).toBe(false)
    await btn.trigger('click')
    expect(chatStore.getConvFlag('c1').web).toBe(true)
  })
})
