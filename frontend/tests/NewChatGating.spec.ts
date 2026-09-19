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

  it('keeps New Chat enabled when the user is on a fresh empty chat', async () => {
    const chatStore = useChatStore()

    const { useUiStore } = await import('../src/stores/ui')
    useUiStore().sidebarOpen = true

    const wrapper = mount(AppSidebar, { global: { plugins: [router] } })
    await flushPromises()

    expect(chatStore.currentConversationId).toBeNull()
    const btn = wrapper.get('.new-chat-btn')
    expect(btn.attributes('disabled')).toBeUndefined()
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

  it('adds a typed-in chat to the sidebar immediately after the user sends it, even while the model is still streaming', async () => {
    const chatStore = useChatStore()

    // User types directly without selecting any conversation; the chat should
    // become visible in the sidebar as soon as the user message exists.
    streamHandler = () => {}

    const sendPromise = chatStore.sendMessage('سلام پروا')
    await flushPromises()

    expect(chatStore.messages.length).toBe(1)
    expect(chatStore.conversations.length).toBe(1)
    expect(chatStore.conversations[0].id).toBe(chatStore.currentConversationId)

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

  it('disables New Chat and prevents clicks while the model is responding / streaming', async () => {
    const { useUiStore } = await import('../src/stores/ui')
    useUiStore().sidebarOpen = true

    const wrapper = mount(AppSidebar, { global: { plugins: [router] } })
    await flushPromises()

    const chatStore = useChatStore()
    chatStore.conversations = [
      {
        id: 'conv-stream',
        title: 'گفتگو جاری',
        modelId: 'm1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]
    chatStore.currentConversationId = 'conv-stream'
    chatStore.messages = [
      { id: 'm1', conversationId: 'conv-stream', role: 'user', content: 'سوال', createdAt: new Date().toISOString() },
    ]
    await wrapper.vm.$nextTick()

    // Without streaming, New Chat is enabled
    expect(wrapper.get('.new-chat-btn').attributes('disabled')).toBeUndefined()

    // Now simulate streaming is active for this conversation
    chatStore.convStreamStates.set('conv-stream', {
      isStreaming: true,
      isThinking: true,
      currentStreamingText: 'در حال تولید پاسخ...',
      streamError: null,
      lastUserPrompt: 'سوال',
      abortController: null,
      watchdogTimer: null,
    })
    await wrapper.vm.$nextTick()

    // New Chat must now be strictly disabled
    const newChatBtn = wrapper.get('.new-chat-btn')
    expect(newChatBtn.attributes('disabled')).toBeDefined()
    expect(newChatBtn.classes()).toContain('sb-action-row--disabled')
    expect(newChatBtn.attributes('title')).toContain('امکان شروع گفتگوی جدید در هنگام دریافت پاسخ وجود ندارد')

    // Also verify store createNewConversation guards against streaming
    const res = await chatStore.createNewConversation()
    expect(res).toBe('')

    wrapper.unmount()
  })
})
