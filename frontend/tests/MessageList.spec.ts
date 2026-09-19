import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import MessageList from '../src/components/chat/MessageList.vue'
import { useChatStore } from '../src/stores/chat'

const TEST_CONV_ID = 'test-stream-conv'

describe('MessageList streaming scroll behavior', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  function makeStreamState(overrides: Partial<{
    isStreaming: boolean
    currentStreamingText: string
    isThinking: boolean
  }> = {}) {
    return {
      isStreaming: overrides.isStreaming ?? true,
      isThinking: overrides.isThinking ?? false,
      streamError: null,
      currentStreamingText: overrides.currentStreamingText ?? 'first token',
      abortController: null,
      watchdogTimer: null,
      lastUserPrompt: ''
    }
  }

  function mountStreamingList() {
    const chatStore = useChatStore()
    chatStore.currentConversationId = TEST_CONV_ID
    chatStore.convStreamStates.set(TEST_CONV_ID, makeStreamState())

    const wrapper = mount(MessageList, {
      global: {
        stubs: {
          EmptyState: true,
          MessageBubble: true,
          MarkdownContent: true,
          ThinkingIndicator: true
        }
      }
    })
    const container = wrapper.find('.message-list-viewport').element as HTMLElement

    Object.defineProperties(container, {
      clientHeight: { configurable: true, value: 500 },
      scrollHeight: { configurable: true, writable: true, value: 1000 },
      scrollTop: { configurable: true, writable: true, value: 500 }
    })
    container.scrollTo = vi.fn(({ top }: ScrollToOptions) => {
      container.scrollTop = Number(top)
    })

    return { wrapper, chatStore, container }
  }

  it('keeps following the stream while the user is near the bottom', async () => {
    const { wrapper, chatStore, container } = mountStreamingList()
    await wrapper.vm.$nextTick()

    // Content growth made the viewport slightly shorter — same pinned position
    // counts as still near the bottom, so follow continues.
    container.scrollHeight = 1100
    chatStore.convStreamStates.set(TEST_CONV_ID, makeStreamState({ currentStreamingText: 'second token' }))
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()

    expect(container.scrollTop).toBe(1100)
  })

  it('preserves the user position when they scroll above the follow threshold', async () => {
    const { wrapper, chatStore, container } = mountStreamingList()
    await wrapper.vm.$nextTick()

    container.scrollTop = 200
    container.dispatchEvent(new Event('scroll'))
    container.scrollHeight = 1400
    chatStore.convStreamStates.set(TEST_CONV_ID, makeStreamState({ currentStreamingText: 'second token' }))
    await wrapper.vm.$nextTick()

    expect(container.scrollTop).toBe(200)
  })

  it('resumes auto-scroll after the user returns to the bottom', async () => {
    const { wrapper, chatStore, container } = mountStreamingList()
    await wrapper.vm.$nextTick()

    container.scrollTop = 200
    container.dispatchEvent(new Event('scroll'))
    container.scrollTop = 500
    container.dispatchEvent(new Event('scroll'))
    container.scrollHeight = 1200
    chatStore.convStreamStates.set(TEST_CONV_ID, makeStreamState({ currentStreamingText: 'second token' }))
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()

    expect(container.scrollTop).toBe(1200)
  })

  it('keeps the user position when streaming ends away from the bottom', async () => {
    const { wrapper, chatStore, container } = mountStreamingList()
    await wrapper.vm.$nextTick()

    container.scrollTop = 200
    container.dispatchEvent(new Event('scroll'))
    chatStore.convStreamStates.set(TEST_CONV_ID, makeStreamState({ isStreaming: false }))
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()

    expect(container.scrollTop).toBe(200)
  })

  it('scrolls to absolute bottom when a new user message is added even if user was scrolled up', async () => {
    const { wrapper, chatStore, container } = mountStreamingList()
    await wrapper.vm.$nextTick()

    // User scrolled up away from bottom
    container.scrollTop = 200
    container.dispatchEvent(new Event('scroll'))
    await wrapper.vm.$nextTick()

    // User sends a new message
    container.scrollHeight = 2500
    chatStore.messages.push({
      id: 'msg-user-new',
      conversationId: TEST_CONV_ID,
      role: 'user',
      content: 'Hello, this is a new message in a long chat!',
      createdAt: new Date().toISOString()
    })

    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()

    // Must jump to the absolute bottom (2500)
    expect(container.scrollTop).toBe(2500)
  })

  it('releases follow immediately when the user slowly scrolls up inside the bottom threshold', async () => {
    const { wrapper, chatStore, container } = mountStreamingList()
    await wrapper.vm.$nextTick()

    // Slow upward scroll: still near the bottom (within 120px), but moving up
    // is user intent and must not fight the stream.
    container.scrollTop = 480
    container.dispatchEvent(new Event('scroll'))
    container.scrollHeight = 1100
    chatStore.convStreamStates.set(TEST_CONV_ID, makeStreamState({ currentStreamingText: 'second token' }))
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()

    expect(container.scrollTop).toBe(480)
  })

  it('renders jump-to-bottom button when user is scrolled up and triggers scroll on click', async () => {
    const { wrapper, chatStore, container } = mountStreamingList()
    chatStore.messages.push({
      id: 'msg-1',
      conversationId: TEST_CONV_ID,
      role: 'user',
      content: 'Initial message',
      createdAt: new Date().toISOString()
    })
    await wrapper.vm.$nextTick()

    // Scrolled up
    container.scrollTop = 150
    container.dispatchEvent(new Event('scroll'))
    await wrapper.vm.$nextTick()

    // Button should be visible
    const scrollBtn = wrapper.find('.scroll-to-bottom-btn')
    expect(scrollBtn.exists()).toBe(true)

    // Click button
    await scrollBtn.trigger('click')
    expect(container.scrollTo).toHaveBeenCalled()
  })

  it('renders branded logo loader when isLoadingMessages is true', async () => {
    const chatStore = useChatStore()
    chatStore.currentConversationId = TEST_CONV_ID
    chatStore.isLoadingMessages = true

    const wrapper = mount(MessageList, {
      global: {
        stubs: {
          EmptyState: true,
          MessageBubble: true,
          MarkdownContent: true,
          ThinkingIndicator: true
        }
      }
    })

    const loader = wrapper.find('.chat-branded-loader')
    expect(loader.exists()).toBe(true)
    expect(loader.find('.loader-logo-img').exists()).toBe(true)
    expect(loader.text()).toContain('در حال بارگذاری گفتگو...')

    // When loading finishes, branded loader is removed
    chatStore.isLoadingMessages = false
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.chat-branded-loader').exists()).toBe(false)
  })

  it('scrolls to the latest messages after reloading history with the same message count', async () => {
    const chatStore = useChatStore()
    chatStore.currentConversationId = TEST_CONV_ID
    chatStore.messages.push({
      id: 'old-message',
      conversationId: TEST_CONV_ID,
      role: 'assistant',
      content: 'پیام قبلی',
      createdAt: new Date().toISOString()
    })
    chatStore.isLoadingMessages = true

    const wrapper = mount(MessageList, {
      global: {
        stubs: {
          EmptyState: true,
          MessageBubble: true,
          MarkdownContent: true,
          ThinkingIndicator: true
        }
      }
    })
    const container = wrapper.find('.message-list-viewport').element as HTMLElement

    Object.defineProperties(container, {
      clientHeight: { configurable: true, value: 500 },
      scrollHeight: { configurable: true, writable: true, value: 1000 },
      scrollTop: { configurable: true, writable: true, value: 0 }
    })
    await wrapper.vm.$nextTick()
    container.dispatchEvent(new Event('scroll'))

    chatStore.messages.splice(0, chatStore.messages.length, {
      id: 'msg-history-last',
      conversationId: TEST_CONV_ID,
      role: 'assistant',
      content: 'آخرین پیام تاریخچه',
      createdAt: new Date().toISOString()
    })
    container.scrollHeight = 1800

    chatStore.isLoadingMessages = false

    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()

    expect(container.scrollTop).toBe(1800)
  })

  it('keeps following when sources appear on the final assistant message', async () => {
    const chatStore = useChatStore()
    chatStore.currentConversationId = TEST_CONV_ID
    chatStore.messages.push({
      id: 'msg-source-root',
      conversationId: TEST_CONV_ID,
      role: 'assistant',
      content: 'پاسخ نهایی',
      createdAt: new Date().toISOString(),
    })

    const wrapper = mount(MessageList, {
      global: {
        stubs: {
          EmptyState: true,
          MessageBubble: true,
          MarkdownContent: true,
          ThinkingIndicator: true
        }
      }
    })
    const container = wrapper.find('.message-list-viewport').element as HTMLElement

    Object.defineProperties(container, {
      clientHeight: { configurable: true, value: 500 },
      scrollHeight: { configurable: true, writable: true, value: 1200 },
      scrollTop: { configurable: true, writable: true, value: 650 }
    })

    chatStore.messages[0].sources = [{
      id: 'src-1',
      title: 'منبع',
      url: 'https://example.com',
      snippet: 'نمونه',
      displayUrl: 'example.com'
    }]

    await wrapper.vm.$nextTick()
    await new Promise((resolve) => setTimeout(resolve, 0))
    await wrapper.vm.$nextTick()

    expect(container.scrollTop).toBe(1200)
  })
})