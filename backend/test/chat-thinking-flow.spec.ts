import { calculateEffectiveTokens, ChatService } from '../src/modules/chat/chat.service';
import { ActiveStreamService } from '../src/modules/chat/active-stream.service';
import { SendMsgDto } from '../src/modules/chat/dto';

describe('Chat Thinking Flow & Token Tariffs', () => {
  describe('calculateEffectiveTokens', () => {
    it('applies 1.0 multiplier when neither search nor thinking is used', () => {
      const tokens = calculateEffectiveTokens(100, {
        usedSearch: false,
        usedThinking: false,
        searchMult: 1.2,
        thinkingMult: 1.3,
      });
      expect(tokens).toBe(100);
    });

    it('applies search multiplier 1.2x when search is used', () => {
      const tokens = calculateEffectiveTokens(100, {
        usedSearch: true,
        usedThinking: false,
        searchMult: 1.2,
        thinkingMult: 1.3,
      });
      expect(tokens).toBe(120);
    });

    it('applies thinking multiplier 1.3x when thinking is used', () => {
      const tokens = calculateEffectiveTokens(100, {
        usedSearch: false,
        usedThinking: true,
        searchMult: 1.2,
        thinkingMult: 1.3,
      });
      expect(tokens).toBe(130);
    });

    it('compounds multipliers when both search and thinking are used', () => {
      // 100 * 1.2 * 1.3 = 156
      const tokens = calculateEffectiveTokens(100, {
        usedSearch: true,
        usedThinking: true,
        searchMult: 1.2,
        thinkingMult: 1.3,
      });
      expect(tokens).toBe(156);
    });
  });

  describe('ActiveStreamService reasoning buffer', () => {
    let service: ActiveStreamService;

    beforeEach(() => {
      service = new ActiveStreamService();
      service.initSession('c1', 'u1', new AbortController());
    });

    it('accumulates reasoning and marks thinking complete with duration', () => {
      service.appendReasoning('c1', 'I am ');
      service.appendReasoning('c1', 'thinking.');
      service.completeThinking('c1', 1850);

      const session = service.getSession('c1');
      expect(session?.reasoningText).toBe('I am thinking.');
      expect(session?.thinkingDurationMs).toBe(1850);
      expect(session?.isThinkingComplete).toBe(true);
    });
  });

  describe('SendMsgDto', () => {
    it('allows useThinking optional property', () => {
      const dto = new SendMsgDto();
      dto.content = 'test';
      dto.useThinking = true;
      expect(dto.useThinking).toBe(true);
    });
  });

  describe('ChatService Thinking Activation in Offline Echo Mode', () => {
    function makeTestService(opts?: {
      target?: any;
      streamImpl?: (t: any, m: any[], o?: any) => AsyncGenerator<any>;
    }) {
      const savedMsgs: any[] = [];
      let seq = 0;
      const convRow = { id: 'c1', userId: 'u1', modelId: 'm1', title: 'Test Conv' };
      const conv: any = {
        findOne: async () => convRow,
        save: async (c: any) => c,
        create: (o: any) => o,
        update: async () => {},
      };
      const msg: any = {
        create: (o: any) => ({ ...o }),
        save: async (o: any) => {
          const m = { id: `msg-${++seq}`, createdAt: new Date(seq), ...o };
          savedMsgs.push(m);
          return m;
        },
        find: async () => [...savedMsgs],
        findOne: async () => null,
      };
      const models: any = {
        getRawById: async () => ({ id: 'm1', isActive: true, supportsThinking: true }),
        getDefault: async () => ({ id: 'm1', isActive: true, supportsThinking: true }),
        resolveProvider: async () => ({ id: 'p1', isActive: true }),
      };
      const forwarder: any = {
        resolveTarget: () => opts?.target ?? null,
        stream: (t: any, m: any[], o?: any) =>
          opts?.streamImpl ? opts.streamImpl(t, m, o) : (async function* () {})(),
      };
      const settings: any = {
        getThinkingMultiplier: async () => 1.3,
        getWebSearchMultiplier: async () => 1.2,
        getSystemPrompt: async () => 'You are a helpful assistant.',
      };
      let incrementedTokens = 0;
      const users: any = {
        incrementUsedTokens: async (_u: string, count: number) => {
          incrementedTokens += count;
        },
        findById: async () => ({ id: 'u1', usedTokens: 0, tokenLimit: 100000 }),
      };
      const activeStream = new ActiveStreamService();
      const svc = new ChatService(
        conv,
        msg,
        models,
        forwarder,
        settings,
        users,
        activeStream,
      );
      return { svc, savedMsgs, getIncrementedTokens: () => incrementedTokens };
    }

    it('activates thinking in offline echo mode: streams thinking chunks, status, and persists reasoning', async () => {
      const { svc, savedMsgs, getIncrementedTokens } = makeTestService();

      const chunks: any[] = [];
      for await (const chunk of svc.generate('u1', 'c1', 'علت آبی بودن آسمان چیست؟', undefined, {
        useThinking: true,
      })) {
        chunks.push(chunk);
      }

      // Check thinking status events
      const thinkingStatusEvents = chunks.filter((c) => c.thinkingStatus);
      expect(thinkingStatusEvents.length).toBe(2);
      expect(thinkingStatusEvents[0].thinkingStatus).toBe('thinking');
      expect(thinkingStatusEvents[1].thinkingStatus).toBe('done');
      expect(typeof thinkingStatusEvents[1].thinkingDurationMs).toBe('number');
      expect(thinkingStatusEvents[1].thinkingDurationMs).toBeGreaterThanOrEqual(100);

      // Check thinking text chunks
      const thinkingChunks = chunks.filter((c) => c.thinking);
      expect(thinkingChunks.length).toBeGreaterThan(0);
      const combinedReasoning = thinkingChunks.map((c) => c.thinking).join('');
      expect(combinedReasoning).toContain('تحلیل');

      // Check tokens and saved message
      const savedChunk = chunks.find((c) => c.saved);
      expect(savedChunk).toBeDefined();
      expect(savedChunk.saved.role).toBe('assistant');
      expect(savedChunk.saved.reasoning_content).toBe(combinedReasoning);
      expect(savedChunk.saved.thinkingDurationMs).toBe(thinkingStatusEvents[1].thinkingDurationMs);

      // Check 1.3x multiplier token usage
      expect(getIncrementedTokens()).toBeGreaterThan(0);
    });

    it('does NOT activate thinking when useThinking is false or omitted', async () => {
      const { svc } = makeTestService();

      const chunks: any[] = [];
      for await (const chunk of svc.generate('u1', 'c1', 'سلام', undefined, {
        useThinking: false,
      })) {
        chunks.push(chunk);
      }

      const thinkingEvents = chunks.filter((c) => c.thinkingStatus || c.thinking);
      expect(thinkingEvents.length).toBe(0);

      const savedChunk = chunks.find((c) => c.saved);
      expect(savedChunk.saved.reasoning_content).toBeNull();
      expect(savedChunk.saved.thinkingDurationMs).toBeNull();
    });

    it('activates thinking in real stream mode when forwarder yields reasoning deltas', async () => {
      let passedOptions: any;
      const { svc } = makeTestService({
        target: { apiIdentifier: 'o3-mini', apiKey: 'sk-test', baseUrl: 'https://api.openai.com/v1' },
        streamImpl: async function* (_t: any, _m: any[], o?: any) {
          passedOptions = o;
          yield { reasoning: 'نور آبی طول موج کوتاه‌تری دارد ' };
          yield { reasoning: 'و بیشتر پراکنده می‌شود.' };
          yield 'آسمان به دلیل ';
          yield 'پدیده پراکندگی ریلی آبی است.';
        },
      });

      const chunks: any[] = [];
      for await (const chunk of svc.generate('u1', 'c1', 'چرا آسمان آبی است؟', undefined, {
        useThinking: true,
      })) {
        chunks.push(chunk);
      }

      expect(passedOptions?.useThinking).toBe(true);

      const thinkingStatusEvents = chunks.filter((c) => c.thinkingStatus);
      expect(thinkingStatusEvents.length).toBe(2);
      expect(thinkingStatusEvents[0].thinkingStatus).toBe('thinking');
      expect(thinkingStatusEvents[1].thinkingStatus).toBe('done');

      const thinkingChunks = chunks.filter((c) => c.thinking);
      expect(thinkingChunks.length).toBeGreaterThan(0);
      const combinedReasoning = thinkingChunks.map((c) => c.thinking).join('');
      expect(combinedReasoning).toContain('نور آبی طول موج کوتاه‌تری دارد');

      const contentChunks = chunks.filter((c) => c.token);
      const combinedContent = contentChunks.map((c) => c.token).join('');
      expect(combinedContent).toContain('آسمان به دلیل پدیده پراکندگی ریلی آبی است.');

      const savedChunk = chunks.find((c) => c.saved);
      expect(savedChunk.saved.reasoning_content).toContain('نور آبی');
      expect(typeof savedChunk.saved.thinkingDurationMs).toBe('number');
    });
  });
});
