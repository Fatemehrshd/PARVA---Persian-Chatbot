import type { StreamAdapter, StreamChunk, StreamRequestContext } from './stream-adapter';

export class ThinkTagStreamParser {
  private inThinking = false;
  private pendingBuffer = '';

  feedContent(chunk: string): StreamChunk[] {
    if (!chunk) return [];
    const out: StreamChunk[] = [];
    let text = this.pendingBuffer + chunk;
    this.pendingBuffer = '';

    while (text.length > 0) {
      if (!this.inThinking) {
        const thinkIdx = text.indexOf('<think>');
        if (thinkIdx !== -1) {
          if (thinkIdx > 0) {
            out.push({ type: 'content', text: text.slice(0, thinkIdx) });
          }
          this.inThinking = true;
          text = text.slice(thinkIdx + 7);
        } else {
          const partialMatch = this.getPartialTagMatch(text, '<think>');
          if (partialMatch > 0) {
            const emitLen = text.length - partialMatch;
            if (emitLen > 0) {
              out.push({ type: 'content', text: text.slice(0, emitLen) });
            }
            this.pendingBuffer = text.slice(emitLen);
            text = '';
          } else {
            out.push({ type: 'content', text });
            text = '';
          }
        }
      } else {
        const endThinkIdx = text.indexOf('</think>');
        if (endThinkIdx !== -1) {
          if (endThinkIdx > 0) {
            out.push({ type: 'reasoning', text: text.slice(0, endThinkIdx) });
          }
          this.inThinking = false;
          text = text.slice(endThinkIdx + 8);
        } else {
          const partialMatch = this.getPartialTagMatch(text, '</think>');
          if (partialMatch > 0) {
            const emitLen = text.length - partialMatch;
            if (emitLen > 0) {
              out.push({ type: 'reasoning', text: text.slice(0, emitLen) });
            }
            this.pendingBuffer = text.slice(emitLen);
            text = '';
          } else {
            out.push({ type: 'reasoning', text });
            text = '';
          }
        }
      }
    }

    return out;
  }

  flush(): StreamChunk[] {
    if (!this.pendingBuffer) return [];
    const text = this.pendingBuffer;
    this.pendingBuffer = '';
    return [{ type: this.inThinking ? 'reasoning' : 'content', text }];
  }

  private getPartialTagMatch(text: string, tag: string): number {
    const maxCheck = Math.min(text.length, tag.length - 1);
    for (let len = maxCheck; len >= 1; len--) {
      if (text.endsWith(tag.slice(0, len))) {
        return len;
      }
    }
    return 0;
  }
}

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

  parseStreamChunk(payload: unknown, parser?: ThinkTagStreamParser): StreamChunk[] {
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
      if (parser) {
        out.push(...parser.feedContent(delta.content));
      } else {
        out.push({ type: 'content', text: delta.content });
      }
    }
    return out;
  }
}
