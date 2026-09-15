import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { AiModel } from '../models-admin/ai-model.entity';
import { AiProvider } from '../models-admin/ai-provider.entity';

export interface ChatMessage {
  role: string;
  content: string;
}

export interface ResolvedTarget {
  apiIdentifier: string;
  apiKey: string;
  baseUrl: string;
}

/**
 * Talks to any OpenAI-compatible /chat/completions endpoint
 * (OpenAI, Ollama, LM Studio, vLLM, ...). Node 18+ global fetch — no SDK.
 *
 * Credential/baseUrl resolution (first hit wins):
 *   key:     model.apiKey -> provider.apiKey -> OPENAI_API_KEY (env, global fallback)
 *   baseUrl: model.baseUrl -> provider.baseUrl -> OPENAI_BASE_URL (env) -> https://api.openai.com/v1
 */
@Injectable()
export class OpenAiCompatForwarder {
  private readonly logger = new Logger(OpenAiCompatForwarder.name);

  resolveTarget(model: AiModel | null, provider: AiProvider | null): ResolvedTarget | null {
    const apiKey = model?.apiKey || provider?.apiKey || process.env.OPENAI_API_KEY || '';
    if (!apiKey) return null;
    const baseUrl = (
      model?.baseUrl ||
      provider?.baseUrl ||
      process.env.OPENAI_BASE_URL ||
      'https://api.openai.com/v1'
    ).replace(/\/+$/, '');
    return { apiIdentifier: model?.apiIdentifier || 'gpt-4o', apiKey, baseUrl };
  }

  /** Streams assistant deltas token-by-token from the upstream SSE response. */
  async *stream(target: ResolvedTarget, messages: ChatMessage[]): AsyncGenerator<string> {
    const url = target.baseUrl.endsWith('/chat/completions')
      ? target.baseUrl
      : `${target.baseUrl}/chat/completions`;
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${target.apiKey}`,
        },
        body: JSON.stringify({
          model: target.apiIdentifier,
          messages,
          stream: true,
        }),
      });
    } catch (err) {
      throw new BadGatewayException(
        `AI provider "${target.apiIdentifier}" unreachable: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new BadGatewayException(
        `AI provider "${target.apiIdentifier}" returned ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ''}`,
      );
    }
    if (!res.body) {
      throw new BadGatewayException('AI provider returned an empty response body');
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    let emitted = false;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, idx).trim();
        buf = buf.slice(idx + 1);
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (payload === '[DONE]') return;
        let delta: unknown;
        try {
          delta = JSON.parse(payload)?.choices?.[0]?.delta?.content;
        } catch {
          continue; // keep-alives / partial frames from the upstream
        }
        if (typeof delta === 'string' && delta) {
          emitted = true;
          yield delta;
        }
      }
    }
    if (!emitted) {
      this.logger.warn(`Provider "${target.apiIdentifier}" completed without any content`);
    }
  }

  /** Non-streaming completion for lightweight tasks (e.g., auto-title generation). */
  async complete(
    target: ResolvedTarget,
    messages: ChatMessage[],
    maxTokens = 60,
  ): Promise<string> {
    const url = target.baseUrl.endsWith('/chat/completions')
      ? target.baseUrl
      : `${target.baseUrl}/chat/completions`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${target.apiKey}`,
        },
        body: JSON.stringify({
          model: target.apiIdentifier,
          messages,
          max_tokens: maxTokens,
          stream: false,
        }),
      });
      if (!res.ok) {
        this.logger.warn(
          `AI provider non-streaming call returned ${res.status}: ${await res.text().catch(() => '')}`,
        );
        return '';
      }
      const json = await res.json();
      return json?.choices?.[0]?.message?.content?.trim() || '';
    } catch (err) {
      this.logger.warn(
        `AI provider non-streaming call failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return '';
    }
  }
}
