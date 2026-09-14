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
    const users: any = { findById: async () => null };
    // No credential anywhere -> offline echo fallback path.
    const forwarder: OpenAiCompatForwarder = { resolveTarget: () => null } as any;
    const s = new ChatService(conv, msg, models, users, forwarder);
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
    const s = new ChatService(
      conv,
      { find: async () => [] } as any,
      {} as any,
      {} as any,
      {} as any,
    );
    await expect(s.history('u1', 'nope')).rejects.toThrow('Resource not found');
  });
});
