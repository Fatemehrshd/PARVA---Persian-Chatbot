import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Conversation, Message } from '../types'
import { chatService } from '../services/chat.service'
import { useModelsStore } from './models'
import { useUiStore } from './ui'

export const useChatStore = defineStore('chat', () => {
  const modelsStore = useModelsStore()
  const uiStore = useUiStore()

  const sampleMessages: Record<string, Message[]> = {
    'c-1': [
      {
        id: 'msg-1',
        conversationId: 'c-1',
        role: 'assistant',
        content: 'سلام! من دستیار هوشمند شما در پلتفرم NeuralChat هستم. چگونه می‌توانم به شما کمک کنم؟',
        createdAt: new Date(Date.now() - 3600000).toISOString()
      }
    ]
  }

  const conversations = ref<Conversation[]>([])
  const currentConversationId = ref<string | null>(null)
  const messages = ref<Message[]>([])
  const isStreaming = ref(false)
  const isThinking = ref(false)
  const currentStreamingText = ref('')
  const lastUserPrompt = ref('')
  let currentAbortController: AbortController | null = null

  const activeConversation = computed(() =>
    conversations.value.find((c) => c.id === currentConversationId.value)
  )

  async function loadConversations(targetId?: string) {
    try {
      const data = await chatService.listConversations()
      if (Array.isArray(data)) {
        conversations.value = data
        if (data.length > 0) {
          let idToSelect: string = data[0].id
          if (targetId && data.some((c) => c.id === targetId)) {
            idToSelect = targetId
          } else if (!targetId && currentConversationId.value && data.some((c) => c.id === currentConversationId.value)) {
            idToSelect = currentConversationId.value
          } else if (targetId) {
            idToSelect = targetId
          }
          await selectConversation(idToSelect)
        } else {
          conversations.value = []
          if (targetId) {
            await selectConversation(targetId)
          } else {
            currentConversationId.value = null
            messages.value = []
          }
        }
        return
      }
    } catch (err) {
      console.warn('Backend listConversations failed:', err)
    }
    if (targetId) {
      await selectConversation(targetId)
    } else if (conversations.value.length === 0) {
      currentConversationId.value = null
      messages.value = []
    }
  }

  async function selectConversation(id: string) {
    if (!id) return
    if (isStreaming.value) {
      stopStreaming()
    }
    currentConversationId.value = id
    isStreaming.value = false
    isThinking.value = false
    currentStreamingText.value = ''

    const conv = conversations.value.find((c) => c.id === id)
    if (conv?.modelId) {
      modelsStore.selectModel(conv.modelId)
    }

    try {
      const data = await chatService.getMessages(id)
      if (Array.isArray(data)) {
        messages.value = data
        return
      }
    } catch (err) {
      console.warn('Backend getMessages failed:', err)
    }

    messages.value = sampleMessages[id] || []
    messages.value = []
  }

  async function switchConversationModel(modelId: string) {
    modelsStore.selectModel(modelId)
    const conv = activeConversation.value
    if (conv) {
      conv.modelId = modelId
    }
    if (currentConversationId.value && !currentConversationId.value.startsWith('c-')) {
      try {
        await chatService.setModel(currentConversationId.value, modelId)
      } catch (err) {
        console.warn('Backend setModel failed:', err)
        throw err
      }
    }
  }

  async function createNewConversation(title = 'گفتگوی جدید'): Promise<string> {
    if (isStreaming.value) {
      stopStreaming()
    }
    const modelId = modelsStore.selectedModel?.id || modelsStore.selectedModelId
    try {
      const created = await chatService.createConversation(modelId, title)
      if (created && created.id) {
        conversations.value.unshift(created)
        currentConversationId.value = created.id
        if (created.modelId) {
          modelsStore.selectModel(created.modelId)
        }
        messages.value = []
        return created.id
      }
    } catch (err) {
      console.warn('Backend createConversation failed, falling back to local ID:', err)
    }
    const newConv: Conversation = {
      id: `c-${Date.now()}`,
      title,
      modelId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    conversations.value.unshift(newConv)
    currentConversationId.value = newConv.id
    messages.value = []
    return newConv.id
  }

  async function deleteConversation(id: string) {
    try {
      await chatService.deleteConversation(id)
    } catch (err: any) {
      console.warn('Backend deleteConversation failed:', err)
    }
    conversations.value = conversations.value.filter((c) => c.id !== id)
    delete sampleMessages[id]
    if (currentConversationId.value === id) {
      if (conversations.value.length > 0) {
        await selectConversation(conversations.value[0].id)
      } else {
        currentConversationId.value = null
        messages.value = []
      }
    }
  }

  async function updateConversationTitle(id: string, newTitle: string) {
    const trimmed = newTitle.trim()
    if (!trimmed) return
    const conv = conversations.value.find((c) => c.id === id)
    if (conv) {
      conv.title = trimmed
    }
    try {
      await chatService.updateConversation(id, trimmed)
    } catch (err: any) {
      console.warn('Backend updateConversation failed:', err)
    }
  }

  async function sendMessage(content: string) {
    if (!content.trim() || isStreaming.value) return

    if (!currentConversationId.value) {
      const tempId = `c-${Date.now()}`
      const modelId = modelsStore.selectedModel?.id || modelsStore.selectedModelId
      const newConv: Conversation = {
        id: tempId,
        title: content.slice(0, 30),
        modelId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      conversations.value.unshift(newConv)
      currentConversationId.value = tempId
    }

    let convId = currentConversationId.value!

    // Add user message immediately
    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      conversationId: convId,
      role: 'user',
      content: content.trim(),
      createdAt: new Date().toISOString()
    }
    messages.value.push(userMessage)

    // Update conversation title if it's the first user message
    const conv = conversations.value.find((c) => c.id === convId)
    if (conv && (conv.title === 'گفتگوی جدید' || conv.title === 'New Chat')) {
      conv.title = content.slice(0, 30) + (content.length > 30 ? '...' : '')
    }

    // If conversation is a local placeholder (starts with 'c-'), persist it to backend
    if (convId.startsWith('c-')) {
      try {
        const modelId = modelsStore.selectedModel?.id || modelsStore.selectedModelId
        const created = await chatService.createConversation(modelId, conv?.title || content.slice(0, 30))
        if (created && created.id) {
          if (conv) conv.id = created.id
          currentConversationId.value = created.id
          userMessage.conversationId = created.id
          convId = created.id
        }
      } catch (err) {
        console.warn('Could not persist conversation to backend before streaming:', err)
      }
    }

    // Track last prompt for retry capability
    lastUserPrompt.value = content

    // Prepare assistant response
    isThinking.value = true
    isStreaming.value = true
    currentStreamingText.value = ''

    let streamedAny = false

    if (currentAbortController) {
      currentAbortController.abort()
      currentAbortController = null
    }
    const abortCtrl = new AbortController()
    currentAbortController = abortCtrl

    await chatService.sendMessageStream(
      convId,
      content,
      (token: string) => {
        isThinking.value = false
        streamedAny = true
        currentStreamingText.value += token
      },
      (messageId: string) => {
        currentAbortController = null
        finishStream(messageId)
      },
      async (err: any) => {
        currentAbortController = null
        isThinking.value = false
        isStreaming.value = false
        const errorMessage =
          typeof err === 'string'
            ? err
            : (err?.message || 'خطا در برقراری ارتباط با سرور هوش مصنوعی')

        if (streamedAny) {
          finishStream(`msg-${Date.now()}`, true)
          uiStore.showToast(errorMessage, 'error')
        } else {
          messages.value.push({
            id: `msg-err-${Date.now()}`,
            conversationId: convId,
            role: 'assistant',
            content: `⚠️ **خطای برقراری ارتباط:** ${errorMessage}`,
            createdAt: new Date().toISOString(),
            isInterrupted: true
          })
          currentStreamingText.value = ''
          uiStore.showToast(errorMessage, 'error')
        }
      },
      abortCtrl.signal
    )
  }

  function finishStream(messageId: string, isInterrupted = false) {
    currentAbortController = null
    if (currentStreamingText.value) {
      messages.value.push({
        id: messageId,
        conversationId: currentConversationId.value!,
        role: 'assistant',
        content: currentStreamingText.value,
        createdAt: new Date().toISOString(),
        isInterrupted
      })
    }
    currentStreamingText.value = ''
    isStreaming.value = false
    isThinking.value = false
  }

  async function retryLastMessage() {
    if (!lastUserPrompt.value) return
    if (messages.value.length > 0 && messages.value[messages.value.length - 1].role === 'assistant') {
      const last = messages.value[messages.value.length - 1]
      if (last.isInterrupted || last.id.startsWith('msg-err-')) {
        messages.value.pop()
      }
    }
    if (messages.value.length > 0 && messages.value[messages.value.length - 1].role === 'user') {
      messages.value.pop()
    }
    await sendMessage(lastUserPrompt.value)
  }

  async function continueLastMessage() {
    const prompt = uiStore.direction === 'rtl' ? 'ادامه بده' : 'Please continue'
    await sendMessage(prompt)
  }

  function stopStreaming() {
    if (currentAbortController) {
      currentAbortController.abort()
      currentAbortController = null
    }
    if (isStreaming.value && currentStreamingText.value) {
      finishStream(`msg-${Date.now()}`, true)
    } else {
      isStreaming.value = false
      isThinking.value = false
    }
  }

  return {
    conversations,
    currentConversationId,
    activeConversation,
    messages,
    isStreaming,
    isThinking,
    currentStreamingText,
    lastUserPrompt,
    loadConversations,
    selectConversation,
    createNewConversation,
    deleteConversation,
    updateConversationTitle,
    switchConversationModel,
    sendMessage,
    retryLastMessage,
    continueLastMessage,
    stopStreaming
  }
})
