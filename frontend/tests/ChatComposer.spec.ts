import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ChatComposer from '../src/components/chat/ChatComposer.vue'
import { useChatStore } from '../src/stores/chat'
import { useModelsStore } from '../src/stores/models'
import { useUiStore } from '../src/stores/ui'

describe('ChatComposer.vue', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('happy path: disables send button when empty, enables when user types, and submits message', async () => {
    const wrapper = mount(ChatComposer)
    const chatStore = useChatStore()

    const sendBtn = wrapper.find('.btn-send')
    expect(sendBtn.attributes('disabled')).toBeDefined()

    const textarea = wrapper.find('textarea')
    await textarea.setValue('Hello PARVA')

    expect(sendBtn.attributes('disabled')).toBeUndefined()

    await sendBtn.trigger('click')
    expect(chatStore.messages.length).toBeGreaterThan(0)
    expect(chatStore.messages[chatStore.messages.length - 1].content).toBe('Hello PARVA')
    expect((textarea.element as HTMLTextAreaElement).value).toBe('')
  })

  it('edge case: does not submit when message is only whitespace', async () => {
    const wrapper = mount(ChatComposer)
    const chatStore = useChatStore()
    const initialMessageCount = chatStore.messages.length

    const textarea = wrapper.find('textarea')
    await textarea.setValue('    ')

    const sendBtn = wrapper.find('.btn-send')
    expect(sendBtn.attributes('disabled')).toBeDefined()

    await sendBtn.trigger('click')
    expect(chatStore.messages.length).toBe(initialMessageCount)
  })

  it('allows changing AI model directly from composer form', async () => {
    const wrapper = mount(ChatComposer)
    const modelBtn = wrapper.find('.model-badge-btn')
    expect(modelBtn.exists()).toBe(true)

    // Initially dropdown is closed
    expect(wrapper.find('.composer-model-dropdown').exists()).toBe(false)

    // Click to open dropdown
    await modelBtn.trigger('click')
    expect(wrapper.find('.composer-model-dropdown').exists()).toBe(true)

    // Select a different model option
    const options = wrapper.findAll('.model-option-btn')
    expect(options.length).toBeGreaterThan(1)
    await options[1].trigger('click')

    // Dropdown closes after selection
    expect(wrapper.find('.composer-model-dropdown').exists()).toBe(false)
  })

  it('renders stream error alert banner and triggers retry when retry button is clicked', async () => {
    const wrapper = mount(ChatComposer)
    const chatStore = useChatStore()
    chatStore.currentConversationId = 'conv-err'
    chatStore.messages = [
      {
        id: 'msg-user-1',
        conversationId: 'conv-err',
        role: 'user',
        content: 'سلام این یک پیام تست است',
        createdAt: new Date().toISOString(),
        status: 'error'
      }
    ]
    // Set stream error state via the Map (streamError/isStreaming are computed from Map)
    chatStore.convStreamStates.set('conv-err', {
      isStreaming: false, isThinking: false,
      streamError: 'زمان انتظار برای دریافت پاسخ به پایان رسید',
      currentStreamingText: '', abortController: null, watchdogTimer: null,
      lastUserPrompt: 'سلام این یک پیام تست است'
    })

    await wrapper.vm.$nextTick()

    // Alert banner exists and shows the error message
    const alertBanner = wrapper.find('.stream-error-banner')
    expect(alertBanner.exists()).toBe(true)
    expect(alertBanner.text()).toContain('زمان انتظار برای دریافت پاسخ به پایان رسید')

    // Find retry button
    const retryBtn = wrapper.find('.stream-error-retry-btn')
    expect(retryBtn.exists()).toBe(true)

    // Click retry
    await retryBtn.trigger('click')

    // Expect streamError to be cleared and message re-sent
    expect(chatStore.streamError).toBeNull()
    expect(chatStore.messages.length).toBe(1)
    expect(chatStore.messages[0].content).toBe('سلام این یک پیام تست است')
  })

  it('locks composer and displays token limit banner without retry button when isTokenLimitExceeded is true', async () => {
    const wrapper = mount(ChatComposer)
    const chatStore = useChatStore()
    chatStore.isTokenLimitExceeded = true
    chatStore.convStreamStates.set(chatStore.currentConversationId, {
      isStreaming: false,
      isThinking: false,
      streamError: 'سقف مجاز مصرف توکن به پایان رسیده است',
      currentStreamingText: '',
      abortController: null,
      watchdogTimer: null,
      lastUserPrompt: 'پیام'
    })
    await wrapper.vm.$nextTick()

    // Alert banner exists with limit styling
    const limitBanner = wrapper.find('.stream-error-banner--limit')
    expect(limitBanner.exists()).toBe(true)
    expect(limitBanner.text()).toContain('توکن مصرفی شما به پایان رسید')

    // Retry button MUST NOT exist for quota limit errors
    const retryBtn = wrapper.find('.stream-error-retry-btn')
    expect(retryBtn.exists()).toBe(false)

    // Send button and textarea are disabled
    const sendBtn = wrapper.find('.btn-send')
    expect(sendBtn.attributes('disabled')).toBeDefined()
    const textarea = wrapper.find('textarea')
    expect(textarea.attributes('disabled')).toBeDefined()
  })

  it('switches text direction dynamically between LTR and RTL as user types English and Persian characters', async () => {
    const wrapper = mount(ChatComposer)
    const textarea = wrapper.find('textarea')

    // Initially empty: default RTL
    expect(textarea.attributes('dir')).toBe('rtl')
    expect(textarea.classes()).toContain('rtl')

    // 1. User types English: "Hello" -> LTR
    await textarea.setValue('Hello')
    expect(textarea.attributes('dir')).toBe('ltr')
    expect(textarea.classes()).toContain('ltr')

    // 2. User then adds Persian: "Hello سلام" -> RTL
    await textarea.setValue('Hello سلام')
    expect(textarea.attributes('dir')).toBe('rtl')
    expect(textarea.classes()).toContain('rtl')

    // 3. User then adds English: "Hello سلام world" -> MUST stay RTL per rule (اگر کلمه فارسی و انگلیسی بود میبایست rtl باشه)
    await textarea.setValue('Hello سلام world')
    expect(textarea.attributes('dir')).toBe('rtl')
    expect(textarea.classes()).toContain('rtl')

    // 4. Cleared -> back to RTL
    await textarea.setValue('')
    expect(textarea.attributes('dir')).toBe('rtl')
    expect(textarea.classes()).toContain('rtl')
  })

  it('renders tariff badges for web search (1.2x) and thinking (1.3x) in attachment menu', async () => {
    const wrapper = mount(ChatComposer)
    await wrapper.find('.attachment-btn').trigger('click')

    expect(wrapper.text()).toContain('ضریب ۱.۲×')
    expect(wrapper.text()).toContain('ضریب ۱.۳×')
    expect(wrapper.find('[data-testid="toggle-thinking"]').exists()).toBe(true)
  })

  it('toggles thinking flag when active model supports thinking', async () => {
    const wrapper = mount(ChatComposer)
    const chatStore = useChatStore()
    chatStore.currentConversationId = 'c-test'

    const thinkingBtn = wrapper.find('[data-testid="modelbar-thinking-toggle"]')
    expect(thinkingBtn.exists()).toBe(true)
    expect(chatStore.getConvFlag('c-test').thinking).toBeFalsy()

    await thinkingBtn.trigger('click')
    expect(chatStore.getConvFlag('c-test').thinking).toBe(true)

    await thinkingBtn.trigger('click')
    expect(chatStore.getConvFlag('c-test').thinking).toBe(false)
  })

  it('allows toggling thinking and warns when model has supportsThinking false', async () => {
    const wrapper = mount(ChatComposer)
    const modelsStore = useModelsStore()
    const uiStore = useUiStore()
    const toastSpy = vi.spyOn(uiStore, 'showToast')
    modelsStore.selectedModelId = 'm-no-think'
    modelsStore.models = [
      {
        id: 'm-no-think',
        name: 'Basic Model',
        provider: 'openai',
        apiIdentifier: 'basic',
        isActive: true,
        isDefault: true,
        supportsThinking: false,
        supportsVision: false,
        supportsDocument: false,
        createdAt: new Date().toISOString()
      }
    ] as any

    await wrapper.vm.$nextTick()

    const thinkingBtn = wrapper.find('[data-testid="modelbar-thinking-toggle"]')
    expect(thinkingBtn.attributes('disabled')).toBeUndefined()

    await thinkingBtn.trigger('click')
    expect(toastSpy).toHaveBeenCalledWith('توجه: ممکن است این مدل به طور کامل از تفکر عمیق پشتیبانی نکند', 'info')
  })

  it('renders CapabilityBadge in model picker dropdown', async () => {
    const wrapper = mount(ChatComposer)
    const modelBtn = wrapper.find('.model-badge-btn')
    await modelBtn.trigger('click')

    const badges = wrapper.findAll('[data-test="capability-badge"]')
    expect(badges.length).toBeGreaterThan(0)
  })
})
