import { SettingsService, DEFAULT_WEB_SEARCH_MULTIPLIER, DEFAULT_THINKING_MULTIPLIER } from '../src/modules/admin/settings.service';

describe('SettingsService Token Tariffs', () => {
  let service: SettingsService;
  let fakeRepo: any;
  let memory: Record<string, string>;

  beforeEach(() => {
    memory = {};
    fakeRepo = {
      findOne: jest.fn(async ({ where }: any) => (memory[where.key] !== undefined ? { key: where.key, value: memory[where.key] } : null)),
      create: jest.fn((dto: any) => ({ ...dto })),
      save: jest.fn(async (entity: any) => {
        memory[entity.key] = entity.value;
        return entity;
      }),
    };
    service = new SettingsService(fakeRepo);
  });

  it('returns default multipliers 1.2 and 1.3 when unset', async () => {
    expect(DEFAULT_WEB_SEARCH_MULTIPLIER).toBe(1.2);
    expect(DEFAULT_THINKING_MULTIPLIER).toBe(1.3);
    expect(await service.getWebSearchMultiplier()).toBe(1.2);
    expect(await service.getThinkingMultiplier()).toBe(1.3);
  });

  it('saves and retrieves customized multipliers', async () => {
    await service.update({ webSearchMultiplier: 1.5, thinkingMultiplier: 1.8 } as any);
    expect(await service.getWebSearchMultiplier()).toBe(1.5);
    expect(await service.getThinkingMultiplier()).toBe(1.8);
  });

  it('includes multipliers in getAll()', async () => {
    const all = await service.getAll();
    expect(all.webSearchMultiplier).toBe(1.2);
    expect(all.thinkingMultiplier).toBe(1.3);
  });
});

// ─── calculateAttachmentTokens + resolveAttachmentMultiplier ─────────────────
import {
  calculateAttachmentTokens,
  resolveAttachmentMultiplier,
} from '../src/modules/chat/chat.service';

describe('resolveAttachmentMultiplier', () => {
  it('returns 1.0 for normal task type regardless of map', () => {
    expect(resolveAttachmentMultiplier('normal', { normal: 5 })).toBe(1.0);
  });

  it('returns configured multiplier for image', () => {
    expect(resolveAttachmentMultiplier('image', { image: 2.5 })).toBe(2.5);
  });

  it('returns configured multiplier for document', () => {
    expect(resolveAttachmentMultiplier('document', { document: 1.8 })).toBe(1.8);
  });

  it('falls back to 1.0 when type not in map', () => {
    expect(resolveAttachmentMultiplier('image', {})).toBe(1.0);
    expect(resolveAttachmentMultiplier('document', {})).toBe(1.0);
  });

  it('falls back to 1.0 when multiplier is zero or negative', () => {
    expect(resolveAttachmentMultiplier('image', { image: 0 })).toBe(1.0);
    expect(resolveAttachmentMultiplier('image', { image: -1 })).toBe(1.0);
  });
});

describe('calculateAttachmentTokens with admin taskMultipliers', () => {
  it('returns 0 for empty attachments', () => {
    expect(calculateAttachmentTokens([], { image: 3 })).toBe(0);
  });

  it('applies no multiplier (1.0) when taskMultipliers is empty', () => {
    const att = [{ fileType: 'image', metadata: { width: 512, height: 512 } }];
    // 1 tile: 85 + 1*170 = 255, mult=1.0 → 255
    expect(calculateAttachmentTokens(att, {})).toBe(255);
  });

  it('applies image multiplier from admin settings', () => {
    const att = [{ fileType: 'image', metadata: { width: 512, height: 512 } }];
    // base=255, mult=2.0 → 510
    expect(calculateAttachmentTokens(att, { image: 2.0 })).toBe(510);
  });

  it('applies image multiplier for multi-tile image', () => {
    // 1024×512 → 2×1 tiles = 2 tiles → 85 + 2*170 = 425, mult=1.5 → ceil(637.5)=638
    const att = [{ fileType: 'image', metadata: { width: 1024, height: 512 } }];
    expect(calculateAttachmentTokens(att, { image: 1.5 })).toBe(638);
  });

  it('estimates image tokens by fileSize when dimensions are missing', () => {
    // size=128KB → chunks=1 → 85 + 1*65 = 150, mult=2.0 → 300
    const att = [{ fileType: 'image', fileSize: 128 * 1024 }];
    expect(calculateAttachmentTokens(att, { image: 2.0 })).toBe(300);
  });

  it('applies document multiplier for pdf', () => {
    // size=5000 bytes → ceil(5000/500*100)=1000 tokens, mult=1.5 → 1500
    const att = [{ fileType: 'pdf', fileSize: 5000 }];
    expect(calculateAttachmentTokens(att, { document: 1.5 })).toBe(1500);
  });

  it('applies document multiplier for text file', () => {
    // size=1000 bytes → ceil(1000/500*100)=200, mult=2.0 → 400
    const att = [{ fileType: 'text', fileSize: 1000 }];
    expect(calculateAttachmentTokens(att, { document: 2.0 })).toBe(400);
  });

  it('applies document multiplier for excel', () => {
    // size=0 → fallback 100, mult=1.3 → ceil(130)=130
    const att = [{ fileType: 'excel', fileSize: 0 }];
    expect(calculateAttachmentTokens(att, { document: 1.3 })).toBe(130);
  });

  it('applies different multipliers for image and document in same request', () => {
    const atts = [
      { fileType: 'image', metadata: { width: 512, height: 512 } }, // base=255, mult=2.0 → 510
      { fileType: 'pdf', fileSize: 5000 },                           // base=1000, mult=1.5 → 1500
    ];
    expect(calculateAttachmentTokens(atts, { image: 2.0, document: 1.5 })).toBe(2010);
  });

  it('image multiplier does not affect document tokens and vice versa', () => {
    const imgOnly = [{ fileType: 'image', metadata: { width: 512, height: 512 } }];
    const docOnly = [{ fileType: 'pdf', fileSize: 5000 }];
    // image with document multiplier set → should use imageMult=1.0 fallback
    expect(calculateAttachmentTokens(imgOnly, { document: 5.0 })).toBe(255);
    // document with image multiplier set → should use documentMult=1.0 fallback
    expect(calculateAttachmentTokens(docOnly, { image: 5.0 })).toBe(1000);
  });
});
