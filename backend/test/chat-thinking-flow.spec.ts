import { calculateEffectiveTokens } from '../src/modules/chat/chat.service';
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
});
