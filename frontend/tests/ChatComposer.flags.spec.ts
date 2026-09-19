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

  it('flips the per-conversation web flag', async () => {
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
    await wrapper.find('.attachment-btn').trigger('click')
    const btn = wrapper.find('[data-testid="toggle-web-search"]')
    expect(btn.exists()).toBe(true)
    expect(chatStore.getConvFlag('c1').web).toBe(false)
    await btn.trigger('click')
    expect(chatStore.getConvFlag('c1').web).toBe(true)
  })

  it('hides thinking toggles when active model does not support thinking', async () => {
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

    // Open attachment dropdown
    await wrapper.find('.attachment-btn').trigger('click')
    // Dropdown thinking toggle must NOT exist
    expect(wrapper.find('[data-testid="toggle-thinking"]').exists()).toBe(false)
  })

  it('shows thinking toggles and capability badge when active model supports thinking', async () => {
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

    // Modelbar thinking toggle must exist
    expect(wrapper.find('[data-testid="modelbar-thinking-toggle"]').exists()).toBe(true)

    // Model button must show capability badge for thinking
    const badge = wrapper.find('.model-badge-btn [data-test="capability-badge"][data-capability="thinking"]')
    expect(badge.exists()).toBe(true)

    // Open attachment dropdown
    await wrapper.find('.attachment-btn').trigger('click')
    expect(wrapper.find('[data-testid="toggle-thinking"]').exists()).toBe(true)
  })
})
