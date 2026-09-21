import { OpenAiCompatAdapter } from '../src/modules/ai/adapters/openai-compat.adapter';

describe('OpenAiCompatAdapter', () => {
  const adapter = new OpenAiCompatAdapter();
  const target: any = { apiIdentifier: 'deepseek-reasoner', apiKey: 'test-key', baseUrl: 'https://api.openai.com/v1' };

  it('builds standard chat completions request with streaming', () => {
    const { url, init } = adapter.buildRequest({ target, messages: [{ role: 'user', content: 'hello' }] });
    expect(url).toBe('https://api.openai.com/v1/chat/completions');
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe('deepseek-reasoner');
    expect(body.stream).toBe(true);
  });

  it('passes max_completion_tokens and reasoning_effort when thinking is enabled', () => {
    const targetWithBudget = {
      apiIdentifier: 'o3-mini',
      apiKey: 'test-key',
      baseUrl: 'https://api.openai.com/v1',
      thinkingBudgetTokens: 4096,
    };
    const { url, init } = adapter.buildRequest({
      target: targetWithBudget,
      messages: [{ role: 'user', content: 'think hard' }],
      options: { useThinking: true },
    });
    expect(url).toBe('https://api.openai.com/v1/chat/completions');
    const body = JSON.parse(init.body as string);
    expect(body.max_completion_tokens).toBe(4096);
    expect(body.reasoning_effort).toBe('medium');
  });

  it('normalizes baseUrl that already includes /chat/completions', () => {
    const targetCustom = {
      apiIdentifier: 'deepseek-reasoner',
      apiKey: 'test-key',
      baseUrl: 'https://custom-proxy.com/v1/chat/completions',
    };
    const { url } = adapter.buildRequest({ target: targetCustom, messages: [] });
    expect(url).toBe('https://custom-proxy.com/v1/chat/completions');
  });

  it('extracts content and reasoning deltas separately', () => {
    expect(adapter.parseStreamChunk({ choices: [{ delta: { content: 'hello' } }] })).toEqual([
      { type: 'content', text: 'hello' },
    ]);
    expect(adapter.parseStreamChunk({ choices: [{ delta: { reasoning_content: 'thinking deep' } }] })).toEqual([
      { type: 'reasoning', text: 'thinking deep' },
    ]);
    expect(adapter.parseStreamChunk({ choices: [{ delta: { reasoning: 'alternative reasoning field' } }] })).toEqual([
      { type: 'reasoning', text: 'alternative reasoning field' },
    ]);
  });

  it('handles chunk with both reasoning and content, reasoning first', () => {
    expect(
      adapter.parseStreamChunk({ choices: [{ delta: { reasoning_content: 'r-part', content: 'c-part' } }] }),
    ).toEqual([
      { type: 'reasoning', text: 'r-part' },
      { type: 'content', text: 'c-part' },
    ]);
  });

  it('safely ignores empty or malformed deltas', () => {
    expect(adapter.parseStreamChunk({ choices: [{ delta: {} }] })).toEqual([]);
    expect(adapter.parseStreamChunk({})).toEqual([]);
    expect(adapter.parseStreamChunk(null)).toEqual([]);
    expect(adapter.parseStreamChunk('not-json')).toEqual([]);
  });

  describe('ThinkTagStreamParser & <think> tag extraction', () => {
    it('extracts <think>...</think> from delta.content when parser is provided', () => {
      const { ThinkTagStreamParser } = require('../src/modules/ai/adapters/openai-compat.adapter');
      const parser = new ThinkTagStreamParser();

      // Chunk 1: <think>Let's analyze
      const c1 = adapter.parseStreamChunk(
        { choices: [{ delta: { content: '<think>Let\'s analyze' } }] },
        parser,
      );
      expect(c1).toEqual([{ type: 'reasoning', text: "Let's analyze" }]);

      // Chunk 2:  step by step.</think>The answer is 42.
      const c2 = adapter.parseStreamChunk(
        { choices: [{ delta: { content: ' step by step.</think>The answer is 42.' } }] },
        parser,
      );
      expect(c2).toEqual([
        { type: 'reasoning', text: ' step by step.' },
        { type: 'content', text: 'The answer is 42.' },
      ]);
    });

    it('handles tags split across chunk boundaries', () => {
      const { ThinkTagStreamParser } = require('../src/modules/ai/adapters/openai-compat.adapter');
      const parser = new ThinkTagStreamParser();

      // Split '<think>' into '<th' and 'ink>Reasoning'
      const c1 = parser.feedContent('<th');
      expect(c1).toEqual([]);

      const c2 = parser.feedContent('ink>Reasoning');
      expect(c2).toEqual([{ type: 'reasoning', text: 'Reasoning' }]);

      // Split '</think>' into '</th' and 'ink>Final'
      const c3 = parser.feedContent('</th');
      expect(c3).toEqual([]);

      const c4 = parser.feedContent('ink>Final');
      expect(c4).toEqual([{ type: 'content', text: 'Final' }]);
    });

    it('flushes unclosed partial tag buffer cleanly at stream end', () => {
      const { ThinkTagStreamParser } = require('../src/modules/ai/adapters/openai-compat.adapter');
      const parser = new ThinkTagStreamParser();

      const c1 = parser.feedContent('<think>Unfinished thoughts</th');
      expect(c1).toEqual([{ type: 'reasoning', text: 'Unfinished thoughts' }]);

      const flushed = parser.flush();
      expect(flushed).toEqual([{ type: 'reasoning', text: '</th' }]);
    });
  });
});

// ─── detectProvider ──────────────────────────────────────────────────────────
import { detectProvider } from '../src/modules/ai/adapters/openai-compat.adapter';

describe('detectProvider', () => {
  it('detects anthropic by baseUrl', () => {
    expect(detectProvider('https://api.anthropic.com/v1', 'claude-3-5-sonnet')).toBe('anthropic');
  });

  it('detects anthropic by model id prefix', () => {
    expect(detectProvider('https://proxy.example.com/v1', 'claude-opus-4')).toBe('anthropic');
  });

  it('detects gemini by googleapis baseUrl', () => {
    expect(detectProvider('https://generativelanguage.googleapis.com/v1beta/openai', 'gemini-2.5-flash')).toBe('gemini');
  });

  it('detects gemini by model id prefix', () => {
    expect(detectProvider('https://some-proxy.com/v1', 'gemini-2.0-flash-thinking')).toBe('gemini');
  });

  it('detects openai by baseUrl', () => {
    expect(detectProvider('https://api.openai.com/v1', 'gpt-4o')).toBe('openai');
  });

  it('detects openai o-series by model id', () => {
    expect(detectProvider('https://proxy.example.com/v1', 'o3-mini')).toBe('openai');
    expect(detectProvider('https://proxy.example.com/v1', 'o4-mini')).toBe('openai');
  });

  it('detects deepseek by baseUrl', () => {
    expect(detectProvider('https://api.deepseek.com/v1', 'deepseek-reasoner')).toBe('deepseek');
  });

  it('falls back to generic for unknown providers', () => {
    expect(detectProvider('https://ollama.local/v1', 'llama3')).toBe('generic');
    expect(detectProvider('https://custom.proxy.com/v1', 'qwen2.5-72b')).toBe('generic');
  });
});

// ─── buildRequest per-provider ───────────────────────────────────────────────
describe('OpenAiCompatAdapter.buildRequest — per-provider thinking params', () => {
  const adapter = new OpenAiCompatAdapter();

  it('sends reasoning_effort=medium for OpenAI o-series when thinking enabled', () => {
    const target: any = { apiIdentifier: 'o3-mini', apiKey: 'k', baseUrl: 'https://api.openai.com/v1' };
    const body = JSON.parse(adapter.buildRequest({ target, messages: [], options: { useThinking: true } }).init.body as string);
    expect(body.reasoning_effort).toBe('medium');
    expect(body.thinking).toBeUndefined();
    expect(body.extra_body).toBeUndefined();
  });

  it('caps tokens with max_completion_tokens for OpenAI o-series when budget set', () => {
    const target: any = { apiIdentifier: 'o4-mini', apiKey: 'k', baseUrl: 'https://api.openai.com/v1', thinkingBudgetTokens: 2048 };
    const body = JSON.parse(adapter.buildRequest({ target, messages: [], options: { useThinking: true } }).init.body as string);
    expect(body.max_completion_tokens).toBe(2048);
  });

  it('sends thinking object for Anthropic when thinking enabled', () => {
    const target: any = { apiIdentifier: 'claude-opus-4', apiKey: 'k', baseUrl: 'https://api.anthropic.com/v1' };
    const body = JSON.parse(adapter.buildRequest({ target, messages: [], options: { useThinking: true } }).init.body as string);
    expect(body.thinking).toEqual({ type: 'enabled', budget_tokens: 8000 });
    expect(body.reasoning_effort).toBeUndefined();
  });

  it('uses thinkingBudgetTokens for Anthropic when set', () => {
    const target: any = { apiIdentifier: 'claude-sonnet-4', apiKey: 'k', baseUrl: 'https://api.anthropic.com/v1', thinkingBudgetTokens: 5000 };
    const body = JSON.parse(adapter.buildRequest({ target, messages: [], options: { useThinking: true } }).init.body as string);
    expect(body.thinking.budget_tokens).toBe(5000);
  });

  it('sends extra_body.google.thinking_config for Gemini when thinking enabled', () => {
    const target: any = { apiIdentifier: 'gemini-2.5-flash', apiKey: 'k', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai' };
    const body = JSON.parse(adapter.buildRequest({ target, messages: [], options: { useThinking: true } }).init.body as string);
    expect(body.extra_body?.google?.thinking_config?.include_thoughts).toBe(true);
    expect(body.extra_body?.google?.thinking_config?.thinking_budget).toBe(8000);
    expect(body.thinking).toBeUndefined();
  });

  it('uses thinkingBudgetTokens for Gemini when set', () => {
    const target: any = { apiIdentifier: 'gemini-2.5-pro', apiKey: 'k', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', thinkingBudgetTokens: 3000 };
    const body = JSON.parse(adapter.buildRequest({ target, messages: [], options: { useThinking: true } }).init.body as string);
    expect(body.extra_body.google.thinking_config.thinking_budget).toBe(3000);
  });

  it('sends no special thinking params for DeepSeek (model natively returns reasoning_content)', () => {
    const target: any = { apiIdentifier: 'deepseek-r1', apiKey: 'k', baseUrl: 'https://api.deepseek.com/v1' };
    const body = JSON.parse(adapter.buildRequest({ target, messages: [], options: { useThinking: true } }).init.body as string);
    expect(body.thinking).toBeUndefined();
    expect(body.reasoning_effort).toBeUndefined();
    expect(body.extra_body).toBeUndefined();
  });

  it('does NOT add thinking params when useThinking is false', () => {
    const target: any = { apiIdentifier: 'gemini-2.5-flash', apiKey: 'k', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai' };
    const body = JSON.parse(adapter.buildRequest({ target, messages: [], options: { useThinking: false } }).init.body as string);
    expect(body.extra_body).toBeUndefined();
  });
});

// ─── ThinkTagStreamParser — <thought> tag (Gemini) ───────────────────────────
describe('ThinkTagStreamParser — <thought> tag support (Gemini)', () => {
  it('extracts <thought>...</thought> as reasoning chunks', () => {
    const { ThinkTagStreamParser } = require('../src/modules/ai/adapters/openai-compat.adapter');
    const parser = new ThinkTagStreamParser();

    const c1 = parser.feedContent('<thought>Gemini is thinking');
    expect(c1).toEqual([{ type: 'reasoning', text: 'Gemini is thinking' }]);

    const c2 = parser.feedContent(' carefully</thought>Here is the answer.');
    expect(c2).toEqual([
      { type: 'reasoning', text: ' carefully' },
      { type: 'content', text: 'Here is the answer.' },
    ]);
  });

  it('handles <thought> tag split across chunk boundaries', () => {
    const { ThinkTagStreamParser } = require('../src/modules/ai/adapters/openai-compat.adapter');
    const parser = new ThinkTagStreamParser();

    const c1 = parser.feedContent('<thou');
    expect(c1).toEqual([]);  // pending buffer

    const c2 = parser.feedContent('ght>reasoning here</thought>final');
    expect(c2).toEqual([
      { type: 'reasoning', text: 'reasoning here' },
      { type: 'content', text: 'final' },
    ]);
  });

  it('handles </thought> closing tag split across boundaries', () => {
    const { ThinkTagStreamParser } = require('../src/modules/ai/adapters/openai-compat.adapter');
    const parser = new ThinkTagStreamParser();

    parser.feedContent('<thought>thinking');
    const c1 = parser.feedContent('</thou');
    expect(c1).toEqual([]);  // partial close tag buffered

    const c2 = parser.feedContent('ght>answer');
    expect(c2).toEqual([{ type: 'content', text: 'answer' }]);
  });

  it('handles both <think> and <thought> in the same stream independently', () => {
    const { ThinkTagStreamParser } = require('../src/modules/ai/adapters/openai-compat.adapter');
    const p1 = new ThinkTagStreamParser();
    const p2 = new ThinkTagStreamParser();

    const think = p1.feedContent('<think>step1</think>answer1');
    expect(think).toEqual([
      { type: 'reasoning', text: 'step1' },
      { type: 'content', text: 'answer1' },
    ]);

    const thought = p2.feedContent('<thought>step2</thought>answer2');
    expect(thought).toEqual([
      { type: 'reasoning', text: 'step2' },
      { type: 'content', text: 'answer2' },
    ]);
  });

  it('parseStreamChunk extracts <thought> via parser for Gemini-style delta', () => {
    const { ThinkTagStreamParser } = require('../src/modules/ai/adapters/openai-compat.adapter');
    const parser = new ThinkTagStreamParser();
    const adapter = new OpenAiCompatAdapter();

    const c1 = adapter.parseStreamChunk(
      { choices: [{ delta: { content: '<thought>Gemini reasoning' } }] },
      parser,
    );
    expect(c1).toEqual([{ type: 'reasoning', text: 'Gemini reasoning' }]);

    const c2 = adapter.parseStreamChunk(
      { choices: [{ delta: { content: '</thought>Final answer.' } }] },
      parser,
    );
    expect(c2).toEqual([{ type: 'content', text: 'Final answer.' }]);
  });
});
