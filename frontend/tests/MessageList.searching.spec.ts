import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import MessageList from '../src/components/chat/MessageList.vue'
import { useChatStore } from '../src/stores/chat'

function mountWithSearchState(isSearching: boolean) {
  const chatStore = useChatStore()
  chatStore.currentConversationId = 'c1'
  chatStore.convStreamStates.set('c1', {
    isStreaming: true,
    isThinking: false,
    streamError: null,
    currentStreamingText: '',
    abortController: null,
    watchdogTimer: null,
    lastUserPrompt: '',
    charBuffer: [],
    releaseTimer: null,
    pendingSources: null,
    isSearching,
    searchFailed: false,
  } as any)
  return mount(MessageList, {
    global: {
      stubs: {
        EmptyState: true,
        MessageBubble: true,
        MarkdownContent: true,
        ThinkingIndicator: true,
      },
    },
  })
}

describe('searching indicator', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('shows "در حال جستجو" instead of dots while searching', async () => {
    const wrapper = mountWithSearchState(true)
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('در حال جستجو')
  })

  it('shows dots (not the searching text) when thinking without search', async () => {
    const wrapper = mountWithSearchState(false)
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).not.toContain('در حال جستجو')
  })
})
