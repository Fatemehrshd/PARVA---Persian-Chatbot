import { BadGatewayException } from '@nestjs/common';
import { OpenAiCompatForwarder } from '../src/modules/ai/openai-compat.forwarder';

async function collect(it: AsyncIterable<string>): Promise<string[]> {
  const out: string[] = [];
  for await (const x of it) out.push(x);
  return out;
}

describe('OpenAiCompatForwarder.resolveTarget', () => {
  const env = { ...process.env };
  afterEach(() => {
    process.env = { ...env };
  });

  it('prefers model key, then provider key, then global env', () => {
    const f = new OpenAiCompatForwarder();
    delete process.env.OPENAI_API_KEY;
    expect(f.resolveTarget(null, null)).toBeNull(); // nothing -> offline echo path

    expect(f.resolveTarget({ apiKey: 'model-key' } as any, null)!.apiKey).toBe('model-key');
    expect(f.resolveTarget({} as any, { apiKey: 'provider-key' } as any)!.apiKey).toBe(
      'provider-key',
    );

    process.env.OPENAI_API_KEY = 'global-key';
    expect(f.resolveTarget({} as any, {} as any)!.apiKey).toBe('global-key');
  });

  it('resolves baseUrl precedence model > provider > env > default', () => {
    const f = new OpenAiCompatForwarder();
    delete process.env.OPENAI_BASE_URL;
    process.env.OPENAI_API_KEY = 'k';
    expect(f.resolveTarget({} as any, {} as any)!.baseUrl).toBe('https://api.openai.com/v1');
    expect(
      f.resolveTarget({ baseUrl: 'http://model/' } as any, { baseUrl: 'http://prov/' } as any)!
        .baseUrl,
    ).toBe('http://model');
    expect(f.resolveTarget({} as any, { baseUrl: 'http://prov' } as any)!.baseUrl).toBe(
      'http://prov',
    );
    process.env.OPENAI_BASE_URL = 'http://env-base';
    expect(f.resolveTarget({} as any, {} as any)!.baseUrl).toBe('http://env-base');
  });
});

describe('OpenAiCompatForwarder.stream', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  function sseBody(lines: string[]): any {
    const enc = new TextEncoder();
    const chunks = lines.map((l) => enc.encode(l));
    let i = 0;
    return {
      ok: true,
      status: 200,
      body: {
        getReader: () => ({
          read: async () =>
            i < chunks.length
              ? { done: false, value: chunks[i++] }
              : { done: true, value: undefined },
        }),
      },
    };
  }

  it('issues a stream:true request and yields parsed deltas, ignoring keep-alives', async () => {
    let captured: any;
    global.fetch = (async (url: string, init: any) => {
      captured = { url, init };
      return sseBody([
        'data: {"choices":[{"delta":{"content":"Hel"}}]}\n\n',
        ': ping\n\n',
        'data: {"choices":[{"delta":{"content":"lo"}}]}\n\n',
        'data: [DONE]\n\n',
      ]);
    }) as any;

    const f = new OpenAiCompatForwarder();
    const tokens = await collect(
      f.stream({ apiIdentifier: 'gpt-4o', apiKey: 'sk-1', baseUrl: 'http://x/v1' }, [
        { role: 'user', content: 'hi' },
      ]),
    );
    expect(tokens.join('')).toBe('Hello');
    expect(captured.url).toBe('http://x/v1/chat/completions');
    expect(captured.init.headers.Authorization).toBe('Bearer sk-1');
    expect(JSON.parse(captured.init.body)).toMatchObject({ model: 'gpt-4o', stream: true });
  });

  it('rejects with BadGateway on a non-2xx upstream response', async () => {
    global.fetch = (async () => ({
      ok: false,
      status: 429,
      text: async () => 'rate limited',
    })) as any;
    const f = new OpenAiCompatForwarder();
    await expect(
      collect(f.stream({ apiIdentifier: 'gpt-4o', apiKey: 'sk-1', baseUrl: 'http://x' }, [])),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('rejects with BadGateway when the transport throws before first token', async () => {
    global.fetch = (async () => {
      throw new Error('ECONNREFUSED');
    }) as any;
    const f = new OpenAiCompatForwarder();
    await expect(
      collect(f.stream({ apiIdentifier: 'gpt-4o', apiKey: 'sk-1', baseUrl: 'http://x' }, [])),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });
});
