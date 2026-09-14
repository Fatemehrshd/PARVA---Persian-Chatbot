import { describe, it, expect, beforeEach, vi } from 'vitest'
import { chatService } from '../../src/services/chat.service'
import * as apiModule from '../../src/services/api'

describe('Chat Service (chat.service.ts)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('lists conversations via GET /chat/conversations', async () => {
    const mockList = [{ id: 'c-1', title: 'Conversation 1', createdAt: '2026-01-01', updatedAt: '2026-01-01' }]
    const requestSpy = vi.spyOn(apiModule, 'request').mockResolvedValue(mockList as any)

    const result = await chatService.listConversations()
    expect(requestSpy).toHaveBeenCalledWith('/chat/conversations')
    expect(result).toEqual(mockList)
  })

  it('creates conversation via POST /chat/conversations with modelId and title', async () => {
    const mockCreated = { id: 'c-2', title: 'New Topic', modelId: 'm-1', createdAt: '2026-01-01', updatedAt: '2026-01-01' }
    const requestSpy = vi.spyOn(apiModule, 'request').mockResolvedValue(mockCreated as any)

    const result = await chatService.createConversation('m-1', 'New Topic')
    expect(requestSpy).toHaveBeenCalledWith('/chat/conversations', {
      method: 'POST',
      body: JSON.stringify({ modelId: 'm-1', title: 'New Topic' })
    })
    expect(result).toEqual(mockCreated)
  })

  it('updates conversation title via PATCH /chat/conversations/:id', async () => {
    const mockUpdated = { id: 'c-2', title: 'Renamed Topic', modelId: 'm-1', createdAt: '2026-01-01', updatedAt: '2026-01-01' }
    const requestSpy = vi.spyOn(apiModule, 'request').mockResolvedValue(mockUpdated as any)

    const result = await chatService.updateConversation('c-2', 'Renamed Topic')
    expect(requestSpy).toHaveBeenCalledWith('/chat/conversations/c-2', {
      method: 'PATCH',
      body: JSON.stringify({ title: 'Renamed Topic' })
    })
    expect(result).toEqual(mockUpdated)
  })

  it('sets conversation model via PATCH /chat/conversations/:id with modelId', async () => {
    const mockUpdated = { id: 'c-2', title: 'Renamed Topic', modelId: 'm-new', createdAt: '2026-01-01', updatedAt: '2026-01-01' }
    const requestSpy = vi.spyOn(apiModule, 'request').mockResolvedValue(mockUpdated as any)

    const result = await chatService.setModel('c-2', 'm-new')
    expect(requestSpy).toHaveBeenCalledWith('/chat/conversations/c-2', {
      method: 'PATCH',
      body: JSON.stringify({ modelId: 'm-new' })
    })
    expect(result.modelId).toBe('m-new')
  })

  it('deletes conversation via DELETE /chat/conversations/:id', async () => {
    const requestSpy = vi.spyOn(apiModule, 'request').mockResolvedValue(undefined as any)

    await chatService.deleteConversation('c-2')
    expect(requestSpy).toHaveBeenCalledWith('/chat/conversations/c-2', {
      method: 'DELETE'
    })
  })

  it('gets message history via GET /chat/conversations/:id/messages', async () => {
    const mockMessages = [{ id: 'msg-1', conversationId: 'c-1', role: 'user', content: 'hello', createdAt: '2026-01-01' }]
    const requestSpy = vi.spyOn(apiModule, 'request').mockResolvedValue(mockMessages as any)

    const result = await chatService.getMessages('c-1')
    expect(requestSpy).toHaveBeenCalledWith('/chat/conversations/c-1/messages')
    expect(result).toEqual(mockMessages)
  })

  it('sends message synchronously via POST /chat/conversations/:id/messages with Accept: application/json', async () => {
    const mockReply = { id: 'msg-2', conversationId: 'c-1', role: 'assistant', content: 'Hello there!', createdAt: '2026-01-01' }
    const requestSpy = vi.spyOn(apiModule, 'request').mockResolvedValue(mockReply as any)

    const result = await chatService.sendMessage('c-1', 'hello')
    expect(requestSpy).toHaveBeenCalledWith('/chat/conversations/c-1/messages', {
      method: 'POST',
      headers: {
        Accept: 'application/json'
      },
      body: JSON.stringify({ content: 'hello' })
    })
    expect(result).toEqual(mockReply)
  })

  it('streams response chunks via sendMessageStream', async () => {
    const tokens: string[] = []
    let doneId = ''

    // Mock response stream with SSE tokens
    const ssePayload = 'event: token\ndata: {"content":"Hello"}\n\nevent: token\ndata: {"content":" world"}\n\nevent: done\ndata: {"messageId":"msg-done-1"}\n\n'
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(ssePayload))
        controller.close()
      }
    })

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: stream
    } as any)

    await chatService.sendMessageStream(
      'c-1',
      'Tell me something',
      (token) => tokens.push(token),
      (msgId) => { doneId = msgId },
      () => {}
    )

    expect(tokens).toEqual(['Hello', ' world'])
    expect(doneId).toBe('msg-done-1')
  })
})

