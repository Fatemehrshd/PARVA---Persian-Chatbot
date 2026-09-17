import { ChatService } from '../src/modules/chat/chat.service';

function makeRepos() {
  const savedMsgs: any[] = [];
  let seq = 0;
  return {
    // NOTE: ChatService ctor order is (conv, msg, models, forwarder, settings?,
    // users?, activeStream?, fileRepo?, webSearch?) — the webSearch fake MUST be
    // the 9th argument (after an explicit fileRepo undefined), not the 8th.
    conv: { findOne: async () => ({ id: 'c1', userId: 'u1', modelId: 'm1' }), save: async (c: any) => c, create: (o: any) => o, update: async () => {} } as any,
    msg: {
      create: (o: any) => ({ ...o }),
      save: async (o: any) => { const m = { id: `s-${++seq}`, ...o }; savedMsgs.push(m); return m; },
      find: async () => [...savedMsgs],
      findOne: async () => null,
      count: async () => 1,
    } as any,
    savedMsgs,
  };
}

const base: any = {
  models: { getRawById: async () => null, getDefault: async () => null, resolveProvider: async () => null },
  forwarder: { resolveTarget: () => null },
};

it('emits searching → sources, injects sources into the prompt, saves sources', async () => {
  const { conv, msg, savedMsgs } = makeRepos();
  let seenMessages: any[] = [];
  const svc: any = new ChatService(conv, msg,
    { ...base.models, getDefault: async () => ({ id: 'm1', isActive: true }) },
    { resolveTarget: () => ({ apiIdentifier: 'x', apiKey: 'k', baseUrl: 'http://x' }), stream: async function* (_t: any, m: any[]) { seenMessages = m; yield 'hi'; } } as any,
    { getWebSearchEnabled: async () => true, getGlobalTokenLimit: async () => 0, getSystemPrompt: async () => 'sys' } as any,
    undefined, undefined, undefined,
    { search: async () => [{ title: 't', url: 'https://e.com', snippet: 's' }] } as any,
  );
  const chunks: any[] = [];
  for await (const c of svc.generate('u1', 'c1', 'news?', undefined, { useWebSearch: true })) chunks.push(c);
  expect(chunks[0]).toEqual({ searchStatus: 'searching' });
  expect(chunks.find((c) => c.sources)).toEqual({ sources: [{ title: 't', url: 'https://e.com', snippet: 's' }] });
  const sys = seenMessages.find((m) => m.role === 'system')?.content ?? '';
  expect(sys).toContain('https://e.com');
  expect(savedMsgs.find((m) => m.role === 'assistant')?.sources).toHaveLength(1);
});

it('on search failure continues without sources and notes it in the reply', async () => {
  const { conv, msg, savedMsgs } = makeRepos();
  const svc: any = new ChatService(conv, msg,
    { ...base.models, getDefault: async () => ({ id: 'm1', isActive: true }) },
    { resolveTarget: () => ({ apiIdentifier: 'x', apiKey: 'k', baseUrl: 'http://x' }), stream: async function* () { yield 'hi'; } } as any,
    { getWebSearchEnabled: async () => true, getGlobalTokenLimit: async () => 0, getSystemPrompt: async () => 'sys' } as any,
    undefined, undefined, undefined,
    { search: async () => { throw new Error('boom'); } } as any,
  );
  const chunks: any[] = [];
  for await (const c of svc.generate('u1', 'c1', 'news?', undefined, { useWebSearch: true })) chunks.push(c);
  expect(chunks).toContainEqual({ searchFailed: true });
  const saved = savedMsgs.find((m) => m.role === 'assistant');
  expect(saved?.sources ?? null).toBeNull();
  expect(saved?.content).toContain('جستجوی وب ناموفق بود');
});
