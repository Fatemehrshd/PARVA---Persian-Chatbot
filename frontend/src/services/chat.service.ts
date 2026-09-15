import { request, buildUrl } from './api'
import type {
  Conversation,
  Message,
  CreateConversationRequest,
  UpdateConversationRequest,
  SendMessageRequest,
  SearchResult,
  ActiveStreamStatus,
} from '../types'

/**
 * Chat Service (Maps 1:1 with OpenAPI tag: Chat)
 * Handles conversation creation, message history, and real-time SSE streaming.
 */
export const chatService = {
  /**
   * List the current user's conversations.
   * GET /chat/conversations
   */
  async listConversations(): Promise<Conversation[]> {
    return request<Conversation[]>('/chat/conversations')
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
  async sendMessage(conversationId: string, content: string): Promise<Message> {
    const payload: SendMessageRequest = { content }
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
      await readSseStream(response, { onToken, onDone }, signal)
    } catch (err: any) {
      if (err?.name === 'AbortError' || signal?.aborted) return
      onError?.(err)
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
    onTitle?: (title: string) => void
  ): Promise<void> {
    const token = localStorage.getItem('token')
    const headers: Record<string, string> = {
      Accept: 'text/event-stream'
    }
    if (token) headers['Authorization'] = `Bearer ${token}`

    const url = buildUrl(`/chat/conversations/${conversationId}/stream`)
    try {
      const response = await fetch(url, { method: 'GET', headers, signal })
      if (!response.ok) {
        throw new Error(`Reconnection failed: ${response.status}`)
      }
      await readSseStream(response, { onToken, onSync, onTitle, onDone }, signal)
    } catch (err: any) {
      if (err?.name === 'AbortError' || signal?.aborted) return
      onError?.(err)
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
    onSync?: (accumulated: string) => void
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

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ content }),
        signal
      })

      if (!response.ok) {
        let message = `Server responded with status ${response.status}`
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

      const doneReceived = await readSseStream(
        response,
        { onToken, onSync, onTitle, onDone },
        signal
      )

      if (!doneReceived && !signal?.aborted) {
        // Stream dropped without done event (network glitch) — attempt automatic reconnection
        await this.subscribeActiveStream(
          conversationId,
          onSync,
          onToken,
          onDone,
          onError,
          signal,
          onTitle
        )
      }
    } catch (error: any) {
      if (error?.name === 'AbortError' || signal?.aborted) {
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
          onTitle
        )
      } catch {
        onError(error)
      }
    }
  }
}

/**
 * Parses and dispatches events from an SSE ReadableStream.
 */
async function readSseStream(
  response: Response,
  callbacks: {
    onToken?: (token: string) => void
    onSync?: (content: string) => void
    onTitle?: (title: string) => void
    onDone?: (messageId: string) => void
  },
  signal?: AbortSignal
): Promise<boolean> {
  if (!response.body) {
    throw new Error('ReadableStream not supported by response')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''
  let receivedDone = false

  while (true) {
    if (signal?.aborted) {
      reader.cancel().catch(() => {})
      break
    }
    const { done, value } = await reader.read()
    if (done) break

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
          if (currentEvent === 'token' && data.content !== undefined) {
            callbacks.onToken?.(data.content)
          } else if (currentEvent === 'sync' && data.content !== undefined) {
            callbacks.onSync?.(data.content)
          } else if (currentEvent === 'title' && data.title) {
            callbacks.onTitle?.(data.title)
          } else if (currentEvent === 'done' && data.messageId) {
            receivedDone = true
            callbacks.onDone?.(data.messageId)
          }
        } catch {
          if (currentEvent === 'token') {
            callbacks.onToken?.(dataStr)
          }
        }
      }
    }
  }
  return receivedDone
}
