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
