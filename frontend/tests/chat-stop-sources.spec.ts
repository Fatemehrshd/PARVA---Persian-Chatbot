import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useChatStore } from '../src/stores/chat'

const SRCS = [{ title: 't', url: 'https://a.com/1', snippet: 's' }]

describe('user stop drops sources', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    Object.defineProperty(globalThis, 'sessionStorage', {
      value: { removeItem: () => {}, getItem: () => null, setItem: () => {} },
      configurable: true,
    })
    localStorage.clear()
  })

  it('stopped message carries no sources even when they arrived', () => {
    const chatStore = useChatStore()
    chatStore.currentConversationId = 'c1'
    chatStore.convStreamStates.set('c1', {
      isStreaming: true,
      isThinking: false,
      streamError: null,
      currentStreamingText: 'partial answer',
      abortController: null,
      watchdogTimer: null,
      lastUserPrompt: '',
      charBuffer: [],
      releaseTimer: null,
      pendingSources: SRCS,
      isSearching: false,
      searchFailed: false,
    } as any)
    chatStore.stopStreaming()
    const msg = chatStore.messages[chatStore.messages.length - 1]
    expect(msg.content).toContain('partial answer')
    expect(msg.sources ?? null).toBeNull()
  })
})
