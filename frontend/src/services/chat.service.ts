import { request } from './api'
import type { Conversation, Message } from '../types'

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

export const chatService = {
  async listConversations(): Promise<Conversation[]> {
    return request<Conversation[]>('/chat/conversations')
  },

  async createConversation(modelId?: string, title?: string): Promise<Conversation> {
    return request<Conversation>('/chat/conversations', {
      method: 'POST',
      body: JSON.stringify({ modelId, title })
    })
  },

  async getMessages(conversationId: string): Promise<Message[]> {
    return request<Message[]>(`/chat/conversations/${conversationId}/messages`)
  },

  async sendMessageStream(
    conversationId: string,
    content: string,
    onToken: (token: string) => void,
    onDone: (messageId: string) => void,
    onError: (err: any) => void
  ): Promise<void> {
    const token = localStorage.getItem('token')
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream'
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    try {
      const response = await fetch(`${BASE_URL}/chat/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ content })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || `Server responded with ${response.status}`)
      }

      if (!response.body) {
        throw new Error('ReadableStream not supported by response')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder('utf-8')
      let buffer = ''

      while (true) {
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
              if (currentEvent === 'token' && data.content) {
                onToken(data.content)
              } else if (currentEvent === 'done' && data.messageId) {
                onDone(data.messageId)
              }
            } catch {
              // Raw text fallback
              if (currentEvent === 'token') {
                onToken(dataStr)
              }
            }
          }
        }
      }
    } catch (error) {
      onError(error)
    }
  }
}
