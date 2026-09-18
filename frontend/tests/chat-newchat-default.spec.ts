import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('../src/services/chat.service', () => ({
  chatService: {
    createConversation: vi.fn(async (modelId: string, title: string) => ({
      id: 'srv-1',
      modelId,
      title,
    })),
  },
}))

import { useChatStore } from '../src/stores/chat'
import { useModelsStore } from '../src/stores/models'
import { chatService } from '../src/services/chat.service'

describe('new chats follow the platform default', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    vi.clearAllMocks()
  })

  function seedModels() {
    const modelsStore = useModelsStore()
    modelsStore.models = [
      { id: 'x-old', name: 'Old', provider: 'p', apiIdentifier: 'x', isActive: true, isDefault: false, createdAt: new Date().toISOString() },
      { id: 'd1', name: 'Def', provider: 'p', apiIdentifier: 'y', isActive: true, isDefault: true, createdAt: new Date().toISOString() },
    ] as any
    modelsStore.selectedModelId = 'x-old'
    vi.spyOn(modelsStore, 'fetchModels').mockResolvedValue(undefined)
    return modelsStore
  }

  it('creates the conversation with the default model, not the leftover selection', async () => {
    const modelsStore = seedModels()
    const chatStore = useChatStore()
    const id = await chatStore.createNewConversation()
    expect(id).toBe('srv-1')
    expect(chatService.createConversation).toHaveBeenCalledWith('d1', expect.anything())
    expect(modelsStore.selectedModelId).toBe('d1')
  })

  it('prefers the dedicated default endpoint and syncs local flags', async () => {
    const modelsStore = seedModels()
    modelsStore.selectedModelId = 'x-old'
    const { modelsService } = await import('../src/services/models.service')
    vi.spyOn(modelsService, 'getDefaultModel').mockResolvedValue({
      id: 'd9',
      name: 'Fresh Default',
      provider: 'p',
      apiIdentifier: 'fresh',
      isActive: true,
      isDefault: true,
      createdAt: new Date().toISOString(),
    } as any)
    // fresh default not in the local list yet → triggers a list refetch
    const fetchSpy = vi.spyOn(modelsStore, 'fetchModels').mockImplementation(async () => {
      modelsStore.models = [
        ...(modelsStore.models as any[]),
        { id: 'd9', name: 'Fresh Default', provider: 'p', apiIdentifier: 'fresh', isActive: true, isDefault: true, createdAt: new Date().toISOString() },
      ] as any
    })
    const chatStore = useChatStore()
    await chatStore.createNewConversation()
    expect(fetchSpy).toHaveBeenCalled()
    expect(chatService.createConversation).toHaveBeenCalledWith('d9', expect.anything())
    expect(modelsStore.selectedModelId).toBe('d9')
    expect(modelsStore.models.find((m) => m.id === 'd1')?.isDefault).toBe(false)
  })
})
