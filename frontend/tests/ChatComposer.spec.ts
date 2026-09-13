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
})
