import {
  BadGatewayException,
  GatewayTimeoutException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { AiModel } from '../models-admin/ai-model.entity';
import { AiProvider } from '../models-admin/ai-provider.entity';
import { OpenAiCompatAdapter, ThinkTagStreamParser } from './adapters/openai-compat.adapter';
import { tracedFetch } from '../../shared/traced-fetch';

export interface ChatMessage {
  role: string;
  content: string | any;
}

export interface ResolvedTarget {
  apiIdentifier: string;
  apiKey: string;
  baseUrl: string;
  thinkingBudgetTokens?: number | null;
}

export interface StreamOptions {
  signal?: AbortSignal;
  connectTimeoutMs?: number;
  stallTimeoutMs?: number;
  useThinking?: boolean;
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
  private readonly adapter = new OpenAiCompatAdapter();

  resolveTarget(model: AiModel | null, provider: AiProvider | null): ResolvedTarget | null {
    const apiKey = model?.apiKey || provider?.apiKey || process.env.OPENAI_API_KEY || '';
    if (!apiKey) return null;
    const baseUrl = (
      model?.baseUrl ||
      provider?.baseUrl ||
      process.env.OPENAI_BASE_URL ||
      'https://api.openai.com/v1'
    ).replace(/\/+$/, '');
    return {
      apiIdentifier: model?.apiIdentifier || 'gpt-4o',
      apiKey,
      baseUrl,
      thinkingBudgetTokens: model?.thinkingBudgetTokens ?? null,
    };
  }

  /**
   * Streams assistant deltas token-by-token from the upstream SSE response.
   * Yields string (for content deltas) or { reasoning: string } (for reasoning deltas).
   */
  async *stream(
    target: ResolvedTarget,
    messages: ChatMessage[],
    options?: StreamOptions,
  ): AsyncGenerator<any> {
    const req = this.adapter.buildRequest({ target, messages, options });
    const url = req.url;

    const connectTimeoutMs = options?.connectTimeoutMs ?? 15000;
    const defaultStall = options?.useThinking ? 35000 : 15000;
    const stallTimeoutMs = options?.stallTimeoutMs ?? defaultStall;

    const connectAbortCtrl = new AbortController();
    let timedOutReason: string | null = null;
    const connectTimer = setTimeout(() => {
      timedOutReason = 'connect_timeout';
      connectAbortCtrl.abort();
    }, connectTimeoutMs);

    const onUserAbort = () => {
      connectAbortCtrl.abort();
    };
    if (options?.signal) {
      options.signal.addEventListener('abort', onUserAbort, { once: true });
    }

    let res: Response;
    try {
      res = await tracedFetch(
        url,
        {
          ...req.init,
          signal: connectAbortCtrl.signal,
        },
        {
          name: 'ai.stream.completion',
          entityId: target.apiIdentifier,
          metadata: { model: target.apiIdentifier, baseUrl: target.baseUrl },
        },
      );
    } catch (err: any) {
      clearTimeout(connectTimer);
      if (options?.signal) {
        options.signal.removeEventListener('abort', onUserAbort);
      }
      if (timedOutReason === 'connect_timeout') {
        throw new GatewayTimeoutException(
          'زمان پاسخگویی مدل هوش مصنوعی به پایان رسید (Timeout)',
        );
      }
      if (options?.signal?.aborted) {
        return;
      }
      throw new BadGatewayException(
        `خطا در برقراری ارتباط با مدل هوش مصنوعی (${target.apiIdentifier}): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    } finally {
      clearTimeout(connectTimer);
      if (options?.signal) {
        options.signal.removeEventListener('abort', onUserAbort);
      }
    }

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      let friendly = `AI provider "${target.apiIdentifier}" returned ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ''}`;
      if (res.status === 503 || detail.toLowerCase().includes('high demand') || detail.includes('UNAVAILABLE')) {
        friendly = 'با عرض پوزش، به دلیل ترافیک بالای مدل هوش مصنوعی در این لحظه، لطفاً چند لحظه دیگر مجدداً پیام خود را ارسال فرمایید.';
      } else if (res.status === 429 || detail.toLowerCase().includes('quota') || detail.toLowerCase().includes('rate limit')) {
        friendly = 'سقف مجاز استفاده از این مدل به پایان رسیده است یا ترافیک بیش از حد مجاز است. لطفاً کمی بعد تلاش فرمایید.';
      }
      throw new BadGatewayException(friendly);
    }
    if (!res.body) {
      throw new BadGatewayException('AI provider returned an empty response body');
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    let emitted = false;
    let gotDone = false;
    let hasContentChunk = false;
    let rawNonDataBuf = '';

    const parseUpstreamError = (errObj: any): string => {
      const rawMsg = typeof errObj === 'string' ? errObj : (errObj?.message || JSON.stringify(errObj));
      const isHighDemand =
        errObj?.code === 503 ||
        rawMsg.toLowerCase().includes('high demand') ||
        errObj?.status === 'UNAVAILABLE';
      const isQuota =
        errObj?.code === 429 ||
        rawMsg.toLowerCase().includes('quota') ||
        rawMsg.toLowerCase().includes('rate limit') ||
        rawMsg.toLowerCase().includes('resource has been exhausted');
      if (isHighDemand) {
        return 'با عرض پوزش، به دلیل ترافیک بالای مدل هوش مصنوعی در این لحظه، لطفاً چند لحظه دیگر مجدداً پیام خود را ارسال فرمایید.';
      }
      if (isQuota) {
        return 'سقف مجاز استفاده از این مدل به پایان رسیده است یا ترافیک بیش از حد مجاز است. لطفاً کمی بعد تلاش فرمایید.';
      }
      return `خطا در ارتباط با مدل هوش مصنوعی: ${rawMsg}`;
    };

    const parser = new ThinkTagStreamParser();
    try {
      while (true) {
        if (options?.signal?.aborted) {
          await reader.cancel().catch(() => {});
          break;
        }

        let stallTimer: any;
        const stallPromise = new Promise<{ isTimeout: true }>((resolve) => {
          stallTimer = setTimeout(() => resolve({ isTimeout: true }), stallTimeoutMs);
        });

        const readPromise = reader.read();
        const result = await Promise.race([readPromise, stallPromise]);
        clearTimeout(stallTimer);

        if ('isTimeout' in result) {
          await reader.cancel().catch(() => {});
          throw new GatewayTimeoutException(
            'پاسخگویی مدل هوش مصنوعی به دلیل وقفه طولانی متوقف شد (Timeout)',
          );
        }

        const { done, value } = result;
        if (done) break;

        buf += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, idx).trim();
          buf = buf.slice(idx + 1);
          if (!line.startsWith('data:')) {
            // Buffer non-data lines to capture multi-line JSON error payloads from upstream
            if (line) {
              rawNonDataBuf += line + '\n';
              try {
                const rawParsed = JSON.parse(rawNonDataBuf.trim());
                const errObj = Array.isArray(rawParsed) ? rawParsed[0]?.error : rawParsed?.error;
                if (errObj) {
                  throw new BadGatewayException(parseUpstreamError(errObj));
                }
              } catch (e) {
                if (e instanceof BadGatewayException) throw e;
              }
            }
            continue;
          }
          const payload = line.slice(5).trim();
          if (payload === '[DONE]') {
            gotDone = true;
            const flushed = parser.flush();
            for (const chunk of flushed) {
              if (chunk.type === 'reasoning') {
                emitted = true;
                yield { reasoning: chunk.text };
              } else if (chunk.type === 'content') {
                emitted = true;
                hasContentChunk = true;
                yield chunk.text;
              }
            }
            return;
          }
          let parsed: any;
          try {
            parsed = JSON.parse(payload);
          } catch {
            continue; // keep-alives / partial frames from the upstream
          }
          if (parsed?.error) {
            throw new BadGatewayException(parseUpstreamError(parsed.error));
          }
          const chunks = this.adapter.parseStreamChunk(parsed, parser);
          for (const chunk of chunks) {
            if (chunk.type === 'reasoning') {
              emitted = true;
              yield { reasoning: chunk.text };
            } else if (chunk.type === 'content') {
              emitted = true;
              hasContentChunk = true;
              yield chunk.text;
            }
          }
        }
      }

      if (rawNonDataBuf.trim()) {
        try {
          const rawParsed = JSON.parse(rawNonDataBuf.trim());
          const errObj = Array.isArray(rawParsed) ? rawParsed[0]?.error : rawParsed?.error;
          if (errObj) {
            throw new BadGatewayException(parseUpstreamError(errObj));
          }
        } catch (e) {
          if (e instanceof BadGatewayException) throw e;
        }
      }

      // If the provider terminated the connection mid-stream without [DONE],
      // and only reasoning was ever emitted (never transitioning to content),
      // that is a premature connection drop (e.g. 503 high demand spike).
      if (!gotDone && !hasContentChunk && !options?.signal?.aborted) {
        throw new BadGatewayException(
          'با عرض پوزش، به دلیل ترافیک بالای مدل هوش مصنوعی در این لحظه، لطفاً چند لحظه دیگر مجدداً پیام خود را ارسال فرمایید.',
        );
      }

      const flushed = parser.flush();
      for (const chunk of flushed) {
        if (chunk.type === 'reasoning') {
          emitted = true;
          yield { reasoning: chunk.text };
        } else if (chunk.type === 'content') {
          emitted = true;
          hasContentChunk = true;
          yield chunk.text;
        }
      }
    } finally {
      if (typeof reader.cancel === 'function') {
        reader.cancel().catch(() => {});
      }
    }

    if (!emitted && !options?.signal?.aborted) {
      this.logger.warn(`Provider "${target.apiIdentifier}" completed without any content`);
      throw new BadGatewayException('مدل هوش مصنوعی هیچ پاسخی ارسال نکرد. لطفاً مجدداً تلاش فرمایید.');
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
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 3000);
    try {
      const res = await tracedFetch(
        url,
        {
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
          signal: ctrl.signal,
        },
        {
          name: 'ai.completion',
          entityId: target.apiIdentifier,
          metadata: { model: target.apiIdentifier },
        },
      );
      clearTimeout(timer);
      if (!res.ok) {
        this.logger.warn(
          `AI provider non-streaming call returned ${res.status}: ${await res.text().catch(() => '')}`,
        );
        return '';
      }
      const json = await res.json();
      return json?.choices?.[0]?.message?.content?.trim() || '';
    } catch (err) {
      clearTimeout(timer);
      this.logger.warn(
        `AI provider non-streaming call failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return '';
    }
  }

  /** Tests connectivity and responsiveness of a target endpoint with minimal payload. */
  async testTarget(
    target: ResolvedTarget,
    testPrompt = 'سلام',
  ): Promise<{ success: boolean; latencyMs: number; reply?: string; error?: string }> {
    const url = target.baseUrl.endsWith('/chat/completions')
      ? target.baseUrl
      : `${target.baseUrl}/chat/completions`;
    const start = Date.now();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12000);

    try {
      const res = await tracedFetch(
        url,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${target.apiKey}`,
          },
          body: JSON.stringify({
            model: target.apiIdentifier,
            messages: [{ role: 'user', content: testPrompt }],
            max_tokens: 35,
            stream: false,
          }),
          signal: ctrl.signal,
        },
        {
          name: 'ai.testTarget',
          entityId: target.apiIdentifier,
          metadata: { model: target.apiIdentifier },
        },
      );
      clearTimeout(timer);
      const latencyMs = Date.now() - start;

      if (!res.ok) {
        const raw = await res.text().catch(() => '');
        let errMsg = `خطای سرور (${res.status})`;
        try {
          const parsed = JSON.parse(raw);
          if (parsed.error?.message) errMsg = parsed.error.message;
        } catch {}
        return { success: false, latencyMs, error: errMsg };
      }

      const json = await res.json();
      const reply = json?.choices?.[0]?.message?.content?.trim() || 'پاسخ دریافت شد';
      return { success: true, latencyMs, reply };
    } catch (err: any) {
      clearTimeout(timer);
      const latencyMs = Date.now() - start;
      const error =
        err?.name === 'AbortError'
          ? 'زمان انتظار برای پاسخ مدل به پایان رسید (تایم‌اوت ۱۲ ثانیه)'
          : err?.message || 'خطا در برقراری ارتباط با مدل';
      return { success: false, latencyMs, error };
    }
  }
}
