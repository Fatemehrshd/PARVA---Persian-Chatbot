import { request, buildUrl } from './api'
import type {
  Conversation,
  Message,
  CreateConversationRequest,
  UpdateConversationRequest,
  SendMessageRequest,
  SearchResult,
  ActiveStreamStatus,
  WebSource,
} from '../types'

/** Callbacks for every SSE event the chat stream can emit. */
export interface SseCallbacks {
  onToken?: (token: string) => void
  onSync?: (content: string) => void
  onTitle?: (title: string) => void
  onDone?: (messageId: string) => void
  onError?: (err: any) => void
  onSearchStatus?: (state: string) => void
  onSources?: (sources: WebSource[]) => void
  onSourcesError?: (message: string) => void
  onThinking?: (content: string) => void
  onThinkingStatus?: (status: { state: 'thinking' | 'done'; durationMs?: number }) => void
  onActivity?: () => void
}

/**
 * Dispatches one parsed SSE data payload to the matching callback.
 * Returns 'done'/'error' for terminal events so the reader can update its flags.
 */
export function dispatchSseEvent(
  currentEvent: string,
  data: any,
  cb: SseCallbacks
): 'done' | 'error' | void {
  if (currentEvent === 'token' && data.content !== undefined) {
    cb.onToken?.(data.content)
  } else if (currentEvent === 'sync' && data.content !== undefined) {
    cb.onSync?.(data.content)
  } else if (currentEvent === 'title' && data.title) {
    cb.onTitle?.(data.title)
  } else if (currentEvent === 'done' && data.messageId) {
    cb.onDone?.(data.messageId)
    return 'done'
  } else if (currentEvent === 'search-status' && data.state) {
    cb.onSearchStatus?.(data.state)
  } else if (currentEvent === 'sources' && Array.isArray(data.sources)) {
    cb.onSources?.(data.sources)
  } else if (currentEvent === 'sources-error') {
    cb.onSourcesError?.(data.message || 'خطا در جستجو')
  } else if (currentEvent === 'thinking' && data.content !== undefined) {
    cb.onThinking?.(data.content)
  } else if (currentEvent === 'thinking-status' && data.state) {
    cb.onThinkingStatus?.(data)
  } else if (currentEvent === 'error') {
    cb.onError?.(new Error(data.error || data.message || 'خطا در برقراری ارتباط'))
    return 'error'
  }
}

/**
 * Chat Service (Maps 1:1 with OpenAPI tag: Chat)
 * Handles conversation creation, message history, and real-time SSE streaming.
 */
export const chatService = {
  /**
   * List the current user's conversations.
   * GET /chat/conversations
   */
  async listConversations(page?: number, limit?: number): Promise<Conversation[]> {
    const params = new URLSearchParams()
    if (page !== undefined) params.set('page', String(page))
    if (limit !== undefined) params.set('limit', String(limit))
    const qs = params.toString()
    return request<Conversation[]>(`/chat/conversations${qs ? `?${qs}` : ''}`)
  },

  /**
   * Search conversations by title and message contents.
   * GET /chat/conversations/search?q=...
   */
  async searchConversations(query: string): Promise<SearchResult[]> {
    if (!query || !query.trim()) return []
    return request<SearchResult[]>(`/chat/conversations/search?q=${encodeURIComponent(query.trim())}`)
  },

  /**
   * Start a new conversation.
   * POST /chat/conversations
   */
  async createConversation(modelId?: string, title?: string): Promise<Conversation> {
    const payload: CreateConversationRequest = {
      ...(modelId ? { modelId } : {}),
      ...(title ? { title } : {})
    }
    return request<Conversation>('/chat/conversations', {
      method: 'POST',
      body: JSON.stringify(payload)
    })
  },

  /**
   * Update conversation details (title and/or AI model).
   * PATCH /chat/conversations/{conversationId}
   */
  async updateConversation(
    conversationId: string,
    dataOrTitle: string | UpdateConversationRequest
  ): Promise<Conversation> {
    const payload: UpdateConversationRequest =
      typeof dataOrTitle === 'string' ? { title: dataOrTitle } : dataOrTitle
    return request<Conversation>(`/chat/conversations/${conversationId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    })
  },

  /**
   * Switch the model that answers this conversation from now on.
   * PATCH /chat/conversations/{conversationId} with { modelId }
   */
  async setModel(conversationId: string, modelId: string): Promise<Conversation> {
    return this.updateConversation(conversationId, { modelId })
  },

  /**
   * Delete a conversation.
   * DELETE /chat/conversations/{conversationId}
   */
  async deleteConversation(conversationId: string): Promise<void> {
    return request<void>(`/chat/conversations/${conversationId}`, {
      method: 'DELETE'
    })
  },

  /**
   * Delete a single message from conversation (Soft Delete).
   * DELETE /chat/conversations/{conversationId}/messages/{messageId}
   */
  async deleteMessage(conversationId: string, messageId: string): Promise<void> {
    return request<void>(`/chat/conversations/${conversationId}/messages/${messageId}`, {
      method: 'DELETE'
    })
  },

  /**
   * Set feedback (like / dislike / null) on an assistant message.
   * PATCH /chat/conversations/{conversationId}/messages/{messageId}/feedback
   */
  async setMessageFeedback(
    conversationId: string,
    messageId: string,
    feedback: 'like' | 'dislike' | null
  ): Promise<Message> {
    return request<Message>(`/chat/conversations/${conversationId}/messages/${messageId}/feedback`, {
      method: 'PATCH',
      body: JSON.stringify({ feedback }),
    })
  },

  /**
   * Get the message history of a conversation (ordered oldest first).
   * GET /chat/conversations/{conversationId}/messages
   */
  async getMessages(conversationId: string): Promise<Message[]> {
    return request<Message[]>(`/chat/conversations/${conversationId}/messages`)
  },

  /**
   * Send a message and receive a synchronous JSON reply (non-streaming).
   * POST /chat/conversations/{conversationId}/messages with Accept: application/json
   */
  async sendMessage(conversationId: string, content: string, fileIds?: string[]): Promise<Message> {
    const payload: SendMessageRequest = { content, ...(fileIds && fileIds.length > 0 ? { fileIds } : {}) }
    return request<Message>(`/chat/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    })
  },

  /**
   * Checks whether there is an active background generation for a conversation.
   * Useful when user refreshes the page mid-stream.
   * GET /chat/conversations/{conversationId}/active-stream
   */
  async getActiveStream(conversationId: string): Promise<ActiveStreamStatus> {
    return request<ActiveStreamStatus>(`/chat/conversations/${conversationId}/active-stream`)
  },

  /**
   * Explicitly stop/cancel an in-progress stream for a conversation.
   * POST /chat/conversations/{conversationId}/stop
   */
  async stopActiveStream(conversationId: string): Promise<void> {
    return request<void>(`/chat/conversations/${conversationId}/stop`, {
      method: 'POST'
    })
  },

  /**
   * Mark a specific message as stopped by user.
   * POST /chat/conversations/{conversationId}/messages/{messageId}/stop
   */
  async stopMessage(conversationId: string, messageId: string): Promise<Message> {
    return request<Message>(`/chat/conversations/${conversationId}/messages/${messageId}/stop`, {
      method: 'POST'
    })
  },

  /**
   * Resumes an interrupted message stream from where it stopped.
   * POST /chat/conversations/{conversationId}/messages/{messageId}/resume
   */
  async resumeMessage(
    conversationId: string,
    messageId: string,
    onToken: (token: string) => void,
    onDone: (messageId: string) => void,
    onError: (err: any) => void,
    signal?: AbortSignal
  ): Promise<void> {
    const token = localStorage.getItem('token')
    const headers: Record<string, string> = {
      Accept: 'text/event-stream'
    }
    if (token) headers['Authorization'] = `Bearer ${token}`

    const url = buildUrl(`/chat/conversations/${conversationId}/messages/${messageId}/resume`)
    try {
      const response = await fetch(url, { method: 'POST', headers, signal })
      if (!response.ok) {
        throw new Error(`Resume failed: ${response.status}`)
      }
      await readSseStream(response, { onToken, onDone, onError }, signal)
    } catch (err: any) {
      if (err?.name === 'AbortError' || signal?.aborted) return
      const msg = err?.message?.includes('fetch') ? 'خطا در برقراری ارتباط' : (err?.message || 'خطا در برقراری ارتباط')
      onError?.(new Error(msg))
    }
  },

  /**
   * Reconnect to an ongoing stream via SSE after page refresh or network blip.
   * GET /chat/conversations/{conversationId}/stream
   */
  async subscribeActiveStream(
    conversationId: string,
    onSync?: (accumulated: string) => void,
    onToken?: (token: string) => void,
    onDone?: (messageId: string) => void,
    onError?: (err: any) => void,
    signal?: AbortSignal,
    onTitle?: (title: string) => void,
    onSearchStatus?: (state: string) => void,
    onSources?: (sources: WebSource[]) => void,
    onSourcesError?: (message: string) => void,
    onThinking?: (content: string) => void,
    onThinkingStatus?: (status: { state: 'thinking' | 'done'; durationMs?: number }) => void
  ): Promise<void> {
    const token = localStorage.getItem('token')
    const headers: Record<string, string> = {
      Accept: 'text/event-stream'
    }
    if (token) headers['Authorization'] = `Bearer ${token}`

    const url = buildUrl(`/chat/conversations/${conversationId}/stream`)
    const internalAbort = new AbortController()
    let isTimeout = false
    const timer = setTimeout(() => {
      isTimeout = true
      internalAbort.abort()
    }, 35000)

    if (signal) {
      signal.addEventListener('abort', () => internalAbort.abort(), { once: true })
    }

    try {
      const response = await fetch(url, { method: 'GET', headers, signal: internalAbort.signal })
      if (!response.ok) {
        throw new Error(`Reconnection failed: ${response.status}`)
      }
      await readSseStream(response, { onToken, onSync, onTitle, onDone, onError, onSearchStatus, onSources, onSourcesError, onThinking, onThinkingStatus }, internalAbort.signal)
    } catch (err: any) {
      if (isTimeout) {
        onError?.(new Error('زمان انتظار برای دریافت پاسخ به پایان رسید (Timeout)'))
        return
      }
      if (err?.name === 'AbortError' || signal?.aborted) return
      const msg = err?.message?.includes('fetch') ? 'خطا در برقراری ارتباط' : (err?.message || 'خطا در برقراری ارتباط')
      onError?.(new Error(msg))
    } finally {
      clearTimeout(timer)
    }
  },

  /**
   * Send a message and stream the model's reply via Server-Sent Events (SSE).
   * Supports auto-reconnect on network drops, sync catching-up, and auto-titling.
   * POST /chat/conversations/{conversationId}/messages with Accept: text/event-stream
   */
  async sendMessageStream(
    conversationId: string,
    content: string,
    onToken: (token: string) => void,
    onDone: (messageId: string) => void,
    onError: (err: any) => void,
    signal?: AbortSignal,
    onTitle?: (title: string) => void,
    onSync?: (accumulated: string) => void,
    fileIds?: string[],
    onSearchStatus?: (state: string) => void,
    onSources?: (sources: WebSource[]) => void,
    onSourcesError?: (message: string) => void,
    opts?: { useWebSearch?: boolean; useThinking?: boolean },
    onThinking?: (content: string) => void,
    onThinkingStatus?: (status: { state: 'thinking' | 'done'; durationMs?: number }) => void
  ): Promise<void> {
    const token = localStorage.getItem('token')
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream'
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    const url = buildUrl(`/chat/conversations/${conversationId}/messages`)

    // 35s INACTIVITY safety timeout — reset on every received stream event.
    // (A total-duration timeout would kill long smooth-paced answers mid-way
    // and force a reconnect whose sync event dumps the remaining text at once.)
    const clientTimeoutMs = 35000
    const internalAbort = new AbortController()
    let isTimeout = false
    let inactivityTimer: ReturnType<typeof setTimeout> | undefined
    const armInactivityTimer = () => {
      if (inactivityTimer) clearTimeout(inactivityTimer)
      inactivityTimer = setTimeout(() => {
        isTimeout = true
        internalAbort.abort()
      }, clientTimeoutMs)
    }
    armInactivityTimer()

    if (signal) {
      signal.addEventListener('abort', () => internalAbort.abort(), { once: true })
    }

    try {
      const payload: any = { content }
      if (fileIds && fileIds.length > 0) {
        payload.fileIds = fileIds
      }
      if (opts?.useWebSearch) {
        payload.useWebSearch = true
      }
      if (opts?.useThinking) {
        payload.useThinking = true
      }
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: internalAbort.signal
      })

      if (!response.ok) {
        let message = 'خطا در برقراری ارتباط'
        try {
          const text = await response.text()
          try {
            const errorData = JSON.parse(text)
            if (Array.isArray(errorData.message)) {
              message = errorData.message.join(', ')
            } else if (errorData.message) {
              message = errorData.message
            } else if (errorData.error) {
              message = errorData.error
            }
          } catch {
            if (text && text.trim()) message = text.trim()
          }
        } catch {
          // ignore
        }
        throw new Error(message)
      }

      const streamRes = await readSseStream(
        response,
        { onToken, onSync, onTitle, onDone, onError, onSearchStatus, onSources, onSourcesError, onThinking, onThinkingStatus, onActivity: armInactivityTimer },
        internalAbort.signal
      )

      if (streamRes.hasError) {
        return
      }

      if (!streamRes.done && !internalAbort.signal.aborted) {
        // Stream dropped without done event (network glitch) — attempt automatic reconnection
        await this.subscribeActiveStream(
          conversationId,
          onSync,
          onToken,
          onDone,
          onError,
          signal,
          onTitle,
          onSearchStatus,
          onSources,
          onSourcesError,
          onThinking,
          onThinkingStatus
        )
      }
    } catch (error: any) {
      if (isTimeout) {
        onError(new Error('خطا در برقراری ارتباط: زمان پاسخ‌دهی سرور به پایان رسید'))
        return
      }
      if (signal?.aborted) {
        return
      }
      if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean' && !navigator.onLine) {
        onError(new Error('خطا در برقراری ارتباط'))
        return
      }
      // If network failed during stream, try reconnecting to ongoing active stream
      try {
        await new Promise((r) => setTimeout(r, 600))
        await this.subscribeActiveStream(
          conversationId,
          onSync,
          onToken,
          onDone,
          onError,
          signal,
          onTitle,
          onSearchStatus,
          onSources,
          onSourcesError
        )
      } catch {
        const msg = error?.message?.includes('fetch') || error?.message?.includes('NetworkError')
          ? 'خطا در برقراری ارتباط'
          : (error?.message || 'خطا در برقراری ارتباط')
        onError(new Error(msg))
      }
    } finally {
      if (inactivityTimer) clearTimeout(inactivityTimer)
    }
  }
}

/**
 * Parses and dispatches events from an SSE ReadableStream.
 */
async function readSseStream(
  response: Response,
  callbacks: SseCallbacks,
  signal?: AbortSignal
): Promise<{ done: boolean; hasError: boolean }> {
  if (!response.body) {
    throw new Error('ReadableStream not supported by response')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''
  let receivedDone = false
  let receivedError = false

  while (true) {
    if (signal?.aborted) {
      reader.cancel().catch(() => {})
      break
    }
    const { done, value } = await reader.read()
    if (done) break

    // Any received bytes prove the server is alive — re-arm the inactivity timer.
    callbacks.onActivity?.()

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    let currentEvent = 'message'
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue

      if (trimmed.startsWith('event:')) {
        currentEvent = trimmed.substring(6).trim()
      } else if (trimmed.startsWith('data:')) {
        const dataStr = trimmed.substring(5).trim()
        try {
          const data = JSON.parse(dataStr)
          const outcome = dispatchSseEvent(currentEvent, data, callbacks)
          if (outcome === 'done') {
            receivedDone = true
          } else if (outcome === 'error') {
            receivedError = true
            reader.cancel().catch(() => {})
            return { done: false, hasError: true }
          }
        } catch {
          if (currentEvent === 'token') {
            callbacks.onToken?.(dataStr)
          } else if (currentEvent === 'error') {
            receivedError = true
            callbacks.onError?.(new Error(dataStr || 'خطا در برقراری ارتباط'))
            reader.cancel().catch(() => {})
            return { done: false, hasError: true }
          }
        }
      }
    }
  }
  return { done: receivedDone, hasError: receivedError }
}
