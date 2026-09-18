import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useChatStore } from '../src/stores/chat'

describe('sidebar order on new activity', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    Object.defineProperty(globalThis, 'sessionStorage', {
      value: { removeItem: () => {}, getItem: () => null, setItem: () => {} },
      configurable: true,
    })
    localStorage.clear()
  })

  function seed() {
    const chatStore = useChatStore()
    chatStore.conversations = [
      { id: 'old-1', title: 'first', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
      { id: 'old-2', title: 'second', createdAt: '2026-01-02T00:00:00.000Z', updatedAt: '2026-01-02T00:00:00.000Z' },
    ]
    return chatStore
  }

  it('moves the replied conversation to the top on finishStream', () => {
    const chatStore = seed()
    chatStore.currentConversationId = 'old-2'
    chatStore.finishStream('old-2', 'm1', false, 'reply text')
    expect(chatStore.conversations.map((c) => c.id)).toEqual(['old-2', 'old-1'])
  })

  it('keeps the order when the top conversation gets activity', () => {
    const chatStore = seed()
    chatStore.currentConversationId = 'old-1'
    chatStore.finishStream('old-1', 'm1', false, 'reply text')
    expect(chatStore.conversations.map((c) => c.id)).toEqual(['old-1', 'old-2'])
  })
})
