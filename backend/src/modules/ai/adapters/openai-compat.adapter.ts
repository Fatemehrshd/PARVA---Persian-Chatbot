import type { StreamAdapter, StreamChunk, StreamRequestContext } from './stream-adapter';

export class OpenAiCompatAdapter implements StreamAdapter {
  readonly name = 'openai-compat';

  buildRequest(ctx: StreamRequestContext): { url: string; init: RequestInit } {
    const url = `${ctx.target.baseUrl}/chat/completions`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ctx.target.apiKey}`,
    };
    const body = JSON.stringify({
      model: ctx.target.apiIdentifier,
      messages: ctx.messages,
      stream: true,
    });
    return {
      url,
      init: {
        method: 'POST',
        headers,
        body,
        signal: ctx.options?.signal,
      },
    };
  }

  parseStreamChunk(payload: unknown): StreamChunk[] {
    if (!payload || typeof payload !== 'object') return [];
    const obj = payload as any;
    const choices = Array.isArray(obj.choices) ? obj.choices : [];
    if (choices.length === 0) return [];
    const delta = choices[0]?.delta;
    if (!delta || typeof delta !== 'object') return [];

    const out: StreamChunk[] = [];
    const reasoningText = delta.reasoning_content ?? delta.reasoning;
    if (typeof reasoningText === 'string' && reasoningText.length > 0) {
      out.push({ type: 'reasoning', text: reasoningText });
    }
    if (typeof delta.content === 'string' && delta.content.length > 0) {
      out.push({ type: 'content', text: delta.content });
    }
    return out;
  }
}
