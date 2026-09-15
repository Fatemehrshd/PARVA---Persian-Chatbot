import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import ChatView from '../src/views/ChatView.vue'
import AppSidebar from '../src/components/layout/AppSidebar.vue'
import { useChatStore } from '../src/stores/chat'

vi.mock('../src/services/models.service', () => ({
  modelsService: {
    listModels: vi.fn().mockResolvedValue({ models: [] })
  }
}))

vi.mock('../src/services/chat.service', () => ({
  chatService: {
    listConversations: vi.fn().mockResolvedValue({
      conversations: [
        {
          id: 'conv-1',
          title: 'Conversation 1',
          modelId: 'm1',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'conv-2',
          title: 'Conversation 2',
          modelId: 'm1',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ]
    }),
    getMessages: vi.fn().mockResolvedValue({ messages: [] }),
    createConversation: vi.fn().mockResolvedValue({
      id: 'conv-mock-new',
      title: 'New Chat',
      modelId: 'm1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })
  }
}))

describe('Chat Routing and Refresh Persistence', () => {
  let router: any

  beforeEach(() => {
    setActivePinia(createPinia())
    router = createRouter({
      history: createMemoryHistory(),
      routes: [
        {
          path: '/',
          name: 'chat',
          component: ChatView
        },
        {
          path: '/chat',
          redirect: '/'
        },
        {
          path: '/chat/:id',
          name: 'chat-conversation',
          component: ChatView
        }
      ]
    })
  })

  it('happy path: loads and activates specific conversation on page refresh / direct hit at /chat/:id', async () => {
    const chatStore = useChatStore()

    // Simulate direct navigation / browser refresh at /chat/conv-2
    await router.push('/chat/conv-2')
    await router.isReady()

    const wrapper = mount(ChatView, {
      global: {
        plugins: [router]
      }
    })

    await flushPromises()

    expect(chatStore.currentConversationId).toBe('conv-2')
    expect(router.currentRoute.value.path).toBe('/chat/conv-2')
    wrapper.unmount()
  })

  it('navigates route when selecting conversation in AppSidebar', async () => {
    const chatStore = useChatStore()
    chatStore.conversations = [
      {
        id: 'conv-alpha',
        title: 'Alpha Chat',
        modelId: 'm1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'conv-beta',
        title: 'Beta Chat',
        modelId: 'm1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ]
    chatStore.currentConversationId = 'conv-alpha'

    await router.push('/chat/conv-alpha')
    await router.isReady()

    const wrapper = mount(AppSidebar, {
      global: {
        plugins: [router]
      }
    })

    // Force sidebar open so expanded state renders
    const { useUiStore } = await import('../src/stores/ui')
    const uiStore = useUiStore()
    uiStore.sidebarOpen = true
    await wrapper.vm.$nextTick()

    // Click on Beta Chat — class is sb-conv-item in current implementation
    const chatItems = wrapper.findAll('.sb-conv-item')
    expect(chatItems.length).toBe(2)

    await chatItems[1].trigger('click')
    await flushPromises()

    expect(chatStore.currentConversationId).toBe('conv-beta')
    expect(router.currentRoute.value.path).toBe('/chat/conv-beta')
    wrapper.unmount()
  })

  it('creates new conversation and navigates to /chat/:newId on New Chat button click', async () => {
    const chatStore = useChatStore()
    const { useUiStore } = await import('../src/stores/ui')
    const uiStore = useUiStore()

    // Force sidebar open and have messages BEFORE mounting so expanded template renders
    uiStore.sidebarOpen = true
    chatStore.currentConversationId = 'conv-old'
    chatStore.messages = [{ id: 'msg-1', conversationId: 'conv-old', role: 'user', content: 'Hi', createdAt: new Date().toISOString() }]

    await router.push('/chat/conv-old')
    await router.isReady()

    const wrapper = mount(AppSidebar, {
      global: {
        plugins: [router]
      }
    })
    await wrapper.vm.$nextTick()

    const newChatBtn = wrapper.find('.new-chat-btn')
    expect(newChatBtn.exists()).toBe(true)

    await newChatBtn.trigger('click')
    await flushPromises()

    const activeId = chatStore.currentConversationId
    expect(activeId).toBeDefined()
    expect(router.currentRoute.value.path).toBe(`/chat/${activeId}`)
    wrapper.unmount()
  })
})

