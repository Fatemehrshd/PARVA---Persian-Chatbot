import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ChatComposer from '../src/components/chat/ChatComposer.vue'
import { useChatStore } from '../src/stores/chat'
import { useModelsStore } from '../src/stores/models'

describe('ChatComposer web-search toggle', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('modelbar search icon flips the same per-conversation web flag', async () => {
    const wrapper = mount(ChatComposer, {
      global: {
        stubs: {
          FilePreviewCard: true,
          BaseToggle: true,
        },
      },
    })
    const chatStore = useChatStore()
    chatStore.currentConversationId = 'c1'
    const iconBtn = wrapper.find('[data-testid="modelbar-search-toggle"]')
    expect(iconBtn.exists()).toBe(true)
    expect(chatStore.getConvFlag('c1').web).toBe(false)
    await iconBtn.trigger('click')
    expect(chatStore.getConvFlag('c1').web).toBe(true)
    await iconBtn.trigger('click')
    expect(chatStore.getConvFlag('c1').web).toBe(false)
  })

  it('shows the default badge inside the model picker list', async () => {
    const wrapper = mount(ChatComposer, {
      global: {
        stubs: {
          FilePreviewCard: true,
          BaseToggle: true,
        },
      },
    })
    await wrapper.find('.model-badge-btn').trigger('click')
    // Fresh store: initial model m-1 is flagged isDefault.
    expect(wrapper.text()).toContain('پیش‌فرض')
  })

  it('lists the platform default model first in the picker', async () => {
    const modelsStore = useModelsStore()
    modelsStore.models = [
      { id: 'x', name: 'Other', provider: 'p', apiIdentifier: 'x', isActive: true, isDefault: false, createdAt: new Date().toISOString() },
      { id: 'd', name: 'Def', provider: 'p', apiIdentifier: 'y', isActive: true, isDefault: true, createdAt: new Date().toISOString() },
    ] as any
    const wrapper = mount(ChatComposer, {
      global: {
        stubs: {
          FilePreviewCard: true,
          BaseToggle: true,
        },
      },
    })
    await wrapper.find('.model-badge-btn').trigger('click')
    const names = wrapper.findAll('.model-option-name').map((w) => w.text())
    expect(names[0]).toBe('Def')
  })

  it('flips the per-conversation web flag via modelbar button', async () => {
    const wrapper = mount(ChatComposer, {
      global: {
        stubs: {
          FilePreviewCard: true,
          BaseToggle: true,
        },
      },
    })
    const chatStore = useChatStore()
    chatStore.currentConversationId = 'c1'
    const btn = wrapper.find('[data-testid="modelbar-search-toggle"]')
    expect(btn.exists()).toBe(true)
    expect(chatStore.getConvFlag('c1').web).toBe(false)
    await btn.trigger('click')
    expect(chatStore.getConvFlag('c1').web).toBe(true)
  })

  it('hides thinking toggle when active model does not support thinking', async () => {
    const modelsStore = useModelsStore()
    modelsStore.models = [
      {
        id: 'no-think',
        name: 'Fast Non-Thinking Model',
        provider: 'openai',
        apiIdentifier: 'gpt-4o-mini',
        isActive: true,
        isDefault: true,
        supportsThinking: false,
        supportsVision: true,
        supportsDocument: true,
      } as any,
    ]
    modelsStore.selectedModelId = 'no-think'

    const wrapper = mount(ChatComposer, {
      global: {
        stubs: {
          FilePreviewCard: true,
          BaseToggle: true,
        },
      },
    })

    // Modelbar thinking toggle must NOT exist
    expect(wrapper.find('[data-testid="modelbar-thinking-toggle"]').exists()).toBe(false)
  })

  it('shows thinking toggle and flips thinking flag when active model supports thinking', async () => {
    const modelsStore = useModelsStore()
    modelsStore.models = [
      {
        id: 'think-model',
        name: 'Deep Thinking Model',
        provider: 'openai',
        apiIdentifier: 'o3-mini',
        isActive: true,
        isDefault: true,
        supportsThinking: true,
        supportsVision: true,
        supportsDocument: true,
      } as any,
    ]
    modelsStore.selectedModelId = 'think-model'

    const wrapper = mount(ChatComposer, {
      global: {
        stubs: {
          FilePreviewCard: true,
          BaseToggle: true,
        },
      },
    })

    const chatStore = useChatStore()
    chatStore.currentConversationId = 'c-think-1'

    // Modelbar thinking toggle must exist
    const thinkingBtn = wrapper.find('[data-testid="modelbar-thinking-toggle"]')
    expect(thinkingBtn.exists()).toBe(true)

    // Toggle thinking flag
    expect(chatStore.getConvFlag('c-think-1').thinking).toBeFalsy()
    await thinkingBtn.trigger('click')
    expect(chatStore.getConvFlag('c-think-1').thinking).toBe(true)
  })
})
