import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import MessageList from '../src/components/chat/MessageList.vue'
import { useChatStore } from '../src/stores/chat'

describe('MessageList streaming scroll behavior', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  function mountStreamingList() {
    const chatStore = useChatStore()
    chatStore.isStreaming = true
    chatStore.currentStreamingText = 'first token'

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

    container.scrollTop = 400
    container.dispatchEvent(new Event('scroll'))
    container.scrollHeight = 1100
    chatStore.currentStreamingText = 'second token'
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
    chatStore.currentStreamingText = 'second token'
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
    chatStore.currentStreamingText = 'second token'
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()

    expect(container.scrollTop).toBe(1200)
  })

  it('keeps the user position when streaming ends away from the bottom', async () => {
    const { wrapper, chatStore, container } = mountStreamingList()
    await wrapper.vm.$nextTick()

    container.scrollTop = 200
    container.dispatchEvent(new Event('scroll'))
    chatStore.isStreaming = false
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()

    expect(container.scrollTop).toBe(200)
  })
})