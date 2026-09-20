import type { StreamAdapter, StreamChunk, StreamRequestContext } from './stream-adapter';

/**
 * Detects the provider family from the baseUrl / apiIdentifier so the adapter
 * can emit the correct request shape and parse the right reasoning fields.
 *
 * Returns:
 *  'anthropic' – Claude models via Anthropic's OpenAI-compat endpoint
 *  'gemini'    – Gemini models via Google's OpenAI-compat endpoint
 *  'openai'    – OpenAI o-series (reasoning via delta.reasoning_content)
 *  'deepseek'  – DeepSeek R-series (reasoning via delta.reasoning_content)
 *  'generic'   – everything else (ThinkTag fallback only)
 */
export function detectProvider(
  baseUrl: string,
  apiIdentifier: string,
): 'anthropic' | 'gemini' | 'openai' | 'deepseek' | 'generic' {
  const url = (baseUrl || '').toLowerCase();
  const id = (apiIdentifier || '').toLowerCase();
  if (url.includes('anthropic.com') || url.includes('claude.ai') || id.startsWith('claude')) {
    return 'anthropic';
  }
  if (
    url.includes('generativelanguage.googleapis.com') ||
    url.includes('aiplatform.googleapis.com') ||
    id.startsWith('gemini') ||
    id.startsWith('google/')
  ) {
    return 'gemini';
  }
  if (url.includes('api.openai.com') || id.startsWith('o1') || id.startsWith('o3') || id.startsWith('o4')) {
    return 'openai';
  }
  if (url.includes('deepseek') || id.startsWith('deepseek')) {
    return 'deepseek';
  }
  return 'generic';
}

/**
 * Parses <think>...</think> and <thought>...</thought> tags out of streamed content.
 * - <think>  used by: Qwen/QwQ and other open-source models
 * - <thought> used by: Gemini via OpenAI-compat endpoint
 */
export class ThinkTagStreamParser {
  private inThinking = false;
  private pendingBuffer = '';

  // Both open-tag variants map to the same close-tag logic with different lengths
  private readonly OPEN_TAGS = ['<think>', '<thought>'];
  private readonly CLOSE_TAGS: Record<string, string> = {
    '<think>': '</think>',
    '<thought>': '</thought>',
  };
  private activeOpenTag = '';

  feedContent(chunk: string): StreamChunk[] {
    if (!chunk) return [];
    const out: StreamChunk[] = [];
    let text = this.pendingBuffer + chunk;
    this.pendingBuffer = '';

    while (text.length > 0) {
      if (!this.inThinking) {
        // Find the earliest opening tag
        let earliest = -1;
        let earliestTag = '';
        for (const tag of this.OPEN_TAGS) {
          const idx = text.indexOf(tag);
          if (idx !== -1 && (earliest === -1 || idx < earliest)) {
            earliest = idx;
            earliestTag = tag;
          }
        }

        if (earliest !== -1) {
          if (earliest > 0) {
            out.push({ type: 'content', text: text.slice(0, earliest) });
          }
          this.inThinking = true;
          this.activeOpenTag = earliestTag;
          text = text.slice(earliest + earliestTag.length);
        } else {
          // Check for partial match of any open tag at end of text
          const partialMatch = this.getPartialMultiTagMatch(text, this.OPEN_TAGS);
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
        const closeTag = this.CLOSE_TAGS[this.activeOpenTag] || '</think>';
        const endIdx = text.indexOf(closeTag);
        if (endIdx !== -1) {
          if (endIdx > 0) {
            out.push({ type: 'reasoning', text: text.slice(0, endIdx) });
          }
          this.inThinking = false;
          this.activeOpenTag = '';
          text = text.slice(endIdx + closeTag.length);
        } else {
          const partialMatch = this.getPartialTagMatch(text, closeTag);
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

  private getPartialMultiTagMatch(text: string, tags: string[]): number {
    let best = 0;
    for (const tag of tags) {
      const m = this.getPartialTagMatch(text, tag);
      if (m > best) best = m;
    }
    return best;
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
      const provider = detectProvider(ctx.target.baseUrl, ctx.target.apiIdentifier);

      if (provider === 'openai') {
        // OpenAI o-series: reasoning_effort activates CoT; max_completion_tokens caps it
        const isOSeries =
          ctx.target.apiIdentifier.startsWith('o1') ||
          ctx.target.apiIdentifier.startsWith('o3') ||
          ctx.target.apiIdentifier.startsWith('o4');
        if (isOSeries) {
          bodyObj.reasoning_effort = 'medium';
        }
        if (ctx.target.thinkingBudgetTokens) {
          bodyObj.max_completion_tokens = ctx.target.thinkingBudgetTokens;
        }

      } else if (provider === 'anthropic') {
        // Anthropic OpenAI-compat: thinking param is accepted but reasoning is NOT
        // returned in the response stream (it requires the native /v1/messages API).
        // We still send it so the model actually thinks; content is the final answer only.
        bodyObj.thinking = {
          type: 'enabled',
          budget_tokens: ctx.target.thinkingBudgetTokens || 8000,
        };

      } else if (provider === 'gemini') {
        // Gemini OpenAI-compat: thinking_config with include_thoughts enables
        // <thought>...</thought> tags embedded in delta.content chunks.
        bodyObj.extra_body = {
          google: {
            thinking_config: {
              thinking_budget: ctx.target.thinkingBudgetTokens || 8000,
              include_thoughts: true,
            },
          },
        };

      } else if (provider === 'deepseek') {
        // DeepSeek R-series: no special param needed — reasoning_content is always
        // returned in delta for R-series models when the model supports it.
        if (ctx.target.thinkingBudgetTokens) {
          bodyObj.max_tokens = ctx.target.thinkingBudgetTokens;
        }

      } else {
        // Generic / unknown: send max_completion_tokens if configured, rely on
        // ThinkTagStreamParser to extract <think> or <thought> from content.
        if (ctx.target.thinkingBudgetTokens) {
          bodyObj.max_completion_tokens = ctx.target.thinkingBudgetTokens;
        }
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

  /**
   * Parses a single SSE data payload into typed StreamChunks.
   *
   * Reasoning source priority (first hit wins):
   *   1. delta.reasoning_content  — DeepSeek R-series, OpenAI o-series
   *   2. delta.reasoning          — some OpenAI-compat proxies
   *   3. ThinkTagStreamParser     — Gemini (<thought>), Qwen (<think>), generic
   */
  parseStreamChunk(payload: unknown, parser?: ThinkTagStreamParser): StreamChunk[] {
    if (!payload || typeof payload !== 'object') return [];
    const obj = payload as any;
    const choices = Array.isArray(obj.choices) ? obj.choices : [];
    if (choices.length === 0) return [];
    const delta = choices[0]?.delta;
    if (!delta || typeof delta !== 'object') return [];

    const out: StreamChunk[] = [];

    // ── Path 1: explicit reasoning field (DeepSeek / OpenAI o-series) ────────
    const reasoningText = delta.reasoning_content ?? delta.reasoning;
    if (typeof reasoningText === 'string' && reasoningText.length > 0) {
      out.push({ type: 'reasoning', text: reasoningText });
    }

    // ── Path 2: content — run through ThinkTag parser for embedded tags ──────
    // Gemini sends <thought>…</thought> inside delta.content; the updated
    // ThinkTagStreamParser handles both <think> and <thought> variants.
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
