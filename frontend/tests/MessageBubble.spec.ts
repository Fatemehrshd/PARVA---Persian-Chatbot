import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import MessageBubble from '../src/components/chat/MessageBubble.vue'
import { useAuthStore } from '../src/stores/auth'
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

  it('renders the saved user avatar beside a user message', () => {
    const authStore = useAuthStore()
    authStore.user = {
      id: 'u-1',
      email: 'user@example.com',
      displayName: 'User',
      avatarUrl: 'https://cdn.example/avatar.png',
      role: 'user',
    }
    const userMessage: Message = {
      id: 'm-user-avatar',
      conversationId: 'c-1',
      role: 'user',
      content: 'With avatar',
      createdAt: new Date().toISOString(),
    }

    const wrapper = mount(MessageBubble, { props: { message: userMessage } })

    expect(wrapper.find('.user-avatar-image').attributes('src')).toBe('https://cdn.example/avatar.png')
  })

  it('applies rtl class and dir="rtl" for Persian message content', () => {
    const persianMessage: Message = {
      id: 'm-fa-1',
      conversationId: 'c-1',
      role: 'assistant',
      content: 'سلام! چطور می‌توانم به شما کمک کنم؟',
      createdAt: new Date().toISOString()
    }

    const wrapper = mount(MessageBubble, {
      props: { message: persianMessage }
    })

    const bubble = wrapper.find('.bubble')
    expect(bubble.attributes('dir')).toBe('rtl')
    expect(bubble.classes()).toContain('rtl')
  })

  it('applies ltr class and dir="ltr" for English message content', () => {
    const englishMessage: Message = {
      id: 'm-en-1',
      conversationId: 'c-1',
      role: 'assistant',
      content: 'Hello! How can I assist you today?',
      createdAt: new Date().toISOString()
    }

    const wrapper = mount(MessageBubble, {
      props: { message: englishMessage }
    })

    const bubble = wrapper.find('.bubble')
    expect(bubble.attributes('dir')).toBe('ltr')
    expect(bubble.classes()).toContain('ltr')
  })

  it('does not render sending indicator text under message', () => {
    const userMessage: Message = {
      id: 'm-send-1',
      conversationId: 'c-1',
      role: 'user',
      content: 'Sending test message...',
      createdAt: new Date().toISOString(),
      status: 'sending'
    }

    const wrapper = mount(MessageBubble, {
      props: { message: userMessage }
    })

    expect(wrapper.find('.status-sending').exists()).toBe(false)
  })

  it('does not render status indicator or sent text under user message', () => {
    const userMessage: Message = {
      id: 'm-sent-1',
      conversationId: 'c-1',
      role: 'user',
      content: 'Sent test message',
      createdAt: new Date().toISOString(),
      status: 'sent'
    }

    const wrapper = mount(MessageBubble, {
      props: { message: userMessage }
    })

    expect(wrapper.find('.status-sent').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('ارسال شد')
  })

  it('does not render retry button under user message (handled by bottom composer banner)', () => {
    const userMessage: Message = {
      id: 'm-err-1',
      conversationId: 'c-1',
      role: 'user',
      content: 'Failed message',
      createdAt: new Date().toISOString(),
      status: 'error'
    }

    const wrapper = mount(MessageBubble, {
      props: { message: userMessage }
    })

    // Retry button is deliberately not inside message bubble
    expect(wrapper.find('.retry-bubble-btn').exists()).toBe(false)
    expect(wrapper.find('.bubble').classes()).toContain('border-destructive/50')
  })

  it('renders mixed/hybrid multi-line user message with independent direction per line', () => {
    const hybridMessage: Message = {
      id: 'm-hybrid-1',
      conversationId: 'c-1',
      role: 'user',
      content: 'Line 1 in English\nخط دوم به زبان فارسی\nLine 3 in English again',
      createdAt: new Date().toISOString()
    }

    const wrapper = mount(MessageBubble, {
      props: { message: hybridMessage }
    })

    const lines = wrapper.findAll('.user-msg-line')
    expect(lines.length).toBe(3)

    // Line 1: English -> ltr
    expect(lines[0].attributes('dir')).toBe('ltr')
    expect(lines[0].classes()).toContain('ltr')

    // Line 2: Persian -> rtl
    expect(lines[1].attributes('dir')).toBe('rtl')
    expect(lines[1].classes()).toContain('rtl')

    // Line 3: English -> ltr
    expect(lines[2].attributes('dir')).toBe('ltr')
    expect(lines[2].classes()).toContain('ltr')
  })

  it('renders like and dislike feedback buttons on assistant message', () => {
    const assistantMessage: Message = {
      id: 'm-ai-feedback-1',
      conversationId: 'c-1',
      role: 'assistant',
      content: 'This is a helpful answer.',
      createdAt: new Date().toISOString(),
      feedback: 'like',
    }

    const wrapper = mount(MessageBubble, {
      props: { message: assistantMessage }
    })

    const feedbackBtns = wrapper.findAll('.feedback-btn')
    expect(feedbackBtns.length).toBe(2)
    // First button is like, second is dislike
    expect(feedbackBtns[0].classes()).toContain('text-emerald-500')
  })
})

