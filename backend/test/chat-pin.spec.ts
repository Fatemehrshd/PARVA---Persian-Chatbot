import { ChatService } from '../src/modules/chat/chat.service';

describe('ChatService Pinning', () => {
  it('setPinned updates isPinned and saves', async () => {
    let savedConv: any = null;
    const mockConv = { id: 'c1', userId: 'u1', isPinned: false };
    const convRepo: any = {
      findOne: jest.fn().mockResolvedValue(mockConv),
      save: jest.fn().mockImplementation(async (c: any) => {
        savedConv = c;
        return c;
      }),
    };
    const s = new ChatService(convRepo, {} as any, {} as any, {} as any);

    const result = await s.setPinned('u1', 'c1', true);
    expect(result.isPinned).toBe(true);
    expect(savedConv.isPinned).toBe(true);
    expect(convRepo.save).toHaveBeenCalled();
  });

  it('togglePin toggles isPinned from false to true and vice versa', async () => {
    const mockConv = { id: 'c1', userId: 'u1', isPinned: false };
    const convRepo: any = {
      findOne: jest.fn().mockResolvedValue(mockConv),
      save: jest.fn().mockImplementation(async (c: any) => c),
    };
    const s = new ChatService(convRepo, {} as any, {} as any, {} as any);

    const res1 = await s.togglePin('u1', 'c1');
    expect(res1.isPinned).toBe(true);

    mockConv.isPinned = true;
    const res2 = await s.togglePin('u1', 'c1');
    expect(res2.isPinned).toBe(false);
  });

  it('list orders conversations by isPinned DESC then updatedAt DESC', async () => {
    const mockSubQb: any = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getQuery: jest.fn().mockReturnValue('SELECT 1'),
    };
    const mockQb: any = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockImplementation((arg: any) => {
        if (typeof arg === 'function') arg({ subQuery: () => mockSubQb });
        return mockQb;
      }),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        { id: 'c-pinned', isPinned: true, updatedAt: new Date('2026-01-01') },
        { id: 'c-normal', isPinned: false, updatedAt: new Date('2026-01-02') },
      ]),
    };
    const convRepo: any = {
      createQueryBuilder: jest.fn(() => mockQb),
    };
    const s = new ChatService(convRepo, {} as any, {} as any, {} as any);

    const list = await s.list('u1', 10, 1);
    expect(mockQb.orderBy).toHaveBeenCalledWith('conv.isPinned', 'DESC');
    expect(mockQb.addOrderBy).toHaveBeenCalledWith('conv.updatedAt', 'DESC');
    expect(list[0].id).toBe('c-pinned');
  });
});
