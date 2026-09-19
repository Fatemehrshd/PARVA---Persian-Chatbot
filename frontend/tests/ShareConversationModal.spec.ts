import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ShareConversationModal from '../src/components/chat/ShareConversationModal.vue'
import { shareService } from '../src/services/share.service'

vi.mock('../src/services/share.service', () => ({
  shareService: {
    getUserShare: vi.fn(),
    createOrUpdateShare: vi.fn(),
    revokeShare: vi.fn(),
  },
}))

describe('ShareConversationModal', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('renders correctly and shows create button when no existing share exists', async () => {
    vi.mocked(shareService.getUserShare).mockResolvedValue(null)

    const wrapper = mount(ShareConversationModal, {
      props: {
        isOpen: true,
        conversation: {
          id: 'c1',
          title: 'گفتگوی تست اشتراک',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      },
    })

    await flushPromises()

    expect(wrapper.text()).toContain('گفتگوی تست اشتراک')
    expect(wrapper.text()).toContain('ایجاد پیوند اشتراک‌گذاری عمومی')
    expect(wrapper.text()).toContain('اسنپ‌شات منجمد و عمومی')
  })

  it('displays existing share URL when active share exists', async () => {
    vi.mocked(shareService.getUserShare).mockResolvedValue({
      id: 's1',
      shareCode: 'abc123xyz456',
      title: 'گفتگوی تست اشتراک',
      messageCount: 5,
      createdAt: '2026-09-19T10:00:00Z',
      updatedAt: '2026-09-19T10:00:00Z',
      isActive: true,
    })

    const wrapper = mount(ShareConversationModal, {
      props: {
        isOpen: true,
        conversation: {
          id: 'c1',
          title: 'گفتگوی تست اشتراک',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      },
    })

    await flushPromises()

    expect(wrapper.text()).toContain('پیوند فعال است')
    expect(wrapper.find('input[readonly]').exists()).toBe(true)
    const input = wrapper.get('input[readonly]')
    expect((input.element as HTMLInputElement).value).toContain('/share/abc123xyz456')
    expect(wrapper.text()).toContain('کپی پیوند')
  })

  it('creates share link when create button is clicked', async () => {
    vi.mocked(shareService.getUserShare).mockResolvedValue(null)
    vi.mocked(shareService.createOrUpdateShare).mockResolvedValue({
      id: 's1',
      shareCode: 'newCode98765',
      title: 'گفتگوی تست اشتراک',
      messageCount: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isActive: true,
    })

    const wrapper = mount(ShareConversationModal, {
      props: {
        isOpen: true,
        conversation: {
          id: 'c1',
          title: 'گفتگوی تست اشتراک',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      },
    })

    await flushPromises()

    const createBtn = wrapper.findAll('button').find((b) => b.text().includes('ایجاد پیوند اشتراک‌گذاری'))
    expect(createBtn).toBeDefined()
    await createBtn!.trigger('click')

    await flushPromises()

    expect(shareService.createOrUpdateShare).toHaveBeenCalledWith('c1')
    expect(wrapper.emitted('shared')).toHaveLength(1)
    expect(wrapper.emitted('shared')![0]).toEqual(['newCode98765'])
  })
})
