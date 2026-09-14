import { BadRequestException, BadGatewayException } from '@nestjs/common';
import { ChatService } from '../src/modules/chat/chat.service';

/**
 * Real-provider chat semantics:
 *  - resolution order conversation-model -> platform default (unchanged);
 *  - a disabled model OR a disabled provider is a 400 BEFORE anything is saved;
 *  - with a credential: the reply comes from the forwarder stream, and the
 *    assistant message persists exactly what was streamed;
 *  - no credential anywhere: offline echo only (dev/test convenience);
 *  - forwarder failure BEFORE the first token propagates (502 upstream);
 *  - failure MID-STREAM persists the partial reply and completes normally.
 */

function makeRepos(convRow: any) {
  const savedMsgs: any[] = [];
  let seq = 0;
  const conv: any = {
    findOne: async () => convRow,
    save: async (c: any) => c,
    create: (o: any) => o,
    update: async () => {},
  };
  const msg: any = {
    create: (o: any) => ({ ...o }),
    save: async (o: any) => {
      const m = { id: `s-${++seq}`, createdAt: new Date(seq), ...o };
      savedMsgs.push(m);
      return m;
    },
    find: async () => [...savedMsgs],
  };
  return { conv, msg, savedMsgs };
}

function svcWith(opts: {
  convRow: any;
  model?: any;
  provider?: any;
  target?: any;
  streamImpl?: (target: any, messages: any[]) => AsyncGenerator<string>;
}) {
  const { conv, msg, savedMsgs } = makeRepos(opts.convRow);
  const models: any = {
    getRawById: async (id: string) => (opts.model && opts.model.id === id ? opts.model : null),
    getDefault: async () => opts.model ?? null,
    resolveProvider: async () => opts.provider ?? null,
  };
  const forwarder: any = {
    resolveTarget: () => opts.target ?? null,
    stream: (t: any, m: any[]) =>
      opts.streamImpl ? opts.streamImpl(t, m) : (async function* () {})(),
  };
  const users: any = { findById: async () => null };
  const svc = new ChatService(conv, msg, models, users, forwarder);
  return { svc, savedMsgs };
}

async function drain(gen: AsyncGenerator<any>) {
  let text = '';
  let saved: any;
  for await (const c of gen) {
    if (c.token) text += c.token;
    if (c.saved) saved = c.saved;
  }
  return { text, saved };
}

const activeModel = { id: 'm1', provider: 'openai', apiIdentifier: 'gpt-4o', isActive: true };
const conv = { id: 'c1', userId: 'u1', modelId: 'm1' };
const target = { apiIdentifier: 'gpt-4o', apiKey: 'sk-x', baseUrl: 'http://x' };

it('streams from the real forwarder when a target resolves; persists exactly the streamed text', async () => {
  let seenMessages: any;
  const { svc } = svcWith({
    convRow: conv,
    model: activeModel,
    provider: { id: 'p1', name: 'openai', isActive: true },
    target,
    streamImpl: async function* (_t: any, msgs: any[]) {
      seenMessages = msgs;
      yield 'Good ';
      yield 'morning.';
    },
  });
  const { text, saved } = await drain(svc.generate('u1', 'c1', 'hi'));
  expect(text).toBe('Good morning.');
  expect(saved.content).toBe('Good morning.');
  expect(seenMessages[0]).toEqual({
    role: 'system',
    content: 'You are a helpful and knowledgeable AI assistant.',
  });
});

it('a disabled provider is a 400 before the first chunk', async () => {
  const { svc, savedMsgs } = svcWith({
    convRow: conv,
    model: activeModel,
    provider: { id: 'p1', name: 'openai', isActive: false },
    target,
  });
  await expect(svc.generate('u1', 'c1', 'hi').next()).rejects.toBeInstanceOf(BadRequestException);
  expect(savedMsgs).toHaveLength(0);
});

it('an inactive model is still a 400 (unchanged behavior)', async () => {
  const { svc } = svcWith({
    convRow: conv,
    model: { ...activeModel, isActive: false },
  });
  await expect(svc.generate('u1', 'c1', 'hi').next()).rejects.toBeInstanceOf(BadRequestException);
});

it('without any credential the offline echo path answers and warns (never silently on failure)', async () => {
  const { svc, savedMsgs } = svcWith({ convRow: conv, model: activeModel, target: null });
  const { text, saved } = await drain(svc.generate('u1', 'c1', 'ping'));
  expect(text).toBe('Echo: ping');
  expect(savedMsgs.map((m) => m.role)).toEqual(['user', 'assistant']);
});

it('provider failing BEFORE the first token propagates as BadGateway (controller -> 502 envelope)', async () => {
  const { svc, savedMsgs } = svcWith({
    convRow: conv,
    model: activeModel,
    target,
    streamImpl: async function* () {
      throw new BadGatewayException('provider returned 401');
    },
  });
  await expect(svc.generate('u1', 'c1', 'hi').next()).rejects.toBeInstanceOf(BadGatewayException);
  // the user message was still persisted (the turn happened) — only no assistant message
  expect(savedMsgs.map((m) => m.role)).toEqual(['user']);
});

it('provider failing MID-STREAM persists the partial reply and still completes', async () => {
  const { svc } = svcWith({
    convRow: conv,
    model: activeModel,
    target,
    streamImpl: async function* () {
      yield 'half ';
      throw new BadGatewayException('connection reset');
    },
  });
  const { text, saved } = await drain(svc.generate('u1', 'c1', 'hi'));
  expect(text).toBe('half ');
  expect(saved.content).toBe('half ');
});

describe('setModel (mid-conversation switch)', () => {
  it('switches to an active model', async () => {
    const { svc } = svcWith({
      convRow: { ...conv },
      model: activeModel,
      provider: { id: 'p1', name: 'openai', isActive: true },
    });
    const c = await svc.setModel('u1', 'c1', 'm1');
    expect(c.modelId).toBe('m1');
  });
  it('unknown model -> 400', async () => {
    const { svc } = svcWith({ convRow: { ...conv }, model: undefined });
    await expect(svc.setModel('u1', 'c1', 'zzz')).rejects.toBeInstanceOf(BadRequestException);
  });
  it('disabled model -> 400', async () => {
    const { svc } = svcWith({ convRow: { ...conv }, model: { ...activeModel, isActive: false } });
    await expect(svc.setModel('u1', 'c1', 'm1')).rejects.toBeInstanceOf(BadRequestException);
  });
  it('model whose provider is disabled -> 400', async () => {
    const { svc } = svcWith({
      convRow: { ...conv },
      model: activeModel,
      provider: { id: 'p1', name: 'openai', isActive: false },
    });
    await expect(svc.setModel('u1', 'c1', 'm1')).rejects.toBeInstanceOf(BadRequestException);
  });
});
