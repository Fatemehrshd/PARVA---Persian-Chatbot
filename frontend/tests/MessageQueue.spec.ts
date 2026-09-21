import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ChatComposer from '../src/components/chat/ChatComposer.vue'
import { useChatStore } from '../src/stores/chat'
import { useUiStore } from '../src/stores/ui'
import { chatService } from '../src/services/chat.service'

vi.mock('../src/services/chat.service', () => ({
  chatService: {
    createConversation: vi.fn().mockResolvedValue({ id: 'conv-real-1', title: 'تست' }),
    sendMessageStream: vi.fn(),
    stopActiveStream: vi.fn().mockResolvedValue({ success: true }),
    deleteConversation: vi.fn().mockResolvedValue({ success: true }),
    updateConversation: vi.fn().mockResolvedValue({ success: true }),
  },
}))

vi.mock('../src/services/api', () => ({
  checkBackendHealth: vi.fn().mockResolvedValue(true),
}))

describe('Message Queue Feature (قابلیت پیام در صف)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('1. User can type and submit message while assistant is streaming (message added to queue)', async () => {
    const wrapper = mount(ChatComposer)
    const chatStore = useChatStore()
    const uiStore = useUiStore()
    const toastSpy = vi.spyOn(uiStore, 'showToast')

    chatStore.currentConversationId = 'conv-test-1'
    chatStore.convStreamStates.set('conv-test-1', {
      isStreaming: true,
      isThinking: false,
      streamError: null,
      currentStreamingText: 'پاسخ هوش مصنوعی در حال تولید...',
      abortController: new AbortController(),
      watchdogTimer: null,
      lastUserPrompt: 'پیام اول',
      charBuffer: [],
      releaseTimer: null,
      pendingSources: null,
      isSearching: false,
      searchFailed: false,
      currentReasoning: '',
      isActivelyThinking: false,
      thinkingDurationMs: null,
    })

    await wrapper.vm.$nextTick()

    // Stop button is visible
    expect(wrapper.find('[data-testid="composer-stop-btn"]').exists()).toBe(true)
    // Send/queue button not visible yet because input is empty
    expect(wrapper.find('[data-testid="composer-queue-btn"]').exists()).toBe(false)

    // User types next prompt into textarea
    const textarea = wrapper.find('textarea')
    await textarea.setValue('این پیام دوم است که باید در صف قرار گیرد')

    // Queue button is now visible
    const queueBtn = wrapper.find('[data-testid="composer-queue-btn"]')
    expect(queueBtn.exists()).toBe(true)

    // Click the queue button (or hit Enter)
    await queueBtn.trigger('click')

    // Textarea is cleared
    expect((textarea.element as HTMLTextAreaElement).value).toBe('')

    // Feedback toast shown
    expect(toastSpy).toHaveBeenCalledWith('پیام به صف ارسال اضافه شد', 'info')

    // Chat store has 1 message in queue for this conversation
    const queuedList = chatStore.currentQueuedMessages
    expect(queuedList.length).toBe(1)
    expect(queuedList[0].content).toBe('این پیام دوم است که باید در صف قرار گیرد')
    expect(queuedList[0].conversationId).toBe('conv-test-1')

    // Queued Message card is now rendered in DOM
    await wrapper.vm.$nextTick()
    const queueContainer = wrapper.find('[data-testid="queued-messages-container"]')
    expect(queueContainer.exists()).toBe(true)
    expect(queueContainer.text()).toContain('پیام در صف ارسال')
    expect(queueContainer.text()).toContain('این پیام دوم است که باید در صف قرار گیرد')
  })

  it('2. Editing a queued message removes it from queue and restores it into the composer textarea', async () => {
    const wrapper = mount(ChatComposer)
    const chatStore = useChatStore()

    chatStore.currentConversationId = 'conv-test-2'
    chatStore.addToQueue('پیامی برای ویرایش', undefined, { useWebSearch: true }, 'conv-test-2')

    await wrapper.vm.$nextTick()

    const queueCard = wrapper.find('[data-testid="queued-messages-container"]')
    expect(queueCard.exists()).toBe(true)
    expect(queueCard.text()).toContain('پیامی برای ویرایش')

    // Click Edit button
    const editBtn = wrapper.find('[data-testid="queued-edit-btn"]')
    expect(editBtn.exists()).toBe(true)
    await editBtn.trigger('click')

    // Queue should now be empty
    expect(chatStore.currentQueuedMessages.length).toBe(0)

    // Textarea has the restored content
    const textarea = wrapper.find('textarea')
    expect((textarea.element as HTMLTextAreaElement).value).toBe('پیامی برای ویرایش')

    // Flag for web search restored
    expect(chatStore.getConvFlag('conv-test-2').web).toBe(true)
  })

  it('3. Cancelling a queued message removes it from queue and shows toast', async () => {
    const wrapper = mount(ChatComposer)
    const chatStore = useChatStore()
    const uiStore = useUiStore()
    const toastSpy = vi.spyOn(uiStore, 'showToast')

    chatStore.currentConversationId = 'conv-test-3'
    chatStore.addToQueue('پیام حذفی', undefined, undefined, 'conv-test-3')

    await wrapper.vm.$nextTick()

    const deleteBtn = wrapper.find('[data-testid="queued-delete-btn"]')
    expect(deleteBtn.exists()).toBe(true)
    await deleteBtn.trigger('click')

    expect(chatStore.currentQueuedMessages.length).toBe(0)
    expect(toastSpy).toHaveBeenCalledWith('پیام از صف حذف شد', 'info')

    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="queued-messages-container"]').exists()).toBe(false)
  })

  it('4. Automatically dequeues and sends next message when current stream finishes (finishStream)', async () => {
    vi.useFakeTimers()
    const chatStore = useChatStore()
    chatStore.currentConversationId = 'conv-test-4'

    // Stream currently running
    chatStore.convStreamStates.set('conv-test-4', {
      isStreaming: true,
      isThinking: false,
      streamError: null,
      currentStreamingText: 'تولید پاسخ اول...',
      abortController: new AbortController(),
      watchdogTimer: null,
      lastUserPrompt: 'پیام ۱',
      charBuffer: [],
      releaseTimer: null,
      pendingSources: null,
      isSearching: false,
      searchFailed: false,
      currentReasoning: '',
      isActivelyThinking: false,
      thinkingDurationMs: null,
    })

    // Add queued prompt
    chatStore.addToQueue('پیام در صف که باید بعد از پایان ارسال شود', undefined, undefined, 'conv-test-4')
    expect(chatStore.getQueuedMessages('conv-test-4').length).toBe(1)

    // Stream completes
    chatStore.finishStream('conv-test-4', 'msg-reply-1')

    // Advance async timers for auto-dequeue
    await vi.advanceTimersByTimeAsync(200)

    // Queued message was shifted
    expect(chatStore.getQueuedMessages('conv-test-4').length).toBe(0)

    // Observable result: user message added to chatStore.messages
    expect(chatStore.messages.some((m) => m.content === 'پیام در صف که باید بعد از پایان ارسال شود')).toBe(true)

    // Observable result: chatService.sendMessageStream was called
    expect(chatService.sendMessageStream).toHaveBeenCalledWith(
      'conv-test-4',
      'پیام در صف که باید بعد از پایان ارسال شود',
      expect.any(Function),
      expect.any(Function),
      expect.any(Function),
      expect.any(Object),
      expect.any(Function),
      expect.any(Function),
      undefined,
      expect.any(Function),
      expect.any(Function),
      expect.any(Function),
      expect.any(Object),
      expect.any(Function),
      expect.any(Function)
    )

    vi.useRealTimers()
  })

  it('5. Stopping stream manually (stopStreaming) automatically triggers next queued message', async () => {
    vi.useFakeTimers()
    const chatStore = useChatStore()
    chatStore.currentConversationId = 'conv-test-5'

    chatStore.convStreamStates.set('conv-test-5', {
      isStreaming: true,
      isThinking: false,
      streamError: null,
      currentStreamingText: 'پاسخ طولانی...',
      abortController: new AbortController(),
      watchdogTimer: null,
      lastUserPrompt: 'سؤال اولیه',
      charBuffer: [],
      releaseTimer: null,
      pendingSources: null,
      isSearching: false,
      searchFailed: false,
      currentReasoning: '',
      isActivelyThinking: false,
      thinkingDurationMs: null,
    })

    chatStore.addToQueue('سؤال بعدی پس از توقف پاسخ قبلی', undefined, undefined, 'conv-test-5')

    // User stops stream
    chatStore.stopStreaming()

    await vi.advanceTimersByTimeAsync(200)

    expect(chatStore.getQueuedMessages('conv-test-5').length).toBe(0)
    expect(chatStore.messages.some((m) => m.content === 'سؤال بعدی پس از توقف پاسخ قبلی')).toBe(true)
    expect(chatService.sendMessageStream).toHaveBeenCalledWith(
      'conv-test-5',
      'سؤال بعدی پس از توقف پاسخ قبلی',
      expect.any(Function),
      expect.any(Function),
      expect.any(Function),
      expect.any(Object),
      expect.any(Function),
      expect.any(Function),
      undefined,
      expect.any(Function),
      expect.any(Function),
      expect.any(Function),
      expect.any(Object),
      expect.any(Function),
      expect.any(Function)
    )

    vi.useRealTimers()
  })

  it('6. Multiple queued messages follow FIFO (first in, first out) order', () => {
    const chatStore = useChatStore()
    const convId = 'conv-test-fifo'

    chatStore.addToQueue('پیام الف', undefined, undefined, convId)
    chatStore.addToQueue('پیام ب', undefined, undefined, convId)
    chatStore.addToQueue('پیام ج', undefined, undefined, convId)

    const list = chatStore.getQueuedMessages(convId)
    expect(list.length).toBe(3)
    expect(list[0].content).toBe('پیام الف')
    expect(list[1].content).toBe('پیام ب')
    expect(list[2].content).toBe('پیام ج')
  })

  it('7. Conversation isolation: Queued messages in Conv A do not appear in Conv B', () => {
    const chatStore = useChatStore()

    chatStore.addToQueue('پیام در گفتگوی یک', undefined, undefined, 'conv-A')
    chatStore.addToQueue('پیام در گفتگوی دو', undefined, undefined, 'conv-B')

    chatStore.currentConversationId = 'conv-A'
    expect(chatStore.currentQueuedMessages.length).toBe(1)
    expect(chatStore.currentQueuedMessages[0].content).toBe('پیام در گفتگوی یک')

    chatStore.currentConversationId = 'conv-B'
    expect(chatStore.currentQueuedMessages.length).toBe(1)
    expect(chatStore.currentQueuedMessages[0].content).toBe('پیام در گفتگوی دو')
  })

  it('8. Persistence across page refresh: queued messages survive in localStorage and re-hydrate', () => {
    const chatStore = useChatStore()
    chatStore.addToQueue('پیام مهم قبل از رفرش', undefined, undefined, 'conv-persist-1')

    // Verify localStorage has the queued item
    const raw = localStorage.getItem('chat_queued_messages')
    expect(raw).toBeTruthy()
    expect(raw).toContain('پیام مهم قبل از رفرش')

    // Simulate page refresh by resetting Pinia and re-instantiating the store
    setActivePinia(createPinia())
    const freshStore = useChatStore()
    freshStore.currentConversationId = 'conv-persist-1'

    expect(freshStore.currentQueuedMessages.length).toBe(1)
    expect(freshStore.currentQueuedMessages[0].content).toBe('پیام مهم قبل از رفرش')
  })

  it('9. Error state preservation: queued message is NOT discarded when stream errors out', async () => {
    vi.useFakeTimers()
    const chatStore = useChatStore()
    chatStore.currentConversationId = 'conv-err-test'

    // Stream running
    chatStore.convStreamStates.set('conv-err-test', {
      isStreaming: true,
      isThinking: false,
      streamError: null,
      currentStreamingText: 'پاسخ ناقص...',
      abortController: new AbortController(),
      watchdogTimer: null,
      lastUserPrompt: 'درخواست اول',
      charBuffer: [],
      releaseTimer: null,
      pendingSources: null,
      isSearching: false,
      searchFailed: false,
      currentReasoning: '',
      isActivelyThinking: false,
      thinkingDurationMs: null,
    })

    chatStore.addToQueue('پیامی که در زمان خطا نباید حذف شود', undefined, undefined, 'conv-err-test')

    // Stream fails with error
    const s = chatStore.convStreamStates.get('conv-err-test')!
    s.isStreaming = false
    s.streamError = 'زمان انتظار به پایان رسید'
    chatStore.convStreamStates.set('conv-err-test', { ...s })

    // Finish stream with error
    chatStore.finishStream('conv-err-test', 'msg-err-1', true)

    await vi.advanceTimersByTimeAsync(200)

    // Message MUST still be in the queue, not dropped or lost!
    expect(chatStore.getQueuedMessages('conv-err-test').length).toBe(1)
    expect(chatStore.getQueuedMessages('conv-err-test')[0].content).toBe('پیامی که در زمان خطا نباید حذف شود')

    vi.useRealTimers()
  })
})
