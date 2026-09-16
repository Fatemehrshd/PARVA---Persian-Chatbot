import { BadRequestException, NotFoundException, BadGatewayException } from '@nestjs/common';
import { ChatService } from '../src/modules/chat/chat.service';

/**
 * Chat streaming resilience & resume tests:
 *  - Interrupted stream persists with isInterrupted: true.
 *  - Normal completion persists with isInterrupted: false.
 *  - Resuming non-existent message throws NotFoundException.
 *  - Resuming a non-assistant message throws BadRequestException.
 *  - Resuming a message that was already completed normally throws BadRequestException.
 *  - Resuming seamlessly streams continuation, appends to message.content, and marks isInterrupted: false.
 *  - If resume itself fails mid-stream, partial continuation is preserved and isInterrupted stays true.
 *  - Resuming under offline mock adds continuation and marks isInterrupted: false.
 */

function makeRepos(convRow: any, initialMsgs: any[] = []) {
  const savedMsgs: any[] = [...initialMsgs];
  let seq = initialMsgs.length;
  const conv: any = {
    findOne: async () => convRow,
    save: async (c: any) => c,
    create: (o: any) => o,
    update: async () => {},
  };
  const msg: any = {
    create: (o: any) => ({ ...o }),
    save: async (o: any) => {
      if (o.id) {
        const idx = savedMsgs.findIndex((m) => m.id === o.id);
        if (idx >= 0) {
          savedMsgs[idx] = { ...o };
          return savedMsgs[idx];
        }
      }
      const m = { id: `msg-${++seq}`, createdAt: new Date(seq), ...o };
      savedMsgs.push(m);
      return m;
    },
    findOne: async ({ where }: any) => {
      return (
        savedMsgs.find((m) => {
          if (where.id && m.id !== where.id) return false;
          if (where.conversationId && m.conversationId !== where.conversationId) return false;
          return true;
        }) ?? null
      );
    },
    find: async () => [...savedMsgs],
  };
  return { conv, msg, savedMsgs };
}

function svcWith(opts: {
  convRow: any;
  initialMsgs?: any[];
  model?: any;
  provider?: any;
  target?: any;
  streamImpl?: (target: any, messages: any[]) => AsyncGenerator<string>;
}) {
  const { conv, msg, savedMsgs } = makeRepos(opts.convRow, opts.initialMsgs ?? []);
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
  const svc = new ChatService(conv, msg, models, forwarder, undefined, users, undefined);
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
const activeProvider = { id: 'p1', name: 'openai', isActive: true };
const conv = { id: 'c1', userId: 'u1', modelId: 'm1' };
const target = { apiIdentifier: 'gpt-4o', apiKey: 'sk-x', baseUrl: 'http://x' };

describe('Chat Streaming Resilience and Resumption', () => {
  it('marks assistant message as isInterrupted: false on normal stream completion', async () => {
    const { svc, savedMsgs } = svcWith({
      convRow: conv,
      model: activeModel,
      provider: activeProvider,
      target,
      streamImpl: async function* () {
        yield 'All ';
        yield 'done.';
      },
    });

    const { text, saved } = await drain(svc.generate('u1', 'c1', 'hello'));
    expect(text).toBe('All done.');
    expect(saved.content).toBe('All done.');
    expect(saved.isInterrupted).toBe(false);
  });

  it('marks assistant message as isInterrupted: true when provider fails mid-stream', async () => {
    const { svc, savedMsgs } = svcWith({
      convRow: conv,
      model: activeModel,
      provider: activeProvider,
      target,
      streamImpl: async function* () {
        yield 'First half of text... ';
        throw new BadGatewayException('Connection aborted by provider');
      },
    });

    const { text, saved } = await drain(svc.generate('u1', 'c1', 'write essay'));
    expect(text).toBe('First half of text... ');
    expect(saved.content).toBe('First half of text... ');
    expect(saved.isInterrupted).toBe(true);

    const assistantMsg = savedMsgs.find((m) => m.role === 'assistant');
    expect(assistantMsg).toBeDefined();
    expect(assistantMsg.isInterrupted).toBe(true);
  });

  it('throws NotFoundException when attempting to resume a message that does not exist', async () => {
    const { svc } = svcWith({
      convRow: conv,
      model: activeModel,
      provider: activeProvider,
      target,
    });

    await expect(svc.resume('u1', 'c1', 'non-existent-id').next()).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('throws BadRequestException when attempting to resume a user message', async () => {
    const userMsg = {
      id: 'user-msg-1',
      conversationId: 'c1',
      role: 'user',
      content: 'Hello AI',
      isInterrupted: false,
    };
    const { svc } = svcWith({
      convRow: conv,
      initialMsgs: [userMsg],
      model: activeModel,
      provider: activeProvider,
      target,
    });

    await expect(svc.resume('u1', 'c1', 'user-msg-1').next()).rejects.toThrow(
      'تنها پیام‌های پاسخ دستیار قابل ادامه دادن هستند',
    );
  });

  it('resumes seamlessly even if message was previously marked complete', async () => {
    const completeMsg = {
      id: 'asst-msg-1',
      conversationId: 'c1',
      role: 'assistant',
      content: 'This message completed normally.',
      isInterrupted: false,
    };
    const { svc, savedMsgs } = svcWith({
      convRow: conv,
      initialMsgs: [completeMsg],
      model: activeModel,
      provider: activeProvider,
      target,
      streamImpl: async function* () {
        yield ' And here is additional information.';
      },
    });

    const { text, saved } = await drain(svc.resume('u1', 'c1', 'asst-msg-1'));
    expect(text).toBe(' And here is additional information.');
    expect(saved.content).toBe('This message completed normally. And here is additional information.');
    expect(saved.isInterrupted).toBe(false);
    expect(saved.stoppedByUser).toBe(false);
  });

  it('resumes interrupted message, passes prior context and continuation prompt, appends tokens, and sets isInterrupted: false', async () => {
    const priorUser = {
      id: 'msg-u1',
      conversationId: 'c1',
      role: 'user',
      content: 'Write a poem about rain',
      isInterrupted: false,
    };
    const interruptedAsst = {
      id: 'msg-a1',
      conversationId: 'c1',
      role: 'assistant',
      content: 'The rain falls gently on the ',
      isInterrupted: true,
    };

    let passedMessages: any[] = [];
    const { svc, savedMsgs } = svcWith({
      convRow: conv,
      initialMsgs: [priorUser, interruptedAsst],
      model: activeModel,
      provider: activeProvider,
      target,
      streamImpl: async function* (_t, msgs) {
        passedMessages = msgs;
        yield 'leaves ';
        yield 'and cobblestones.';
      },
    });

    const { text, saved } = await drain(svc.resume('u1', 'c1', 'msg-a1'));
    // Stream yields only newly generated tokens
    expect(text).toBe('leaves and cobblestones.');
    // Result saved message has the full concatenated content
    expect(saved.content).toBe('The rain falls gently on the leaves and cobblestones.');
    expect(saved.isInterrupted).toBe(false);

    // Context passed to the provider includes prior messages, interrupted assistant content, and continuation instruction
    expect(passedMessages).toEqual([
      { role: 'system', content: 'You are a helpful and knowledgeable AI assistant.' },
      { role: 'user', content: 'Write a poem about rain' },
      { role: 'assistant', content: 'The rain falls gently on the ' },
      {
        role: 'user',
        content:
          'Please continue generating your previous response directly from where you stopped. Maintain the exact same language, tone, formatting, and structure (e.g., continue markdown tables, lists, or code blocks if interrupted mid-block). Do not repeat any words, phrases, or sentences from before. Do not add any conversational preamble or acknowledgments. Begin immediately with the next word.',
      },
    ]);

    // Database record is updated in place
    const updated = savedMsgs.find((m) => m.id === 'msg-a1');
    expect(updated.content).toBe('The rain falls gently on the leaves and cobblestones.');
    expect(updated.isInterrupted).toBe(false);
  });

  it('keeps isInterrupted: true and appends partial continuation if resume fails mid-stream again', async () => {
    const interruptedAsst = {
      id: 'msg-a2',
      conversationId: 'c1',
      role: 'assistant',
      content: 'Chapter 1: ',
      isInterrupted: true,
    };

    const { svc, savedMsgs } = svcWith({
      convRow: conv,
      initialMsgs: [interruptedAsst],
      model: activeModel,
      provider: activeProvider,
      target,
      streamImpl: async function* () {
        yield 'Once upon ';
        throw new BadGatewayException('Network dropped again');
      },
    });

    const { text } = await drain(svc.resume('u1', 'c1', 'msg-a2'));
    expect(text).toBe('Once upon ');

    const updated = savedMsgs.find((m) => m.id === 'msg-a2');
    expect(updated.content).toBe('Chapter 1: Once upon ');
    expect(updated.isInterrupted).toBe(true);
  });

  it('resumes using offline mock fallback when target is unconfigured', async () => {
    const interruptedAsst = {
      id: 'msg-a3',
      conversationId: 'c1',
      role: 'assistant',
      content: 'Echo: test',
      isInterrupted: true,
    };

    const { svc, savedMsgs } = svcWith({
      convRow: conv,
      initialMsgs: [interruptedAsst],
      model: activeModel,
      target: null,
    });

    const { text, saved } = await drain(svc.resume('u1', 'c1', 'msg-a3'));
    expect(text).toBe(' (resumed)');
    expect(saved.content).toBe('Echo: test (resumed)');
    expect(saved.isInterrupted).toBe(false);

    const updated = savedMsgs.find((m) => m.id === 'msg-a3');
    expect(updated.content).toBe('Echo: test (resumed)');
    expect(updated.isInterrupted).toBe(false);
  });

  it('resumes seamlessly when client sends a temporary client ID (msg-...) by resolving the latest interrupted message', async () => {
    const interruptedAsst = {
      id: 'real-db-uuid-1234',
      conversationId: 'c1',
      role: 'assistant',
      content: 'Here is part of ',
      isInterrupted: true,
    };

    const { svc, savedMsgs } = svcWith({
      convRow: conv,
      initialMsgs: [interruptedAsst],
      model: activeModel,
      provider: activeProvider,
      target,
      streamImpl: async function* () {
        yield 'the solution.';
      },
    });

    // Client passes client-side temporary ID 'msg-174829372' instead of 'real-db-uuid-1234'
    const { text, saved } = await drain(svc.resume('u1', 'c1', 'msg-174829372'));
    expect(text).toBe('the solution.');
    expect(saved.id).toBe('real-db-uuid-1234');
    expect(saved.content).toBe('Here is part of the solution.');
    expect(saved.isInterrupted).toBe(false);

    const updated = savedMsgs.find((m) => m.id === 'real-db-uuid-1234');
    expect(updated.content).toBe('Here is part of the solution.');
    expect(updated.isInterrupted).toBe(false);
  });

  it('stopMessage sets stoppedByUser: true and isInterrupted: false', async () => {
    const activeAsst = {
      id: 'active-msg-1',
      conversationId: 'c1',
      role: 'assistant',
      content: 'Partial response before stop',
      isInterrupted: true,
      stoppedByUser: false,
    };
    const { svc } = svcWith({
      convRow: conv,
      initialMsgs: [activeAsst],
      model: activeModel,
      provider: activeProvider,
      target,
    });

    const stopped = await svc.stopMessage('u1', 'c1', 'active-msg-1');
    expect(stopped.stoppedByUser).toBe(true);
    expect(stopped.isInterrupted).toBe(false);
  });
});
