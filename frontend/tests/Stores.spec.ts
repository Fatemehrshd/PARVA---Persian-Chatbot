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
    expect(chatStore.conversations.length).toBe(initialCount + 1)
    expect(chatStore.currentConversationId).toBe(newId)
    expect(chatStore.messages.length).toBe(0)

    await chatStore.updateConversationTitle(newId, 'عنوان جدید تست')
    const updated = chatStore.conversations.find((c) => c.id === newId)
    expect(updated?.title).toBe('عنوان جدید تست')

    await chatStore.deleteConversation(newId)
    expect(chatStore.conversations.some((c) => c.id === newId)).toBe(false)
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

  it('uiStore: toggles direction between RTL and LTR', () => {
    const uiStore = useUiStore()
    const startDir = uiStore.direction

    uiStore.toggleDirection()
    expect(uiStore.direction).not.toBe(startDir)

    uiStore.toggleDirection()
    expect(uiStore.direction).toBe(startDir)
  })
})
