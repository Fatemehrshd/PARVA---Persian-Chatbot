import type { StreamAdapter, StreamChunk, StreamRequestContext } from './stream-adapter';

export class OpenAiCompatAdapter implements StreamAdapter {
  readonly name = 'openai-compat';

  buildRequest(ctx: StreamRequestContext): { url: string; init: RequestInit } {
    const url = ctx.target.baseUrl.endsWith('/chat/completions')
      ? ctx.target.baseUrl
      : `${ctx.target.baseUrl}/chat/completions`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ctx.target.apiKey}`,
    };
    const bodyObj: any = {
      model: ctx.target.apiIdentifier,
      messages: ctx.messages,
      stream: true,
    };
    if (ctx.options?.useThinking) {
      if (ctx.target.thinkingBudgetTokens) {
        bodyObj.max_completion_tokens = ctx.target.thinkingBudgetTokens;
      }
      if (ctx.target.apiIdentifier.startsWith('o1') || ctx.target.apiIdentifier.startsWith('o3')) {
        bodyObj.reasoning_effort = 'medium';
      }
    }
    return {
      url,
      init: {
        method: 'POST',
        headers,
        body: JSON.stringify(bodyObj),
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
