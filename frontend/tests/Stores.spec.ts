import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useChatStore } from '../src/stores/chat'
import { useModelsStore } from '../src/stores/models'
import { useUiStore } from '../src/stores/ui'

describe('Pinia Stores', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('chatStore: creates new conversation and switches active id', async () => {
    const chatStore = useChatStore()
    const initialCount = chatStore.conversations.length

    const newId = await chatStore.createNewConversation('تست آزمایشی')
    // New conversations stay off the sidebar until the assistant responds,
    // so an empty chat should not appear in the list yet.
    expect(chatStore.conversations.length).toBe(initialCount)
    expect(chatStore.currentConversationId).toBe(newId)
    expect(chatStore.messages.length).toBe(0)

    // Sending a message alone does not add the conversation either — only
    // the first token from the assistant (handled inside sendMessageStream's
    // onToken callback) joins it to the sidebar. In this test there is no
    // backend, so the conv stays off the list.
    await chatStore.sendMessage('سلام')
    expect(chatStore.conversations.length).toBe(initialCount)
    expect(chatStore.messages.length).toBe(1)
  })

  it('modelsStore: can select active model and make default', async () => {
    const modelsStore = useModelsStore()
    expect(modelsStore.models.length).toBeGreaterThan(0)

    const targetModel = modelsStore.models[1]
    modelsStore.selectModel(targetModel.id)
    expect(modelsStore.selectedModelId).toBe(targetModel.id)

    await modelsStore.makeDefault(targetModel.id)
    expect(modelsStore.defaultModel.id).toBe(targetModel.id)
  })

  it('uiStore: maintains strictly Persian RTL direction and ignores direction toggle', () => {
    const uiStore = useUiStore()
    expect(uiStore.direction).toBe('rtl')

    uiStore.toggleDirection()
    expect(uiStore.direction).toBe('rtl')
  })

  it('uiStore: showToast caps maximum visible toasts to 2 and prevents duplicate spam', () => {
    const uiStore = useUiStore()
    uiStore.toasts = []

    uiStore.showToast('پیام ۱', 'info')
    uiStore.showToast('پیام ۲', 'warning')
    expect(uiStore.toasts.length).toBe(2)

    // Adding 3rd toast should shift out the oldest, keeping max 2
    uiStore.showToast('پیام ۳', 'error')
    expect(uiStore.toasts.length).toBe(2)
    expect(uiStore.toasts.map((t) => t.message)).toEqual(['پیام ۲', 'پیام ۳'])

    // Adding exact duplicate should not create additional toast
    uiStore.showToast('پیام ۳', 'error')
    expect(uiStore.toasts.length).toBe(2)
  })
})

