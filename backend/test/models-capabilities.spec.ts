import { AiModel } from '../src/modules/models-admin/ai-model.entity';

describe('AiModel Capabilities', () => {
  it('instantiates with default capabilities', () => {
    const model = new AiModel();
    model.name = 'Test Model';
    model.provider = 'OpenAI';
    model.apiIdentifier = 'gpt-4o';
    // When instantiated, defaults should be:
    // supportsThinking: false, supportsVision: true, supportsDocument: true, thinkingBudgetTokens: null/undefined
    expect(model.supportsThinking).toBe(false);
    expect(model.supportsVision).toBe(true);
    expect(model.supportsDocument).toBe(true);
    expect(model.thinkingBudgetTokens).toBeUndefined();
  });

  it('allows setting thinking capability and budget', () => {
    const model = new AiModel();
    model.supportsThinking = true;
    model.thinkingBudgetTokens = 4096;
    expect(model.supportsThinking).toBe(true);
    expect(model.thinkingBudgetTokens).toBe(4096);
  });
});
