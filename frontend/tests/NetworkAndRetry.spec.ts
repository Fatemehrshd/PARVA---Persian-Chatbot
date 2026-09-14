import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import NetworkStatusBanner from '../src/components/chat/NetworkStatusBanner.vue'
import { useUiStore } from '../src/stores/ui'
import { useChatStore } from '../src/stores/chat'

vi.mock('../src/services/chat.service', () => ({
  chatService: {
    listConversations: vi.fn().mockResolvedValue([]),
    getMessages: vi.fn().mockResolvedValue([]),
    sendMessageStream: vi.fn().mockImplementation((id, content, onToken, onDone) => {
      onToken('chunk1')
      onDone('msg-done-123')
      return Promise.resolve()
    })
  }
}))

describe('Network Resilience and Recovery Actions', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('NetworkStatusBanner shows offline indicator when offline and hides when online', async () => {
    const uiStore = useUiStore()
    uiStore.setOnline(true)

    const wrapper = mount(NetworkStatusBanner)
    expect(wrapper.find('.network-banner').exists()).toBe(false)

    uiStore.setOnline(false)
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.network-banner').exists()).toBe(true)
    expect(wrapper.text()).toContain('اتصال شما به اینترنت قطع است')
  })

  it('chatStore records lastUserPrompt and exposes retryLastMessage', async () => {
    const chatStore = useChatStore()
    chatStore.currentConversationId = 'conv-1'

    await chatStore.sendMessage('Hello NeuralChat')
    expect(chatStore.lastUserPrompt).toBe('Hello NeuralChat')
    expect(typeof chatStore.retryLastMessage).toBe('function')
    expect(typeof chatStore.continueLastMessage).toBe('function')
  })

  it('stopStreaming interrupts active stream and saves partial text with isInterrupted flag', () => {
    const chatStore = useChatStore()
    chatStore.currentConversationId = 'conv-1'
    chatStore.isStreaming = true
    chatStore.currentStreamingText = 'این یک پاسخ نیمه...'

    chatStore.stopStreaming()

    expect(chatStore.isStreaming).toBe(false)
    expect(chatStore.currentStreamingText).toBe('')
    expect(chatStore.messages.length).toBe(1)
    expect(chatStore.messages[0].content).toBe('این یک پاسخ نیمه...')
    expect(chatStore.messages[0].isInterrupted).toBe(true)
  })
})

