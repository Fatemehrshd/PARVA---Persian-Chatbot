import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import MessageList from '../src/components/chat/MessageList.vue'
import { useChatStore } from '../src/stores/chat'

function mountWithSearchState({
  isSearching,
  currentReasoning = '',
  isActivelyThinking = false,
  web = false,
  thinking = false,
}: {
  isSearching: boolean
  currentReasoning?: string
  isActivelyThinking?: boolean
  web?: boolean
  thinking?: boolean
}) {
  const chatStore = useChatStore()
  chatStore.currentConversationId = 'c1'
  chatStore.convFlags['c1'] = { web, thinking }
  chatStore.convStreamStates.set('c1', {
    isStreaming: true,
    isThinking: isActivelyThinking,
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
    currentReasoning,
    isActivelyThinking,
  } as any)
  return mount(MessageList, {
    global: {
      stubs: {
        EmptyState: true,
        MessageBubble: true,
        MarkdownContent: true,
      },
    },
  })
}

describe('searching indicator', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('shows "درحال جستجو..." when only search is enabled', async () => {
    const wrapper = mountWithSearchState({ isSearching: true, web: true, thinking: false })
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('درحال جستجو')
  })

  it('hides the combined loading label once the reasoning box is actively streaming', async () => {
    const wrapper = mountWithSearchState({
      isSearching: true,
      currentReasoning: 'در حال تحلیل...',
      isActivelyThinking: true,
      web: true,
      thinking: true,
    })
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).not.toContain('درحال تفکر و جستجو')
    expect(wrapper.text()).toContain('در حال فکر کردن و تحلیل عمیق')
  })

  it('shows only the animated three-dot indicator when neither search nor thinking is active', async () => {
    const wrapper = mountWithSearchState({ isSearching: false, currentReasoning: '', isActivelyThinking: false, web: false, thinking: false })
    await wrapper.vm.$nextTick()
    expect(wrapper.findAll('.dot')).toHaveLength(3)
    expect(wrapper.text()).not.toContain('در حال جستجو')
    expect(wrapper.text()).not.toContain('در حال تفکر')
  })

  it('removes the generic thinking loader once the reasoning box is actively streaming', async () => {
    const wrapper = mountWithSearchState({ isSearching: false, currentReasoning: 'در حال تحلیل...', isActivelyThinking: true, web: false, thinking: true })
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).not.toContain('درحال تفکر')
    expect(wrapper.text()).not.toContain('در حال جستجو')
    expect(wrapper.text()).toContain('در حال فکر کردن و تحلیل عمیق')
  })
})
