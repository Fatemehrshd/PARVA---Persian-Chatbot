import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import MessageBubble from '../src/components/chat/MessageBubble.vue'
import type { Message } from '../src/types'

describe('MessageBubble.vue', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders user message with user bubble styling', () => {
    const userMessage: Message = {
      id: 'm-user-1',
      conversationId: 'c-1',
      role: 'user',
      content: 'Can you help me design a UI?',
      createdAt: new Date().toISOString()
    }

    const wrapper = mount(MessageBubble, {
      props: { message: userMessage }
    })

    expect(wrapper.find('.row-user').exists()).toBe(true)
    expect(wrapper.find('.bubble-user').exists()).toBe(true)
    expect(wrapper.text()).toContain('Can you help me design a UI?')
  })

  it('renders assistant message with assistant bubble and copy action button', () => {
    const assistantMessage: Message = {
      id: 'm-ai-1',
      conversationId: 'c-1',
      role: 'assistant',
      content: 'Yes, absolutely! Let us discuss color tokens and layout.',
      createdAt: new Date().toISOString()
    }

    const wrapper = mount(MessageBubble, {
      props: { message: assistantMessage }
    })

    expect(wrapper.find('.row-assistant').exists()).toBe(true)
    expect(wrapper.find('.bubble-assistant').exists()).toBe(true)
    expect(wrapper.find('.copy-button').exists()).toBe(true)
    expect(wrapper.text()).toContain('Yes, absolutely!')
  })
})
