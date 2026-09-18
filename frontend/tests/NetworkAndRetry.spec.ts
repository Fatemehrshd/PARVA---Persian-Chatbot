import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import NetworkStatusBanner from '../src/components/chat/NetworkStatusBanner.vue'
import { useUiStore } from '../src/stores/ui'
import { useChatStore } from '../src/stores/chat'
import { useFileUpload } from '../src/composables/useFileUpload'

vi.mock('../src/services/chat.service', () => ({
  chatService: {
    listConversations: vi.fn().mockResolvedValue([]),
    getMessages: vi.fn().mockResolvedValue([]),
    sendMessageStream: vi.fn().mockImplementation((id, content, onToken, onDone) => {
      onToken('chunk1')
      onDone('msg-done-123')
      return Promise.resolve()
    })
  }
}))

vi.mock('../src/services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/services/api')>()
  return {
    ...actual,
    checkBackendHealth: vi.fn().mockResolvedValue(true)
  }
})

describe('Network Resilience and Recovery Actions', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('NetworkStatusBanner shows offline indicator when offline and hides when online', async () => {
    const uiStore = useUiStore()
    uiStore.setOnline(true)

    const wrapper = mount(NetworkStatusBanner)
    expect(wrapper.find('.network-banner').exists()).toBe(false)

    uiStore.setOnline(false)
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.network-banner').exists()).toBe(true)
    expect(wrapper.text()).toContain('اتصال شما به اینترنت قطع است')
  })

  it('chatStore records lastUserPrompt and exposes retryLastMessage', async () => {
    const chatStore = useChatStore()
    chatStore.currentConversationId = 'conv-1'

    await chatStore.sendMessage('Hello PARVA')
    expect(chatStore.lastUserPrompt).toBe('Hello PARVA')
    expect(typeof chatStore.retryLastMessage).toBe('function')
    expect(typeof chatStore.continueLastMessage).toBe('function')
  })

  it('stopStreaming interrupts active stream and saves partial text with isInterrupted flag', () => {
    const chatStore = useChatStore()
    chatStore.currentConversationId = 'conv-1'
    // Set streaming state via the Map (isStreaming/currentStreamingText are computed)
    chatStore.convStreamStates.set('conv-1', {
      isStreaming: true,
      isThinking: false,
      streamError: null,
      currentStreamingText: 'این یک پاسخ نیمه...',
      abortController: null,
      watchdogTimer: null,
      lastUserPrompt: '',
      charBuffer: [],
      releaseTimer: null
    })

    chatStore.stopStreaming()

    expect(chatStore.isStreaming).toBe(false)
    expect(chatStore.currentStreamingText).toBe('')
    expect(chatStore.messages.length).toBe(1)
    expect(chatStore.messages[0].content).toBe('این یک پاسخ نیمه...')
    expect(chatStore.messages[0].isInterrupted).toBe(true)
  })

  it('marks user message as error and shows streamError without adding fake assistant message when health check fails', async () => {
    const { checkBackendHealth } = await import('../src/services/api')
    vi.mocked(checkBackendHealth).mockResolvedValueOnce(false)

    const chatStore = useChatStore()
    chatStore.currentConversationId = 'conv-fail'

    await chatStore.sendMessage('Message that should fail health check')

    expect(chatStore.streamError).toBe('خطا در برقراری ارتباط')
    expect(chatStore.messages.length).toBe(1)
    expect(chatStore.messages[0].role).toBe('user')
    expect(chatStore.messages[0].status).toBe('error')
    // Ensure no fake assistant error message was added to chat history
    expect(chatStore.messages.some((m) => m.role === 'assistant')).toBe(false)
  })

  it('selectConversation clears transient streamError', () => {
    const chatStore = useChatStore()
    chatStore.currentConversationId = 'conv-with-err'
    chatStore.convStreamStates.set('conv-with-err', {
      isStreaming: false, isThinking: false,
      streamError: 'خطا در برقراری ارتباط',
      currentStreamingText: '', abortController: null, watchdogTimer: null, lastUserPrompt: '',
      charBuffer: [], releaseTimer: null
    })

    chatStore.selectConversation('conv-new')
    expect(chatStore.streamError).toBeNull()
  })

  it('preserves loading and thinking state on page refresh when active stream was saved', async () => {
    sessionStorage.setItem('active_streaming_conv', 'conv-refresh')

    const chatStore = useChatStore()
    await chatStore.selectConversation('conv-refresh')

    expect(chatStore.isStreaming).toBe(true)
    expect(chatStore.isThinking).toBe(true)

    sessionStorage.removeItem('active_streaming_conv')
  })

  it('retryLastMessage succeeds even when lastUserPrompt is empty by recovering from conversation messages', async () => {
    const chatStore = useChatStore()
    chatStore.currentConversationId = 'conv-retry-fallback'
    // lastUserPrompt/streamError/isStreaming are all computed from the Map
    chatStore.convStreamStates.set('conv-retry-fallback', {
      isStreaming: false, isThinking: false,
      streamError: 'زمان انتظار برای دریافت پاسخ به پایان رسید (تایم‌اوت)',
      currentStreamingText: '', abortController: null, watchdogTimer: null,
      lastUserPrompt: '', // empty, e.g. after full page reload
      charBuffer: [], releaseTimer: null
    })
    chatStore.messages = [
      {
        id: 'msg-prev-user',
        conversationId: 'conv-retry-fallback',
        role: 'user',
        content: 'تست بازیابی پرامپت در صورت خالی بودن',
        createdAt: new Date().toISOString(),
        status: 'error'
      }
    ]

    await chatStore.retryLastMessage()

    expect(chatStore.streamError).toBeNull()
    expect(chatStore.lastUserPrompt).toBe('تست بازیابی پرامپت در صورت خالی بودن')
    expect(chatStore.messages.length).toBe(2)
    expect(chatStore.messages[0].role).toBe('user')
    expect(chatStore.messages[0].content).toBe('تست بازیابی پرامپت در صورت خالی بودن')
    expect(chatStore.messages[1].role).toBe('assistant')
    expect(chatStore.messages[1].content).toBe('chunk1')
  })

  it('retries a failed upload by re-sending the original file when the server has not yet assigned an ID', async () => {
    const { filesService } = await import('../src/services/files.service')
    const uploadSpy = vi.spyOn(filesService, 'uploadFile')
    uploadSpy.mockImplementation(async () => ({
      id: 'file-1',
      originalName: 'note.txt',
      mimeType: 'text/plain',
      fileType: 'text',
      fileSize: 12,
      status: 'processing',
      progress: 100,
    } as any))

    const { attachedFiles, addFiles, retryFile } = useFileUpload(() => 'conv-upload-retry')
    const file = new File(['hello'], 'note.txt', { type: 'text/plain' })

    await addFiles([file])
    const item = attachedFiles.value[0]
    item.status = 'error'
    item.errorMessage = 'خطا در آپلود فایل'
    item.id = 'temp-upload-retry'
    item.rawFile = file

    await retryFile(item)

    expect(uploadSpy).toHaveBeenCalledTimes(2)
    expect(attachedFiles.value[0].status).toBe('processing')
  })
})



