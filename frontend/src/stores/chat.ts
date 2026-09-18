import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Conversation, Message, FileAttachmentItem } from '../types'
import { chatService } from '../services/chat.service'
import { filesService } from '../services/files.service'
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
  charBuffer: string[]
  releaseTimer: ReturnType<typeof setTimeout> | null
}

// Delay between rendered characters during streaming — small enough to feel
// real-time but visible enough to give a smooth typing effect.
const STREAM_CHAR_DELAY_MS = 8

function makeDefaultState(): ConvStreamState {
  return {
    isStreaming: false,
    isThinking: false,
    streamError: null,
    currentStreamingText: '',
    abortController: null,
    watchdogTimer: null,
    lastUserPrompt: '',
    charBuffer: [],
    releaseTimer: null,
  }
}

interface QueuedMessageJob {
  id: string
  convId: string
  content: string
  fileIds?: string[]
  attachments?: FileAttachmentItem[]
  userMessage: Message
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
  const isLoadingConversations = ref(false)
  const isLoadingMessages = ref(false)
  const conversationPage = ref(1)
  const hasMoreConversations = ref(false)
  const isTokenLimitExceeded = ref(false)

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
        s.streamError = 'زمان انتظار برای دریافت پاسخ به پایان رسید'
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
    isLoadingConversations.value = true
    isLoadingMessages.value = true
    conversationPage.value = 1
    const savedActive = sessionStorage.getItem('active_streaming_conv')
    if (savedActive && (!targetId || targetId === savedActive)) {
      targetId = savedActive
    }

    try {
      const data = await chatService.listConversations(1, 50)
      if (Array.isArray(data)) {
        conversations.value = data
        hasMoreConversations.value = data.length >= 50
        if (data.length > 0) {
          let idToSelect: string = data[0].id
          if (targetId && data.some((c) => c.id === targetId)) {
            idToSelect = targetId
          } else if (!targetId && currentConversationId.value && data.some((c) => c.id === currentConversationId.value)) {
            idToSelect = currentConversationId.value
          }
          // اگر targetId در لیست نبود (مثلاً conversation خالی که backend فیلتر کرده)،
          // به اولین conversation موجود برو
          await selectConversation(idToSelect)
        } else {
          conversations.value = []
          currentConversationId.value = null
          messages.value = []
          isLoadingMessages.value = false
        }
        return
      }
    } catch (err) {
      console.warn('Backend listConversations failed:', err)
      isLoadingMessages.value = false
    } finally {
      isLoadingConversations.value = false
    }
    if (targetId) {
      await selectConversation(targetId)
    } else if (conversations.value.length === 0) {
      currentConversationId.value = null
      messages.value = []
      isLoadingMessages.value = false
    }
  }

  async function loadMoreConversations() {
    if (!hasMoreConversations.value || isLoadingConversations.value) return
    isLoadingConversations.value = true
    try {
      const nextPage = conversationPage.value + 1
      const data = await chatService.listConversations(nextPage, 50)
      if (Array.isArray(data) && data.length > 0) {
        const existingIds = new Set(conversations.value.map((c) => c.id))
        const newItems = data.filter((c) => !existingIds.has(c.id))
        conversations.value.push(...newItems)
        conversationPage.value = nextPage
        hasMoreConversations.value = data.length >= 50
      } else {
        hasMoreConversations.value = false
      }
    } catch (err) {
      console.warn('loadMoreConversations failed:', err)
    } finally {
      isLoadingConversations.value = false
    }
  }

  // ─── Select conversation ───────────────────────────────────────────────────
  // KEY CHANGE: We no longer stop background streaming when switching conversations.
  // Each conversation keeps its own streaming state in convStreamStates.
  async function selectConversation(id: string) {
    if (!id) return
    isLoadingMessages.value = true
    const savedActive = sessionStorage.getItem('active_streaming_conv')
    const isSavedStream = savedActive === id

    // If switching to a different conversation, immediately clear messages so old chat does not linger
    if (currentConversationId.value && currentConversationId.value !== id) {
      messages.value = []
    }

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

    const isTestEnv =
      (typeof import.meta !== 'undefined' && import.meta.env?.MODE === 'test') ||
      (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test')
    const minDelayMs = isTestEnv ? 0 : 500
    const delayPromise =
      minDelayMs > 0 ? new Promise((resolve) => setTimeout(resolve, minDelayMs)) : Promise.resolve()

    try {
      try {
        const [data] = await Promise.all([
          chatService.getMessages(id),
          delayPromise
        ])
        if (Array.isArray(data)) {
          messages.value = data
        } else {
          messages.value = []
        }
      } catch (err) {
        await delayPromise
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
                ? 'زمان انتظار برای دریافت پاسخ به پایان رسید'
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
            s.streamError = 'خطا در برقراری ارتباط'
            convStreamStates.value.set(id, { ...s })
            sessionStorage.removeItem('active_streaming_conv')
          }
        }
      }
    } finally {
      isLoadingMessages.value = false
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

  // ─── Pending Message Queue (per-conversation) ────────────────────────────
  const pendingMessageQueue = ref<Map<string, QueuedMessageJob[]>>(new Map())

  function checkAndProcessQueue(convId: string) {
    const queue = pendingMessageQueue.value.get(convId)
    if (!queue || queue.length === 0) return

    const nextJob = queue.shift()!
    const targetMsg = messages.value.find((m) => m.id === nextJob.id) || nextJob.userMessage
    targetMsg.status = 'sent'

    executeMessageStream(convId, nextJob.content, targetMsg, nextJob.fileIds)
  }

  // ─── Execute streaming response for a message ──────────────────────────────
  async function executeMessageStream(
    convId: string,
    content: string,
    userMessage: Message,
    fileIds?: string[]
  ) {
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
        // Buffer the characters and release them slowly so the response
        // streams in like a human is typing rather than dumping instantly.
        if (token) {
          s.charBuffer.push(...token.split(''))
          if (!s.releaseTimer) {
            const release = () => {
              const cur = ensureState(convId)
              if (cur.charBuffer.length > 0) {
                cur.currentStreamingText += cur.charBuffer.shift()!
                convStreamStates.value.set(convId, { ...cur })
                cur.releaseTimer = setTimeout(release, STREAM_CHAR_DELAY_MS)
              } else {
                cur.releaseTimer = null
                convStreamStates.value.set(convId, { ...cur })
              }
            }
            s.releaseTimer = setTimeout(release, STREAM_CHAR_DELAY_MS)
          }
        }
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
        checkAndProcessQueue(convId)
      },
      async (err: any) => {
        clearWatchdog(convId)
        const s = ensureState(convId)
        s.abortController = null
        s.isThinking = false
        s.isStreaming = false
        sessionStorage.removeItem('active_streaming_conv')

        const rawMsg = typeof err === 'string' ? err : err?.message || ''
        const isLimit =
          Boolean(rawMsg && (rawMsg.includes('اعتبار') || rawMsg.includes('سقف مجاز مصرف توکن') || rawMsg.includes('سقف مجاز') || rawMsg.includes('توکن'))) ||
          err?.statusCode === 400

        if (isLimit) {
          isTokenLimitExceeded.value = true
          uiStore.showToast('اعتبار شما تمام شده است (سقف مجاز مصرف توکن به پایان رسیده است). لطفاً جهت افزایش اعتبار با مدیر سامانه تماس بگیرید.', 'error')
        }

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

        checkAndProcessQueue(convId)
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
      },
      fileIds
    )
  }

  // ─── Poll files until ready then dispatch ──────────────────────────────────
  function waitForFilesReadyAndDispatch(
    convId: string,
    userMessage: Message,
    content: string,
    fileList: FileAttachmentItem[]
  ) {
    let attempts = 0
    const maxAttempts = 60
    const timer = setInterval(async () => {
      attempts++
      let allReady = true
      let anyError = false

      for (const file of fileList) {
        if (file.status === 'ready') continue
        try {
          const res = await filesService.getFileStatus(file.id)
          file.status = res.status
          file.errorMessage = res.errorMessage
          if (res.status === 'error') anyError = true
          if (res.status !== 'ready') allReady = false
        } catch {
          allReady = false
        }
      }

      if (anyError) {
        clearInterval(timer)
        userMessage.status = 'error'
        uiStore.showToast('خطا در پردازش فایل‌های پیوست', 'error')
        return
      }

      if (allReady) {
        clearInterval(timer)
        const currentState = convStreamStates.value.get(convId)
        if (currentState?.isStreaming) {
          userMessage.status = 'queued'
          if (!pendingMessageQueue.value.has(convId)) {
            pendingMessageQueue.value.set(convId, [])
          }
          pendingMessageQueue.value.get(convId)!.push({
            id: userMessage.id,
            convId,
            content,
            fileIds: fileList.map((f) => f.id),
            attachments: fileList,
            userMessage,
          })
        } else {
          userMessage.status = 'sent'
          executeMessageStream(convId, content, userMessage, fileList.map((f) => f.id))
        }
      } else if (attempts >= maxAttempts) {
        clearInterval(timer)
        userMessage.status = 'error'
        uiStore.showToast('زمان پردازش فایل‌ها به پایان رسید', 'error')
      }
    }, 2000)
  }

  // ─── Send message ──────────────────────────────────────────────────────────
  async function sendMessage(content: string, files?: FileAttachmentItem[]) {
    if (isTokenLimitExceeded.value) {
      uiStore.showToast('اعتبار شما تمام شده است (سقف مجاز مصرف توکن به پایان رسیده است). امکان ارسال پیام جدید وجود ندارد.', 'error')
      return
    }

    if (!content.trim() && (!files || files.length === 0)) return

    const currentActiveState = currentConversationId.value ? convStreamStates.value.get(currentConversationId.value) : null
    if (currentActiveState?.isStreaming || currentActiveState?.isThinking) {
      uiStore.showToast('در حال دریافت پاسخ، امکان ارسال پیام جدید وجود ندارد', 'warning')
      return
    }

    if (!currentConversationId.value) {
      // Local placeholder id only — the conversation joins the sidebar when
      // the assistant responds (see executeMessageStream's first-token hook),
      // so a pending chat never shows up in the list.
      const tempId = `c-${Date.now()}`
      currentConversationId.value = tempId
    }

    let convId = currentConversationId.value!

    const fileList = files && files.length > 0 ? [...files] : undefined
    const fileIds = fileList ? fileList.map((f) => f.id) : undefined

    // Track prompt immediately for retry capability
    const state = ensureState(convId)
    state.lastUserPrompt = content
    convStreamStates.value.set(convId, { ...state })

    // Add user message immediately
    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      conversationId: convId,
      role: 'user',
      content: content.trim(),
      createdAt: new Date().toISOString(),
      status: 'sent',
      attachments: fileList,
      fileIds,
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
      const fallbackTitle = fileList && fileList.length > 0 ? fileList[0].originalName : 'گفتگوی جدید'
      const titleCandidate = content.trim() || fallbackTitle
      conv.title = titleCandidate.slice(0, 30) + (titleCandidate.length > 30 ? '...' : '')
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
          const oldQueue = pendingMessageQueue.value.get(convId)
          if (oldQueue) {
            pendingMessageQueue.value.delete(convId)
            pendingMessageQueue.value.set(created.id, oldQueue)
          }
          convId = created.id
        }
      } catch (err) {
        console.warn('Could not persist conversation to backend before streaming:', err)
      }
    }

    // The conversation could not be persisted — it only exists as a local
    // placeholder. Sending to it would 404 on the backend, so fail fast with
    // visible feedback instead of a doomed stream request.
    if (convId.startsWith('c-')) {
      userMessage.status = 'error'
      const s = ensureState(convId)
      s.isStreaming = false
      s.isThinking = false
      s.streamError = 'خطا در ایجاد گفتگو روی سرور — دوباره تلاش کنید'
      convStreamStates.value.set(convId, { ...s })
      uiStore.showToast('خطا در ایجاد گفتگو روی سرور — دوباره تلاش کنید', 'error')
      return
    }

    // 1. Check if attached files are still processing
    const hasProcessing = fileList && fileList.some((f) => f.status === 'processing')
    if (hasProcessing) {
      userMessage.status = 'processing_files'
      waitForFilesReadyAndDispatch(convId, userMessage, content, fileList)
      return
    }

    // 2. Check if currently streaming or thinking
    const currentState = convStreamStates.value.get(convId)
    if (currentState?.isStreaming || currentState?.isThinking) {
      uiStore.showToast('در حال دریافت پاسخ، امکان ارسال پیام جدید وجود ندارد', 'warning')
      return
    }

    // 3. Dispatch stream immediately
    await executeMessageStream(convId, content, userMessage, fileIds)
  }

  // ─── Retry failed file in message ──────────────────────────────────────────
  async function retryFailedMessageFile(messageId: string, fileId: string) {
    const msg = messages.value.find((m) => m.id === messageId)
    if (!msg || !msg.attachments) return

    const targetFile = msg.attachments.find((f) => f.id === fileId)
    if (!targetFile) return

    targetFile.status = 'processing'
    targetFile.errorMessage = undefined
    msg.status = 'processing_files'

    try {
      await filesService.retryFile(fileId)
      waitForFilesReadyAndDispatch(msg.conversationId, msg, msg.content, msg.attachments)
    } catch (err: any) {
      targetFile.status = 'error'
      msg.status = 'error'
      uiStore.showToast(err?.message || 'خطا در تلاش مجدد فایل', 'error')
    }
  }

  // ─── Remove failed file and send without it ────────────────────────────────
  async function removeMessageFileAndSend(messageId: string, fileId: string) {
    const msg = messages.value.find((m) => m.id === messageId)
    if (!msg) return

    if (msg.attachments) {
      msg.attachments = msg.attachments.filter((f) => f.id !== fileId)
      msg.fileIds = msg.attachments.map((f) => f.id)
    }

    // Delete file from backend
    filesService.deleteFile(fileId).catch(() => {})

    // If remaining files are still processing, keep waiting
    const hasRemainingProcessing = msg.attachments && msg.attachments.some((f) => f.status === 'processing')
    if (hasRemainingProcessing && msg.attachments) {
      msg.status = 'processing_files'
      waitForFilesReadyAndDispatch(msg.conversationId, msg, msg.content, msg.attachments)
      return
    }

    // Otherwise dispatch stream
    const convId = msg.conversationId
    const currentState = convStreamStates.value.get(convId)
    if (currentState?.isStreaming) {
      msg.status = 'queued'
      if (!pendingMessageQueue.value.has(convId)) {
        pendingMessageQueue.value.set(convId, [])
      }
      pendingMessageQueue.value.get(convId)!.push({
        id: msg.id,
        convId,
        content: msg.content,
        fileIds: msg.fileIds,
        attachments: msg.attachments,
        userMessage: msg,
      })
    } else {
      msg.status = 'sent'
      await executeMessageStream(convId, msg.content, msg, msg.fileIds)
    }
  }

  // ─── Soft Delete Message ───────────────────────────────────────────────────
  async function deleteMessage(messageId: string) {
    const convId = currentConversationId.value
    messages.value = messages.value.filter((m) => m.id !== messageId)
    uiStore.showToast('حذف شد', 'success')
    if (convId && !convId.startsWith('c-')) {
      try {
        await chatService.deleteMessage(convId, messageId)
      } catch (err) {
        console.warn('Backend deleteMessage failed:', err)
      }
    }
  }

  // ─── Finish stream ─────────────────────────────────────────────────────────
  function finishStream(convId: string, messageId: string, isInterrupted = false, overrideContent?: string) {
    clearWatchdog(convId)
    sessionStorage.removeItem('active_streaming_conv')
    const s = ensureState(convId)
    s.abortController = null
    // Flush any pending streaming chars so the saved text isn't truncated.
    if (s.charBuffer.length > 0) {
      s.currentStreamingText += s.charBuffer.join('')
      s.charBuffer = []
      if (s.releaseTimer) {
        clearTimeout(s.releaseTimer)
        s.releaseTimer = null
      }
    }
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

  // ─── Retry last message ────────────────────────────────────────────────────
  async function retryLastMessage() {
    const convId = currentConversationId.value
    if (!convId) return

    const s = convStreamStates.value.get(convId)
    const lastUserMsg = [...messages.value].reverse().find((m) => m.role === 'user')
    const promptToRetry =
      s?.lastUserPrompt?.trim()
        ? s.lastUserPrompt
        : (lastUserMsg?.content || '')
    const filesToRetry = lastUserMsg?.attachments ? [...lastUserMsg.attachments] : undefined

    if (!promptToRetry.trim() && (!filesToRetry || filesToRetry.length === 0)) return

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

    // Remove trailing user message so sendMessage can re-add it cleanly with its attachments preserved
    if (messages.value.length > 0 && messages.value[messages.value.length - 1].role === 'user') {
      const last = messages.value[messages.value.length - 1]
      if (last.id === lastUserMsg?.id || last.content.trim() === promptToRetry.trim()) {
        messages.value.pop()
      }
    }

    await sendMessage(promptToRetry, filesToRetry)
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

  function clearStreamError() {
    const convId = currentConversationId.value
    if (convId) {
      const s = convStreamStates.value.get(convId)
      if (s) {
        s.streamError = null
        convStreamStates.value.set(convId, { ...s })
      }
    }
    isTokenLimitExceeded.value = false
  }

  return {
    conversations,
    currentConversationId,
    activeConversation,
    messages,
    isLoadingConversations,
    isLoadingMessages,
    conversationPage,
    hasMoreConversations,
    isTokenLimitExceeded,
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
    loadMoreConversations,
    selectConversation,
    reconnectToActiveStream,
    createNewConversation,
    deleteConversation,
    deleteMessage,
    updateConversationTitle,
    switchConversationModel,
    sendMessage,
    retryFailedMessageFile,
    removeMessageFileAndSend,
    retryLastMessage,
    continueLastMessage,
    resumeInterruptedMessage,
    stopStreaming,
    clearStreamError,
    pendingMessageQueue
  }
})
