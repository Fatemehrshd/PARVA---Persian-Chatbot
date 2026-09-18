import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useChatStore } from '../src/stores/chat'

const SRCS = [{ title: 't', url: 'https://a.com/1', snippet: 's' }]

describe('sources attach at finish', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    Object.defineProperty(globalThis, 'sessionStorage', {
      value: { removeItem: () => {}, getItem: () => null, setItem: () => {} },
      configurable: true,
    })
    localStorage.clear()
  })

  it('attaches pending sources to the finished message', () => {
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
      pendingSources: SRCS,
      isSearching: false,
      searchFailed: false,
    } as any)
    chatStore.finishStream('c1', 'm1', false, 'answer text')
    const msg = chatStore.messages[chatStore.messages.length - 1]
    expect(msg.content).toBe('answer text')
    expect(msg.sources).toEqual(SRCS)
  })
})
