import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import AppSidebar from '../src/components/layout/AppSidebar.vue'
import { useChatStore } from '../src/stores/chat'
import { chatService } from '../src/services/chat.service'

// Deferred stream: the store must not treat the conversation as "real" until
// the assistant's first token arrives.
let streamHandler: ((onToken: (t: string) => void, onDone: (id: string) => void) => void) | null = null

vi.mock('../src/services/chat.service', () => ({
  chatService: {
    listConversations: vi.fn().mockResolvedValue([]),
    getMessages: vi.fn().mockResolvedValue({ messages: [] }),
    createConversation: vi.fn().mockImplementation(async (_modelId: any, title?: string) => ({
      id: 'conv-created-' + Math.random().toString(36).slice(2, 8),
      title: title || 'گفتگوی جدید',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })),
    sendMessageStream: vi.fn().mockImplementation(
      async (
        _convId: string,
        _content: string,
        onToken: (t: string) => void,
        onDone: (id: string) => void,
      ) => {
        if (streamHandler) {
          streamHandler(onToken, onDone)
          return
        }
        onToken('پاسخ ')
        onToken('مدل')
        onDone('msg-assistant-1')
      },
    ),
  }
}))

describe('New Chat gating & sidebar visibility', () => {
  let router: any
  let fetchSpy: any

  beforeEach(() => {
    setActivePinia(createPinia())
    streamHandler = null
    router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', name: 'chat', component: { template: '<div />' } },
        { path: '/chat/:id', name: 'chat-conversation', component: { template: '<div />' } },
      ],
    })
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }))
  })

  afterEach(() => {
    fetchSpy.mockRestore()
  })

  it('disables New Chat when no conversation is selected at all', async () => {
    const chatStore = useChatStore()

    const { useUiStore } = await import('../src/stores/ui')
    useUiStore().sidebarOpen = true

    const wrapper = mount(AppSidebar, { global: { plugins: [router] } })
    await flushPromises()

    expect(chatStore.currentConversationId).toBeNull()
    const btn = wrapper.get('.new-chat-btn')
    expect(btn.attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })

  it('keeps New Chat enabled for a conversation that already has messages', async () => {
    const { useUiStore } = await import('../src/stores/ui')
    useUiStore().sidebarOpen = true

    const wrapper = mount(AppSidebar, { global: { plugins: [router] } })
    await flushPromises()

    // Select an existing conversation with history after mount (onMounted
    // loadConversations with an empty list resets the selection first).
    const chatStore = useChatStore()
    chatStore.conversations = [
      {
        id: 'conv-x',
        title: 'گفتگو فعال',
        modelId: 'm1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]
    chatStore.currentConversationId = 'conv-x'
    chatStore.messages = [
      { id: 'm1', conversationId: 'conv-x', role: 'user', content: 'سلام', createdAt: new Date().toISOString() },
      { id: 'm2', conversationId: 'conv-x', role: 'assistant', content: 'پاسخ', createdAt: new Date().toISOString() },
    ]
    await wrapper.vm.$nextTick()

    expect(wrapper.get('.new-chat-btn').attributes('disabled')).toBeUndefined()
    wrapper.unmount()
  })

  it('adds a typed-in chat to the sidebar only after the assistant responds', async () => {
    const chatStore = useChatStore()

    // User types directly without selecting any conversation; the model is
    // still thinking (no token released yet).
    streamHandler = () => {}

    const sendPromise = chatStore.sendMessage('سلام پروا')
    await flushPromises()

    expect(chatStore.messages.length).toBe(1)
    expect(chatStore.conversations.length).toBe(0)

    // Model answers now
    const call = (chatService.sendMessageStream as any).mock.calls.at(-1)
    const onToken = call[2]
    const onDone = call[3]
    onToken('پاسخ')
    onDone('msg-1')
    await sendPromise

    expect(chatStore.conversations.length).toBe(1)
    expect(chatStore.conversations[0].id).toBe(chatStore.currentConversationId)
  })
})
