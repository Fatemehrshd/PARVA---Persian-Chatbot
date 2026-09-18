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
});
