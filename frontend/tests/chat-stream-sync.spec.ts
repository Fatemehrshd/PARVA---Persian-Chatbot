import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useChatStore } from '../src/stores/chat'
import { chatService } from '../src/services/chat.service'

vi.mock('../src/services/api', () => ({
  checkBackendHealth: vi.fn().mockResolvedValue(true),
  request: vi.fn(),
  buildUrl: vi.fn((path) => path),
}))

describe('Chat Stream Synchronization & No-Dump', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    sessionStorage.clear()
  })

  it('updates currentStreamingText in real-time as tokens arrive without queue lag or sudden end dump', async () => {
    const chatStore = useChatStore()

    // Simulate sending 20 long tokens from backend
    const incomingTokens = [
      'در ', 'پاسخ ', 'به ', 'درخواست ', 'شما، ',
      'این ', 'یک ', 'متن ', 'بسیار ', 'طولانی ',
      'جهت ', 'بررسی ', 'همگام‌سازی ', 'کامل ', 'استریمینگ ',
      'با ', 'بک‌اند ', 'می‌باشد. ', 'پایان ', 'پیام.'
    ]

    let tokenCallback: (token: string) => void = () => {}
    let doneCallback: (id: string) => void = () => {}

    vi.spyOn(chatService, 'sendMessageStream').mockImplementation(
      async (_id, _content, onToken, onDone) => {
        tokenCallback = onToken
        doneCallback = onDone
      }
    )

    chatStore.currentConversationId = 'conv-sync-test'
    chatStore.conversations = [
      { id: 'conv-sync-test', title: 'Test Conv', createdAt: '', updatedAt: '' }
    ]

    await chatStore.sendMessage('تست متن طولانی')

    // Feed tokens one by one and assert currentStreamingText stays in 100% sync
    let expectedAccumulated = ''
    for (const token of incomingTokens) {
      tokenCallback(token)
      expectedAccumulated += token
      expect(chatStore.currentStreamingText).toBe(expectedAccumulated)
    }

    // When backend finishes and sends done, currentStreamingText already matches exactly
    const textBeforeDone = chatStore.currentStreamingText
    expect(textBeforeDone).toBe(expectedAccumulated)

    // Complete stream
    doneCallback('msg-final-1')

    // Message is saved to history with exact full content and stream is cleanly finished
    expect(chatStore.isStreaming).toBe(false)
    expect(chatStore.currentStreamingText).toBe('')
    const savedMsg = chatStore.messages.find((m) => m.id === 'msg-final-1')
    expect(savedMsg).toBeDefined()
    expect(savedMsg?.content).toBe(expectedAccumulated)
  })
})
