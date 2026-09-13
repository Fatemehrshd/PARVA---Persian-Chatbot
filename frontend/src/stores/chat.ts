import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Conversation, Message } from '../types'
import { chatService } from '../services/chat.service'
import { useModelsStore } from './models'

export const useChatStore = defineStore('chat', () => {
  const modelsStore = useModelsStore()

  const sampleConversations: Conversation[] = [
    {
      id: 'c-1',
      title: 'خوش‌آمدگویی به پلتفرم هوش مصنوعی',
      modelId: 'm-1',
      createdAt: new Date(Date.now() - 3600000).toISOString(),
      updatedAt: new Date(Date.now() - 3600000).toISOString()
    }
  ]

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

  const conversations = ref<Conversation[]>(sampleConversations)
  const currentConversationId = ref<string | null>('c-1')
  const messages = ref<Message[]>(sampleMessages['c-1'] || [])
  const isStreaming = ref(false)
  const isThinking = ref(false)
  const currentStreamingText = ref('')

  const activeConversation = computed(() =>
    conversations.value.find((c) => c.id === currentConversationId.value)
  )

  async function loadConversations() {
    try {
      const data = await chatService.listConversations()
      if (Array.isArray(data) && data.length > 0) {
        conversations.value = data
        if (!currentConversationId.value) {
          selectConversation(data[0].id)
        }
      }
    } catch {
      // Keep sample conversations
    }
  }

  async function selectConversation(id: string) {
    currentConversationId.value = id
    isStreaming.value = false
    isThinking.value = false
    currentStreamingText.value = ''

    try {
      const data = await chatService.getMessages(id)
      if (Array.isArray(data)) {
        messages.value = data
        return
      }
    } catch {
      // fallback
    }

    messages.value = sampleMessages[id] || []
  }

  async function createNewConversation(title = 'گفتگوی جدید'): Promise<string> {
    const modelId = modelsStore.selectedModelId
    try {
      const created = await chatService.createConversation(modelId, title)
      conversations.value.unshift(created)
      currentConversationId.value = created.id
      messages.value = []
      return created.id
    } catch {
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
  }

  function deleteConversation(id: string) {
    conversations.value = conversations.value.filter((c) => c.id !== id)
    delete sampleMessages[id]
    if (currentConversationId.value === id) {
      if (conversations.value.length > 0) {
        selectConversation(conversations.value[0].id)
      } else {
        createNewConversation()
      }
    }
  }

  async function sendMessage(content: string) {
    if (!content.trim() || isStreaming.value) return

    if (!currentConversationId.value) {
      await createNewConversation()
    }

    const convId = currentConversationId.value!

    // Add user message
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

    // Prepare assistant response
    isThinking.value = true
    isStreaming.value = true
    currentStreamingText.value = ''

    let streamedAny = false

    await chatService.sendMessageStream(
      convId,
      content,
      (token: string) => {
        isThinking.value = false
        streamedAny = true
        currentStreamingText.value += token
      },
      (messageId: string) => {
        finishStream(messageId)
      },
      async (_err: any) => {
        if (!streamedAny) {
          // Graceful simulated streaming for offline UI preview
          await simulateResponse(convId, content)
        } else {
          finishStream(`msg-${Date.now()}`)
        }
      }
    )
  }

  function finishStream(messageId: string) {
    if (currentStreamingText.value) {
      messages.value.push({
        id: messageId,
        conversationId: currentConversationId.value!,
        role: 'assistant',
        content: currentStreamingText.value,
        createdAt: new Date().toISOString()
      })
    }
    currentStreamingText.value = ''
    isStreaming.value = false
    isThinking.value = false
  }

  async function simulateResponse(_convId: string, userPrompt: string) {
    await new Promise((resolve) => setTimeout(resolve, 600))
    isThinking.value = false

    const responseText = `درخواست شما دریافت شد: "${userPrompt}"\n\nاین یک پاسخ نمونه هوشمند از پلتفرم **NeuralChat** است. رابط کاربری به‌صورت زنده طراحی شده و با استانداردهای مدرن وب، پشتیبانی از RTL، و جریان داده‌های توکن‌به‌توکن (Streaming) تطابق دارد.`

    const chunks = responseText.split(/(?<=[ \n،.])/g)
    for (const chunk of chunks) {
      currentStreamingText.value += chunk
      await new Promise((resolve) => setTimeout(resolve, 40))
    }

    finishStream(`msg-${Date.now()}`)
  }

  function stopStreaming() {
    if (isStreaming.value && currentStreamingText.value) {
      finishStream(`msg-${Date.now()}`)
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
    loadConversations,
    selectConversation,
    createNewConversation,
    deleteConversation,
    sendMessage,
    stopStreaming
  }
})
