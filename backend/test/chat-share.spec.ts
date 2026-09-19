import { ChatShareService } from '../src/modules/chat/chat-share.service';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';

function makeMockRepo(initialRows: any[] = []) {
  let rows = [...initialRows];
  const matches = (row: any, where: any = {}) => {
    if (!where) return true;
    return Object.entries(where).every(([k, v]) => {
      if (v === null || v === undefined) return row[k] === v;
      return row[k] === v;
    });
  };

  return {
    rows,
    find: jest.fn(async (opts: any = {}) => {
      let filtered = rows;
      if (opts.where) filtered = filtered.filter((r) => matches(r, opts.where));
      return filtered;
    }),
    findOne: jest.fn(async (opts: any = {}) => {
      let filtered = rows;
      if (opts.where) filtered = filtered.filter((r) => matches(r, opts.where));
      return filtered[0] ?? null;
    }),
    create: jest.fn((d: any) => ({
      id: d.id || 'id_' + Math.random().toString(36).slice(2),
      createdAt: new Date(),
      updatedAt: new Date(),
      ...d,
    })),
    save: jest.fn(async (item: any) => {
      if (Array.isArray(item)) {
        item.forEach((it) => {
          const idx = rows.findIndex((r) => r.id === it.id);
          if (idx >= 0) rows[idx] = { ...rows[idx], ...it };
          else rows.push(it);
        });
        return item;
      }
      const idx = rows.findIndex((r) => r.id === item.id);
      if (idx >= 0) {
        rows[idx] = { ...rows[idx], ...item };
        return rows[idx];
      } else {
        rows.push(item);
        return item;
      }
    }),
    increment: jest.fn(async (conditions: any, propertyPath: string, value: number) => {
      rows.forEach((r) => {
        if (matches(r, conditions)) {
          r[propertyPath] = (r[propertyPath] || 0) + value;
        }
      });
    }),
  };
}

describe('ChatShareService (Chat Snapshot Share)', () => {
  let shareService: ChatShareService;
  let shareRepo: any;
  let convRepo: any;
  let msgRepo: any;
  let modelRepo: any;

  beforeEach(() => {
    shareRepo = makeMockRepo([]);
    convRepo = makeMockRepo([
      { id: 'c1', userId: 'u1', title: 'گفتگوی تست', modelId: 'm1', isDeleted: false },
      { id: 'c2_other', userId: 'u2', title: 'گفتگوی دیگران', modelId: 'm1', isDeleted: false },
      { id: 'c_empty', userId: 'u1', title: 'گفتگوی خالی', modelId: 'm1', isDeleted: false },
    ]);
    msgRepo = makeMockRepo([
      { id: 'm_1', conversationId: 'c1', role: 'user', content: 'سلام هوش مصنوعی', isDeleted: false, createdAt: new Date('2026-09-19T10:00:00Z') },
      { id: 'm_2', conversationId: 'c1', role: 'assistant', content: 'درود! چگونه می‌توانم کمکتان کنم؟', isDeleted: false, createdAt: new Date('2026-09-19T10:01:00Z') },
    ]);
    modelRepo = makeMockRepo([
      { id: 'm1', name: 'GPT-4o Mini' },
    ]);

    shareService = new ChatShareService(
      shareRepo as any,
      convRepo as any,
      msgRepo as any,
      modelRepo as any,
    );
  });

  it('fails to share a non-existent conversation', async () => {
    await expect(
      shareService.createOrUpdateShare('u1', 'non_existent'),
    ).rejects.toThrow(NotFoundException);
  });

  it('fails to share a conversation owned by another user', async () => {
    await expect(
      shareService.createOrUpdateShare('u1', 'c2_other'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('fails to share an empty conversation without messages', async () => {
    await expect(
      shareService.createOrUpdateShare('u1', 'c_empty'),
    ).rejects.toThrow(BadRequestException);
  });

  it('creates an immutable frozen snapshot up to the moment of sharing', async () => {
    const share = await shareService.createOrUpdateShare('u1', 'c1');
    expect(share.shareCode).toBeDefined();
    expect(share.messageCount).toBe(2);
    expect(share.title).toBe('گفتگوی تست');
    expect(share.modelName).toBe('GPT-4o Mini');

    // Verify snapshot is stored as JSONB
    expect(shareRepo.rows.length).toBe(1);
    expect(shareRepo.rows[0].snapshotMessages.length).toBe(2);
    expect(shareRepo.rows[0].snapshotMessages[0].content).toBe('سلام هوش مصنوعی');

    // Simulate subsequent messages added to the original conversation
    msgRepo.rows.push({
      id: 'm_3_new',
      conversationId: 'c1',
      role: 'user',
      content: 'پیام بعدی که بعد از اشتراک‌گذاری ارسال شده',
      isDeleted: false,
      createdAt: new Date('2026-09-19T10:05:00Z'),
    });

    // Verify public share still has ONLY the 2 original frozen messages
    const publicShare = await shareService.getPublicShare(share.shareCode);
    expect(publicShare.messages.length).toBe(2);
    expect(publicShare.messages.some((m: any) => m.content.includes('پیام بعدی'))).toBe(false);
  });

  it('re-sharing updates the snapshot to include latest messages', async () => {
    const share = await shareService.createOrUpdateShare('u1', 'c1');
    expect(share.messageCount).toBe(2);

    // Add new message
    msgRepo.rows.push({
      id: 'm_3',
      conversationId: 'c1',
      role: 'user',
      content: 'سوال جدید',
      isDeleted: false,
      createdAt: new Date(),
    });

    // Re-share / update snapshot
    const updated = await shareService.createOrUpdateShare('u1', 'c1');
    expect(updated.shareCode).toBe(share.shareCode);
    expect(updated.messageCount).toBe(3);

    const publicShare = await shareService.getPublicShare(share.shareCode);
    expect(publicShare.messages.length).toBe(3);
  });

  it('revoking a share marks it inactive and makes public view return 404', async () => {
    const share = await shareService.createOrUpdateShare('u1', 'c1');
    const revokeRes = await shareService.revokeShare('u1', 'c1');
    expect(revokeRes.success).toBe(true);

    await expect(
      shareService.getPublicShare(share.shareCode),
    ).rejects.toThrow(NotFoundException);
  });

  it('forking a shared chat clones it into a new conversation for another user', async () => {
    const share = await shareService.createOrUpdateShare('u1', 'c1');
    const forkRes = await shareService.forkShare('u3_viewer', share.shareCode);

    expect(forkRes.conversationId).toBeDefined();
    expect(forkRes.title).toContain('نسخه کپی');

    // Check newly created messages in msgRepo
    const clonedMsgs = msgRepo.rows.filter((m: any) => m.conversationId === forkRes.conversationId);
    expect(clonedMsgs.length).toBe(2);
    expect(clonedMsgs[0].content).toBe('سلام هوش مصنوعی');
  });
});
