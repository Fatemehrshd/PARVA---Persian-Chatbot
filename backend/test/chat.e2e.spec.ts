import { ChatService } from '../src/modules/chat/chat.service';
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
    const models: any = { getDefault: async () => ({ id: 'model1' }) };
    const s = new ChatService(conv, msg, models);
    const { reply, saved: m } = await s.answer('u1', 'c1', 'hello');
    expect(reply).toContain('hello');
    expect(m.role).toBe('assistant');
  });
  it('history of unknown conversation -> 404', async () => {
    const conv: any = { findOne: async () => null };
    const s = new ChatService(conv, { find: async () => [] } as any, {} as any);
    await expect(s.history('u1', 'nope')).rejects.toThrow('Resource not found');
  });
});
