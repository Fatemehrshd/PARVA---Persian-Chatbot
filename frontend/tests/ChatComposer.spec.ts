import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ChatComposer from '../src/components/chat/ChatComposer.vue'
import { useChatStore } from '../src/stores/chat'

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
    await textarea.setValue('Hello NeuralChat')

    expect(sendBtn.attributes('disabled')).toBeUndefined()

    await sendBtn.trigger('click')
    expect(chatStore.messages.length).toBeGreaterThan(0)
    expect(chatStore.messages[chatStore.messages.length - 1].content).toBe('Hello NeuralChat')
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
})
