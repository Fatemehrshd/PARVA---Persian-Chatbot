import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { useChatStore } from '../src/stores/chat'
import { useUiStore } from '../src/stores/ui'
import { chatService } from '../src/services/chat.service'
import AppSidebar from '../src/components/layout/AppSidebar.vue'

describe('conversation pinning and sorting', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    Object.defineProperty(globalThis, 'sessionStorage', {
      value: { removeItem: () => {}, getItem: () => null, setItem: () => {} },
      configurable: true,
    })
    localStorage.clear()
    vi.restoreAllMocks()
  })

  function seed() {
    const chatStore = useChatStore()
    chatStore.conversations = [
      { id: 'c-1', title: 'First', isPinned: false, createdAt: '2026-01-01T10:00:00.000Z', updatedAt: '2026-01-01T10:00:00.000Z' },
      { id: 'c-2', title: 'Second', isPinned: false, createdAt: '2026-01-01T11:00:00.000Z', updatedAt: '2026-01-01T11:00:00.000Z' },
      { id: 'c-3', title: 'Third', isPinned: false, createdAt: '2026-01-01T12:00:00.000Z', updatedAt: '2026-01-01T12:00:00.000Z' },
    ]
    chatStore.sortConversations()
    return chatStore
  }

  it('initially orders by updatedAt DESC when none are pinned', () => {
    const chatStore = seed()
    expect(chatStore.conversations.map((c) => c.id)).toEqual(['c-3', 'c-2', 'c-1'])
  })

  it('moves pinned conversation to the very top when pinned', async () => {
    const chatStore = seed()
    vi.spyOn(chatService, 'togglePinConversation').mockResolvedValue({ id: 'c-1', isPinned: true } as any)

    const result = await chatStore.togglePinConversation('c-1')
    expect(result).toBe(true)
    expect(chatStore.conversations.map((c) => c.id)).toEqual(['c-1', 'c-3', 'c-2'])
    expect(chatStore.conversations[0].isPinned).toBe(true)
  })

  it('orders multiple pinned conversations among themselves by updatedAt DESC', async () => {
    const chatStore = seed()
    vi.spyOn(chatService, 'togglePinConversation').mockResolvedValue({} as any)

    await chatStore.togglePinConversation('c-1', true) // updatedAt 10:00
    await chatStore.togglePinConversation('c-2', true) // updatedAt 11:00

    // c-2 and c-1 are pinned, c-2 has newer updatedAt, c-3 is unpinned
    expect(chatStore.conversations.map((c) => c.id)).toEqual(['c-2', 'c-1', 'c-3'])
  })

  it('unpinning restores standard updatedAt DESC order', async () => {
    const chatStore = seed()
    vi.spyOn(chatService, 'togglePinConversation').mockResolvedValue({} as any)

    await chatStore.togglePinConversation('c-1', true)
    expect(chatStore.conversations[0].id).toBe('c-1')

    await chatStore.togglePinConversation('c-1', false)
    expect(chatStore.conversations.map((c) => c.id)).toEqual(['c-3', 'c-2', 'c-1'])
    expect(chatStore.conversations[2].isPinned).toBe(false)
  })

  it('rolls back optimistic pin state if backend request fails', async () => {
    const chatStore = seed()
    vi.spyOn(chatService, 'togglePinConversation').mockRejectedValue(new Error('Network error'))

    await expect(chatStore.togglePinConversation('c-1', true)).rejects.toThrow('Network error')
    expect(chatStore.conversations.find((c) => c.id === 'c-1')?.isPinned).toBe(false)
    expect(chatStore.conversations.map((c) => c.id)).toEqual(['c-3', 'c-2', 'c-1'])
  })

  it('finishStream updates updatedAt but does not bypass pinned conversations', () => {
    const chatStore = seed()
    chatStore.conversations[2].isPinned = true // c-1 is pinned
    chatStore.sortConversations()
    expect(chatStore.conversations.map((c) => c.id)).toEqual(['c-1', 'c-3', 'c-2'])

    // c-3 gets new activity
    chatStore.currentConversationId = 'c-3'
    chatStore.finishStream('c-3', 'msg-1', false, 'test reply')

    // c-1 is pinned so it stays first; c-3 is unpinned but newer than c-2
    expect(chatStore.conversations.map((c) => c.id)).toEqual(['c-1', 'c-3', 'c-2'])
  })
})

describe('AppSidebar 3-dots action menu and pin indicator', () => {
  let router: any

  beforeEach(() => {
    setActivePinia(createPinia())
    router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', name: 'chat', component: { template: '<div />' } },
        { path: '/chat/:id', name: 'chat-conversation', component: { template: '<div />' } },
      ],
    })
    vi.spyOn(chatService, 'listConversations').mockResolvedValue([])
    vi.spyOn(chatService, 'getMessages').mockResolvedValue([] as any)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders 3-dots button and does not render direct edit/delete buttons', async () => {
    const uiStore = useUiStore()
    uiStore.sidebarOpen = true
    const chatStore = useChatStore()
    chatStore.conversations = [
      { id: 'c-1', title: 'گفتگو آزمایشی', isPinned: false, createdAt: '2026-01-01T10:00:00.000Z', updatedAt: '2026-01-01T10:00:00.000Z' },
    ]

    const wrapper = mount(AppSidebar, { global: { plugins: [router] } })
    await flushPromises()

    // 3-dots button should exist
    const moreBtn = wrapper.find('.sb-conv-more-btn')
    expect(moreBtn.exists()).toBe(true)

    // Direct edit/delete buttons should NOT exist directly inside .sb-conv-actions (only inside dropdown when opened)
    expect(wrapper.find('.sb-conv-dropdown').exists()).toBe(false)
    wrapper.unmount()
  })

  it('opens dropdown menu on clicking 3-dots with pin, edit, delete options', async () => {
    const uiStore = useUiStore()
    uiStore.sidebarOpen = true
    const chatStore = useChatStore()
    chatStore.conversations = [
      { id: 'c-1', title: 'گفتگو آزمایشی', isPinned: false, createdAt: '2026-01-01T10:00:00.000Z', updatedAt: '2026-01-01T10:00:00.000Z' },
    ]

    const wrapper = mount(AppSidebar, { global: { plugins: [router] } })
    await flushPromises()

    const moreBtn = wrapper.get('.sb-conv-more-btn')
    await moreBtn.trigger('click')
    await wrapper.vm.$nextTick()

    const dropdown = wrapper.find('.sb-conv-dropdown')
    expect(dropdown.exists()).toBe(true)

    const items = dropdown.findAll('.sb-dropdown-item')
    expect(items.length).toBe(4)
    expect(items[0].text()).toContain('پین کردن گفتگو')
    expect(items[1].text()).toContain('ویرایش عنوان')
    expect(items[2].text()).toContain('اشتراک‌گذاری گفتگو')
    expect(items[3].text()).toContain('حذف گفتگو')

    wrapper.unmount()
  })

  it('shows pinned icon when conversation is pinned and shows unpin option in dropdown', async () => {
    const uiStore = useUiStore()
    uiStore.sidebarOpen = true
    const chatStore = useChatStore()
    chatStore.conversations = [
      { id: 'c-1', title: 'گفتگو پین شده', isPinned: true, createdAt: '2026-01-01T10:00:00.000Z', updatedAt: '2026-01-01T10:00:00.000Z' },
    ]

    const wrapper = mount(AppSidebar, { global: { plugins: [router] } })
    await flushPromises()

    // Pinned icon indicator should be present
    expect(wrapper.find('.sb-conv-icon--pinned').exists()).toBe(true)

    // Click 3-dots
    const moreBtn = wrapper.get('.sb-conv-more-btn')
    await moreBtn.trigger('click')
    await wrapper.vm.$nextTick()

    // Menu should show "برداشتن پین"
    const dropdown = wrapper.find('.sb-conv-dropdown')
    expect(dropdown.text()).toContain('برداشتن پین')

    wrapper.unmount()
  })

  it('clicking pin option calls chatStore.togglePinConversation', async () => {
    const uiStore = useUiStore()
    uiStore.sidebarOpen = true
    const chatStore = useChatStore()
    chatStore.conversations = [
      { id: 'c-1', title: 'گفتگو آزمایشی', isPinned: false, createdAt: '2026-01-01T10:00:00.000Z', updatedAt: '2026-01-01T10:00:00.000Z' },
    ]

    const pinSpy = vi.spyOn(chatStore, 'togglePinConversation').mockResolvedValue(true)

    const wrapper = mount(AppSidebar, { global: { plugins: [router] } })
    await flushPromises()

    await wrapper.get('.sb-conv-more-btn').trigger('click')
    await wrapper.vm.$nextTick()

    const pinBtn = wrapper.findAll('.sb-dropdown-item')[0]
    await pinBtn.trigger('click')
    await wrapper.vm.$nextTick()

    expect(pinSpy).toHaveBeenCalledWith('c-1')
    wrapper.unmount()
  })
})
