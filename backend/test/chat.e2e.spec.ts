import { ChatService } from '../src/modules/chat/chat.service';
import { OpenAiCompatForwarder } from '../src/modules/ai/openai-compat.forwarder';

describe('Chat (behavior)', () => {
  it('send message returns assistant reply and saves', async () => {
    const conv: any = { findOne: async () => ({ id: 'c1' }), update: async () => {} };
    const saved: any[] = [];
    const msg: any = {
      find: async () => saved,
      create: (d: any) => d,
      save: async (d: any) => {
        const m = { id: 'm' + saved.length, createdAt: new Date(), ...d };
        saved.push(m);
        return m;
      },
    };
    const models: any = {
      getDefault: async () => ({ id: 'model1' }),
      resolveProvider: async () => null,
    };
    // No credential anywhere -> offline echo fallback path.
    const forwarder: OpenAiCompatForwarder = { resolveTarget: () => null } as any;
    const s = new ChatService(conv, msg, models, forwarder);
    let reply = '';
    let m: any;
    for await (const c of s.generate('u1', 'c1', 'hello')) {
      if (c.token) reply += c.token;
      if (c.saved) m = c.saved;
    }
    expect(reply).toContain('hello');
    expect(m.role).toBe('assistant');
    expect(m.content).toBe(reply);
  });
  it('history of unknown conversation -> 404', async () => {
    const conv: any = { findOne: async () => null };
    const s = new ChatService(conv, { find: async () => [] } as any, {} as any, {} as any);
    await expect(s.history('u1', 'nope')).rejects.toThrow('Resource not found');
  });

  it('reuses existing empty conversation without creating a duplicate', async () => {
    const existingEmptyConv = { id: 'conv-empty-1', userId: 'u1', modelId: 'm1', title: 'Empty Conv' };
    const conv: any = {
      findOne: async ({ where }: any) => {
        if (where.userId === 'u1') return existingEmptyConv;
        return null;
      },
      create: jest.fn(),
      save: jest.fn(async (c: any) => c),
    };
    const msg: any = {
      count: async ({ where }: any) => {
        if (where.conversationId === 'conv-empty-1') return 0; // 0 messages
        return 5;
      },
    };
    const s = new ChatService(conv, msg, { getDefault: async () => ({ id: 'm1' }) } as any, {} as any);
    const result = await s.create('u1');
    expect(result.id).toBe('conv-empty-1');
    expect(conv.create).not.toHaveBeenCalled();
  });

  it('searches conversations and returns deduplicated results', async () => {
    const mockQueryBuilderConv: any = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([{ id: 'c1', title: 'React Hooks Guide', updatedAt: '2026-09-15' }]),
    };
    const mockQueryBuilderMsg: any = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([
        {
          msgId: 'm1',
          conversationId: 'c2',
          content: 'Here is how to use Vue 3 reactivity and hooks in your app',
          msgCreatedAt: '2026-09-15',
          convTitle: 'Vue Tutorial',
          convUpdatedAt: '2026-09-15',
        },
      ]),
    };
    const conv: any = {
      createQueryBuilder: jest.fn(() => mockQueryBuilderConv),
    };
    const msg: any = {
      createQueryBuilder: jest.fn(() => mockQueryBuilderMsg),
    };
    const s = new ChatService(conv, msg, {} as any, {} as any);
    const results = await s.search('u1', 'hooks');
    expect(results).toHaveLength(2);
    expect(results[0].id).toBe('c1');
    expect(results[0].matchedIn).toBe('title');
    expect(results[1].id).toBe('c2');
    expect(results[1].matchedIn).toBe('message');
    expect(results[1].snippet).toContain('reactivity and hooks');
  });

  it('automatically generates and saves title on first user message', async () => {
    let updatedTitle = '';
    const conv: any = {
      findOne: async () => ({ id: 'c-new', userId: 'u1', title: 'New conversation' }),
      update: async (_id: string, data: any) => {
        if (data?.title) updatedTitle = data.title;
      },
    };
    const saved: any[] = [];
    const msg: any = {
      count: async () => 0, // 0 messages before this
      find: async () => saved,
      create: (d: any) => d,
      save: async (d: any) => {
        const m = { id: 'm' + saved.length, createdAt: new Date(), ...d };
        saved.push(m);
        return m;
      },
    };
    const models: any = {
      getDefault: async () => ({ id: 'model1' }),
      resolveProvider: async () => null,
    };
    const forwarder: any = {
      resolveTarget: () => ({ apiIdentifier: 'gpt-4o', apiKey: 'test', baseUrl: 'http://ai' }),
      stream: async function* () {
        yield 'Hello ';
        yield 'world';
      },
      complete: async () => 'راهنمای برنامه‌نویسی پایتون',
    };

    const s = new ChatService(conv, msg, models, forwarder);
    let titleEmitted = '';
    for await (const chunk of s.generate('u1', 'c-new', 'چگونه پایتون یاد بگیرم؟')) {
      if (chunk.title) titleEmitted = chunk.title;
    }

    expect(titleEmitted).toBe('راهنمای برنامه‌نویسی پایتون');
    expect(updatedTitle).toBe('راهنمای برنامه‌نویسی پایتون');
  });
});
