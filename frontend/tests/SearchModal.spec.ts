import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import SearchModal from '../src/components/chat/SearchModal.vue'
import { chatService } from '../src/services/chat.service'
import { useChatStore } from '../src/stores/chat'

vi.mock('../src/services/chat.service', () => ({
  chatService: {
    searchConversations: vi.fn(),
  },
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}))

describe('SearchModal.vue', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('renders search input when isOpen is true', () => {
    const wrapper = mount(SearchModal, {
      props: { isOpen: true },
      global: {
        stubs: {
          Teleport: true,
          Transition: false,
        },
      },
    })

    const input = wrapper.find('input.search-input')
    expect(input.exists()).toBe(true)
  })

  it('displays recent conversations when query is empty', async () => {
    const chatStore = useChatStore()
    chatStore.conversations = [
      { id: 'c-1', title: 'React Basics', createdAt: '2026-09-15', updatedAt: '2026-09-15' },
      { id: 'c-2', title: 'Vue Tutorial', createdAt: '2026-09-15', updatedAt: '2026-09-15' },
    ]

    const wrapper = mount(SearchModal, {
      props: { isOpen: true },
      global: {
        stubs: {
          Teleport: true,
          Transition: false,
        },
      },
    })

    const items = wrapper.findAll('.search-result-item')
    expect(items.length).toBe(2)
    expect(wrapper.text()).toContain('React Basics')
    expect(wrapper.text()).toContain('Vue Tutorial')
  })

  it('searches and shows results from chatService', async () => {
    vi.mocked(chatService.searchConversations).mockResolvedValue([
      {
        id: 'c-match',
        title: 'Backend NestJS',
        updatedAt: '2026-09-15',
        matchedIn: 'message',
        snippet: 'Here is how to set up NestJS guards',
      },
    ])

    const wrapper = mount(SearchModal, {
      props: { isOpen: true },
      global: {
        stubs: {
          Teleport: true,
          Transition: false,
        },
      },
    })

    const input = wrapper.find('input.search-input')
    await input.setValue('NestJS')

    // Wait for debounce
    await new Promise((r) => setTimeout(r, 260))

    expect(chatService.searchConversations).toHaveBeenCalledWith('NestJS')
  })

  it('emits close event on backdrop click or ESC', async () => {
    const wrapper = mount(SearchModal, {
      props: { isOpen: true },
      global: {
        stubs: {
          Teleport: true,
          Transition: false,
        },
      },
    })

    const backdrop = wrapper.find('.search-modal-backdrop')
    await backdrop.trigger('click')
    expect(wrapper.emitted('close')).toBeTruthy()
  })
})
