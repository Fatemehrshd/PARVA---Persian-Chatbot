import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Conversation, Message } from '../types'
import { chatService } from '../services/chat.service'
import { checkBackendHealth } from '../services/api'
import { useModelsStore } from './models'
import { useUiStore } from './ui'

// ─── Per-conversation streaming state ─────────────────────────────────────────
interface ConvStreamState {
  isStreaming: boolean
  isThinking: boolean
  streamError: string | null
  currentStreamingText: string
  abortController: AbortController | null
  watchdogTimer: ReturnType<typeof setTimeout> | null
  lastUserPrompt: string
}

function makeDefaultState(): ConvStreamState {
  return {
    isStreaming: false,
    isThinking: false,
    streamError: null,
    currentStreamingText: '',
    abortController: null,
    watchdogTimer: null,
    lastUserPrompt: '',
  }
}

export const useChatStore = defineStore('chat', () => {
  const modelsStore = useModelsStore()
  const uiStore = useUiStore()

  const sampleMessages: Record<string, Message[]> = {
    'c-1': [
      {
        id: 'msg-1',
        conversationId: 'c-1',
        role: 'assistant',
        content: 'سلام! من دستیار هوشمند شما در سامانه پروا هستم. چگونه می‌توانم به شما کمک کنم؟',
        createdAt: new Date(Date.now() - 3600000).toISOString()
      }
    ]
  }

  const conversations = ref<Conversation[]>([])
  const currentConversationId = ref<string | null>(null)
  const messages = ref<Message[]>([])

  // ─── Per-conversation stream state map ────────────────────────────────────
  // Using a Map so each conversation can have completely independent streaming state.
  // We wrap it in a ref<Map> so Vue can track mutations when we replace entries.
  const convStreamStates = ref<Map<string, ConvStreamState>>(new Map())

  // ─── Helper to get/init state for a convId ────────────────────────────────
  function getState(convId: string | null): ConvStreamState | null {
    if (!convId) return null
    if (!convStreamStates.value.has(convId)) {
      convStreamStates.value.set(convId, makeDefaultState())
    }
    return convStreamStates.value.get(convId)!
  }

  function ensureState(convId: string): ConvStreamState {
    if (!convStreamStates.value.has(convId)) {
      convStreamStates.value.set(convId, makeDefaultState())
    }
    return convStreamStates.value.get(convId)!
  }

  // ─── Backward-compatible computed aliases (used by ChatComposer, MessageList, etc.) ──
  const isStreaming = computed(() => getState(currentConversationId.value)?.isStreaming ?? false)
  const isThinking = computed(() => getState(currentConversationId.value)?.isThinking ?? false)
  const currentStreamingText = computed(() => getState(currentConversationId.value)?.currentStreamingText ?? '')
  const streamError = computed(() => getState(currentConversationId.value)?.streamError ?? null)
  const lastUserPrompt = computed(() => getState(currentConversationId.value)?.lastUserPrompt ?? '')

  // ─── Public helper: check if any specific conv is streaming (for sidebar) ─
  function getConvIsStreaming(convId: string): boolean {
    return convStreamStates.value.get(convId)?.isStreaming ?? false
  }

  // ─── Watchdog helpers (per conv) ──────────────────────────────────────────
  function resetWatchdog(convId: string, timeoutMs = 35000) {
    const state = ensureState(convId)
    if (state.watchdogTimer) {
      clearTimeout(state.watchdogTimer)
      state.watchdogTimer = null
    }
    state.watchdogTimer = setTimeout(() => {
      const s = convStreamStates.value.get(convId)
      if (s && s.isStreaming) {
        if (s.abortController) {
          try { s.abortController.abort() } catch {}
          s.abortController = null
        }
        s.isStreaming = false
        s.isThinking = false
        s.streamError = 'زمان انتظار برای دریافت پاسخ به پایان رسید (تایم‌اوت)'
        // Force reactivity — replace the map entry
        convStreamStates.value.set(convId, { ...s })
      }
    }, timeoutMs)
  }

  function clearWatchdog(convId: string) {
    const s = convStreamStates.value.get(convId)
    if (s?.watchdogTimer) {
      clearTimeout(s.watchdogTimer)
      s.watchdogTimer = null
    }
  }

  // ─── Computed ─────────────────────────────────────────────────────────────
  const activeConversation = computed(() =>
    conversations.value.find((c) => c.id === currentConversationId.value)
  )

  // ─── Load conversations ────────────────────────────────────────────────────
  async function loadConversations(targetId?: string) {
    const savedActive = sessionStorage.getItem('active_streaming_conv')
    if (savedActive && (!targetId || targetId === savedActive)) {
      targetId = savedActive
    }

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

  // ─── Select conversation ───────────────────────────────────────────────────
  // KEY CHANGE: We no longer stop background streaming when switching conversations.
  // Each conversation keeps its own streaming state in convStreamStates.
  async function selectConversation(id: string) {
    if (!id) return
    const savedActive = sessionStorage.getItem('active_streaming_conv')
    const isSavedStream = savedActive === id

    // Simply switch the active conversation — do NOT abort background streams
    currentConversationId.value = id

    // Initialize state for this conv if not already present
    const state = ensureState(id)

    // If this conversation was actively generating before page refresh, preserve loading state
    if (isSavedStream && !state.isStreaming) {
      state.isStreaming = true
      state.isThinking = true
      convStreamStates.value.set(id, { ...state })
      resetWatchdog(id, 35000)
    }

    // Clear error when switching to a conversation
    state.streamError = null
    convStreamStates.value.set(id, { ...state })

    const conv = conversations.value.find((c) => c.id === id)
    if (conv?.modelId) {
      modelsStore.selectModel(conv.modelId)
    }

    try {
      const data = await chatService.getMessages(id)
      if (Array.isArray(data)) {
        messages.value = data
      } else {
        messages.value = []
      }
    } catch (err) {
      console.warn('Backend getMessages failed:', err)
      messages.value = []
    }

    // Check if the last message is a pending user turn awaiting reply
    const lastMsg = messages.value[messages.value.length - 1]
    const hasPendingUserTurn = lastMsg && lastMsg.role === 'user'

    if (isSavedStream || hasPendingUserTurn) {
      const s = ensureState(id)
      s.isStreaming = true
      s.isThinking = true
      convStreamStates.value.set(id, { ...s })
      sessionStorage.setItem('active_streaming_conv', id)
      resetWatchdog(id, 35000)
    }

    // Check if there is an active background generation for this conv (e.g. after refresh)
    if (!id.startsWith('c-') && typeof chatService.getActiveStream === 'function') {
      try {
        const streamStatus = await chatService.getActiveStream(id)
        if (streamStatus && streamStatus.active) {
          const s = ensureState(id)
          s.isStreaming = true
          if (streamStatus.status === 'thinking' && !streamStatus.accumulatedText) {
            s.isThinking = true
            s.currentStreamingText = ''
          } else {
            s.isThinking = false
            s.currentStreamingText = streamStatus.accumulatedText || ''
          }
          convStreamStates.value.set(id, { ...s })
          if (streamStatus.title && conv) {
            conv.title = streamStatus.title
          }
          reconnectToActiveStream(id)
        } else {
          // Stream is no longer active on backend
          clearWatchdog(id)
          const s = ensureState(id)
          if (hasPendingUserTurn && !messages.value.some((m) => m.role === 'assistant' && new Date(m.createdAt) > new Date(lastMsg.createdAt))) {
            s.isStreaming = false
            s.isThinking = false
            sessionStorage.removeItem('active_streaming_conv')
            s.streamError = streamStatus?.status === 'error'
              ? 'زمان انتظار برای دریافت پاسخ به پایان رسید (تایم‌اوت)'
              : 'خطا در برقراری ارتباط با مدل هوش مصنوعی'
          } else {
            s.isStreaming = false
            s.isThinking = false
            sessionStorage.removeItem('active_streaming_conv')
          }
          convStreamStates.value.set(id, { ...s })
        }
      } catch (err) {
        if (isSavedStream || hasPendingUserTurn) {
          clearWatchdog(id)
          const s = ensureState(id)
          s.isStreaming = false
          s.isThinking = false
          s.streamError = 'خطا در برقراری ارتباط با مدل هوش مصنوعی'
          convStreamStates.value.set(id, { ...s })
          sessionStorage.removeItem('active_streaming_conv')
        }
      }
    }
  }

  // ─── Reconnect to active stream ────────────────────────────────────────────
  async function reconnectToActiveStream(convId: string) {
    const state = ensureState(convId)
    if (state.abortController) {
      state.abortController.abort()
      state.abortController = null
    }
    const abortCtrl = new AbortController()
    state.abortController = abortCtrl
    convStreamStates.value.set(convId, { ...state })
    resetWatchdog(convId, 35000)

    await chatService.subscribeActiveStream(
      convId,
      (accumulated: string) => {
        const s = ensureState(convId)
        s.isThinking = false
        s.currentStreamingText = accumulated
        convStreamStates.value.set(convId, { ...s })
        resetWatchdog(convId, 25000)
      },
      (token: string) => {
        const s = ensureState(convId)
        s.isThinking = false
        s.currentStreamingText += token
        convStreamStates.value.set(convId, { ...s })
        resetWatchdog(convId, 25000)
      },
      (messageId: string) => {
        clearWatchdog(convId)
        const s = ensureState(convId)
        s.abortController = null
        convStreamStates.value.set(convId, { ...s })
        finishStream(convId, messageId)
      },
      (err: any) => {
        clearWatchdog(convId)
        const s = ensureState(convId)
        s.abortController = null
        s.isStreaming = false
        s.isThinking = false
        sessionStorage.removeItem('active_streaming_conv')
        const rawMsg = typeof err === 'string' ? err : err?.message
        const errorMessage = rawMsg || 'زمان انتظار برای دریافت پاسخ به پایان رسید '
        s.streamError = errorMessage
        convStreamStates.value.set(convId, { ...s })
        uiStore.showToast(errorMessage, 'error')
        if (s.currentStreamingText) {
          finishStream(convId, `msg-${Date.now()}`, true)
        }
      },
      abortCtrl.signal,
      (newTitle: string) => {
        const conv = conversations.value.find((c) => c.id === convId)
        if (conv) {
          conv.title = newTitle
        }
      }
    )
  }

  // ─── Switch model ──────────────────────────────────────────────────────────
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

  // ─── Create conversation ───────────────────────────────────────────────────
  async function createNewConversation(title = 'گفتگوی جدید'): Promise<string> {
    const modelId = modelsStore.selectedModel?.id || modelsStore.selectedModelId
    try {
      const created = await chatService.createConversation(modelId, title)
      if (created && created.id) {
        // Don't add to conversations list yet — the chat only joins the sidebar
        // when the assistant responds to the first message (see sendMessage).
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
    // Same as above — keep the placeholder off the sidebar until a message is sent.
    currentConversationId.value = newConv.id
    messages.value = []
    return newConv.id
  }

  // ─── Delete conversation ───────────────────────────────────────────────────
  async function deleteConversation(id: string) {
    // Abort streaming for the deleted conversation
    const s = convStreamStates.value.get(id)
    if (s) {
      if (s.watchdogTimer) clearTimeout(s.watchdogTimer)
      if (s.abortController) { try { s.abortController.abort() } catch {} }
      convStreamStates.value.delete(id)
    }
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

  // ─── Update title ──────────────────────────────────────────────────────────
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

  // ─── Send message ──────────────────────────────────────────────────────────
  async function sendMessage(content: string) {
    const convId_check = currentConversationId.value
    const currentState = convId_check ? convStreamStates.value.get(convId_check) : null
    if (!content.trim() || currentState?.isStreaming) return

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

    // Track prompt immediately for retry capability
    const state = ensureState(convId)
    state.lastUserPrompt = content
    convStreamStates.value.set(convId, { ...state })

    // Add user message immediately with sending status
    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      conversationId: convId,
      role: 'user',
      content: content.trim(),
      createdAt: new Date().toISOString(),
      status: 'sending'
    }
    messages.value.push(userMessage)

    // Clear any previous transient stream error for this conversation
    {
      const s = ensureState(convId)
      s.streamError = null
      convStreamStates.value.set(convId, { ...s })
    }

    // Pre-flight health check
    const isHealthy = await checkBackendHealth()
    if (!isHealthy) {
      userMessage.status = 'error'
      const s = ensureState(convId)
      s.streamError = 'خطا در برقراری ارتباط'
      convStreamStates.value.set(convId, { ...s })
      uiStore.showToast('خطا در برقراری ارتباط', 'error')
      return
    }

    // Update conversation title if it's the first user message
    const conv = conversations.value.find((c) => c.id === convId)
    if (conv && (conv.title === 'گفتگوی جدید' || conv.title === 'New Chat')) {
      conv.title = content.slice(0, 30) + (content.length > 30 ? '...' : '')
    }

    // If conversation is a local placeholder, persist it to backend
    if (convId.startsWith('c-')) {
      try {
        const modelId = modelsStore.selectedModel?.id || modelsStore.selectedModelId
        const created = await chatService.createConversation(modelId, conv?.title || content.slice(0, 30))
        if (created && created.id) {
          if (conv) conv.id = created.id
          currentConversationId.value = created.id
          userMessage.conversationId = created.id
          // Move stream state to new ID
          const oldState = convStreamStates.value.get(convId)
          if (oldState) {
            convStreamStates.value.delete(convId)
            convStreamStates.value.set(created.id, oldState)
          }
          convId = created.id
        }
      } catch (err) {
        console.warn('Could not persist conversation to backend before streaming:', err)
      }
    }

    // Prepare streaming state
    {
      const s = ensureState(convId)
      s.isThinking = true
      s.isStreaming = true
      s.currentStreamingText = ''
      convStreamStates.value.set(convId, { ...s })
    }
    sessionStorage.setItem('active_streaming_conv', convId)

    let streamedAny = false

    // Abort any existing controller for this conv
    {
      const s = convStreamStates.value.get(convId)
      if (s?.abortController) {
        s.abortController.abort()
        s.abortController = null
      }
    }
    const abortCtrl = new AbortController()
    {
      const s = ensureState(convId)
      s.abortController = abortCtrl
      convStreamStates.value.set(convId, { ...s })
    }
    resetWatchdog(convId, 35000)

    await chatService.sendMessageStream(
      convId,
      content,
      (token: string) => {
        const s = ensureState(convId)
        s.isThinking = false
        streamedAny = true
        userMessage.status = 'sent'
        s.streamError = null
        s.currentStreamingText += token
        convStreamStates.value.set(convId, { ...s })
        resetWatchdog(convId, 25000)

        // First token from the assistant means the conversation is real now —
        // add it to the sidebar so the user can find it again later. Until the
        // model responds, the chat stays off the list (see createNewConversation).
        if (!conversations.value.find((c) => c.id === convId)) {
          const modelId = modelsStore.selectedModel?.id || modelsStore.selectedModelId
          conversations.value.unshift({
            id: convId,
            title: content.slice(0, 30),
            modelId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          })
        }
      },
      (messageId: string) => {
        clearWatchdog(convId)
        const s = ensureState(convId)
        s.abortController = null
        convStreamStates.value.set(convId, { ...s })
        userMessage.status = 'sent'
        finishStream(convId, messageId)
      },
      async (err: any) => {
        clearWatchdog(convId)
        const s = ensureState(convId)
        s.abortController = null
        s.isThinking = false
        s.isStreaming = false
        sessionStorage.removeItem('active_streaming_conv')

        const rawMsg = typeof err === 'string' ? err : err?.message
        const errorMessage =
          rawMsg &&
          !rawMsg.includes('Failed to fetch') &&
          !rawMsg.includes('NetworkError') &&
          !rawMsg.includes('Load failed')
            ? rawMsg
            : 'خطا در برقراری ارتباط'

        if (streamedAny) {
          userMessage.status = 'sent'
          convStreamStates.value.set(convId, { ...s })
          finishStream(convId, `msg-${Date.now()}`, true)
          const s2 = ensureState(convId)
          s2.streamError = errorMessage
          convStreamStates.value.set(convId, { ...s2 })
        } else {
          userMessage.status = 'error'
          userMessage.errorText = errorMessage
          s.streamError = errorMessage
          s.currentStreamingText = ''
          convStreamStates.value.set(convId, { ...s })
        }
      },
      abortCtrl.signal,
      (newTitle: string) => {
        const c = conversations.value.find((item) => item.id === convId)
        if (c) {
          c.title = newTitle
        }
      },
      (syncText: string) => {
        const s = ensureState(convId)
        s.isThinking = false
        streamedAny = true
        userMessage.status = 'sent'
        s.streamError = null
        s.currentStreamingText = syncText
        convStreamStates.value.set(convId, { ...s })
        resetWatchdog(convId, 25000)
      }
    )
  }

  // ─── Finish stream ─────────────────────────────────────────────────────────
  function finishStream(convId: string, messageId: string, isInterrupted = false, overrideContent?: string) {
    clearWatchdog(convId)
    sessionStorage.removeItem('active_streaming_conv')
    const s = ensureState(convId)
    s.abortController = null
    const textToSave = overrideContent !== undefined ? overrideContent : s.currentStreamingText
    if (textToSave) {
      // Only push to messages if this is the current conv (otherwise it would be stale)
      if (convId === currentConversationId.value) {
        messages.value.push({
          id: messageId,
          conversationId: convId,
          role: 'assistant',
          content: textToSave,
          createdAt: new Date().toISOString(),
          isInterrupted
        })
      }
    }
    s.currentStreamingText = ''
    s.isStreaming = false
    s.isThinking = false
    convStreamStates.value.set(convId, { ...s })
  }

  // ─── Clear stream error ────────────────────────────────────────────────────
  function clearStreamError() {
    const id = currentConversationId.value
    if (!id) return
    const s = ensureState(id)
    s.streamError = null
    convStreamStates.value.set(id, { ...s })
  }

  // ─── Retry last message ────────────────────────────────────────────────────
  async function retryLastMessage() {
    const convId = currentConversationId.value
    if (!convId) return

    const s = convStreamStates.value.get(convId)
    const promptToRetry =
      s?.lastUserPrompt?.trim() ||
      [...messages.value].reverse().find((m) => m.role === 'user')?.content?.trim()

    if (!promptToRetry) return

    // Clear transient error & abort any hanging controller / watchdog
    clearWatchdog(convId)
    if (s?.abortController) {
      try { s.abortController.abort() } catch {}
    }
    const fresh = ensureState(convId)
    fresh.streamError = null
    fresh.abortController = null
    fresh.isStreaming = false
    fresh.isThinking = false
    fresh.lastUserPrompt = promptToRetry
    convStreamStates.value.set(convId, { ...fresh })
    sessionStorage.removeItem('active_streaming_conv')

    // Remove trailing assistant message if it was interrupted, empty, or an error
    while (messages.value.length > 0 && messages.value[messages.value.length - 1].role === 'assistant') {
      const last = messages.value[messages.value.length - 1]
      if (last.isInterrupted || last.id.startsWith('msg-err-') || last.status === 'error' || !last.content) {
        messages.value.pop()
      } else {
        break
      }
    }

    // Remove trailing user message so sendMessage can re-add it cleanly
    if (messages.value.length > 0 && messages.value[messages.value.length - 1].role === 'user') {
      const last = messages.value[messages.value.length - 1]
      if (last.content.trim() === promptToRetry) {
        messages.value.pop()
      }
    }

    await sendMessage(promptToRetry)
  }

  // ─── Resume interrupted message ────────────────────────────────────────────
  async function resumeInterruptedMessage(messageId?: string) {
    const convId = currentConversationId.value
    if (!convId) return
    const target = messageId
      ? messages.value.find((m) => m.id === messageId)
      : [...messages.value].reverse().find((m) => m.role === 'assistant' && m.isInterrupted)

    if (!target) return

    const s = ensureState(convId)
    s.isStreaming = true
    s.isThinking = false
    s.currentStreamingText = target.content
    convStreamStates.value.set(convId, { ...s })

    // Remove old target temporarily while resuming
    messages.value = messages.value.filter((m) => m.id !== target.id)
    sessionStorage.setItem('active_streaming_conv', convId)

    const abortCtrl = new AbortController()
    {
      const s2 = ensureState(convId)
      s2.abortController = abortCtrl
      convStreamStates.value.set(convId, { ...s2 })
    }

    await chatService.resumeMessage(
      convId,
      target.id,
      (token: string) => {
        const s2 = ensureState(convId)
        s2.currentStreamingText += token
        convStreamStates.value.set(convId, { ...s2 })
      },
      (savedId: string) => {
        finishStream(convId, savedId, false)
      },
      (_err: any) => {
        finishStream(convId, target.id, true)
      },
      abortCtrl.signal
    )
  }

  // ─── Continue last message ─────────────────────────────────────────────────
  async function continueLastMessage() {
    const last = messages.value[messages.value.length - 1]
    if (last && last.role === 'assistant' && last.isInterrupted) {
      await resumeInterruptedMessage(last.id)
    } else {
      const prompt = 'ادامه بده'
      await sendMessage(prompt)
    }
  }

  // ─── Stop streaming ────────────────────────────────────────────────────────
  function stopStreaming() {
    const convId = currentConversationId.value
    if (!convId) return

    clearWatchdog(convId)
    const s = convStreamStates.value.get(convId)
    if (s?.abortController) {
      s.abortController.abort()
      s.abortController = null
    }

    if (convId && !convId.startsWith('c-') && typeof chatService.stopActiveStream === 'function') {
      chatService.stopActiveStream(convId).catch(() => {})
    }
    sessionStorage.removeItem('active_streaming_conv')

    const stoppedText = s?.currentStreamingText?.trim() || ''
    const content = stoppedText || 'تولید پاسخ توسط کاربر متوقف شد.'
    finishStream(convId, `msg-${Date.now()}`, true, content)
  }

  return {
    conversations,
    currentConversationId,
    activeConversation,
    messages,
    // Computed aliases (backward-compatible)
    isStreaming,
    isThinking,
    currentStreamingText,
    lastUserPrompt,
    streamError,
    // Per-conv streaming state (for sidebar indicators)
    convStreamStates,
    getConvIsStreaming,
    // Actions
    loadConversations,
    selectConversation,
    reconnectToActiveStream,
    createNewConversation,
    deleteConversation,
    updateConversationTitle,
    switchConversationModel,
    sendMessage,
    retryLastMessage,
    continueLastMessage,
    resumeInterruptedMessage,
    stopStreaming,
    clearStreamError
  }
})
