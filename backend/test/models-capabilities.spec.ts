import { AiModel } from '../src/modules/models-admin/ai-model.entity';
import { ModelsAdminService } from '../src/modules/models-admin/models-admin.service';

describe('AiModel Capabilities', () => {
  it('instantiates with default capabilities', () => {
    const model = new AiModel();
    model.name = 'Test Model';
    model.provider = 'OpenAI';
    model.apiIdentifier = 'gpt-4o';
    // When instantiated, defaults should be:
    // supportsThinking: true, supportsVision: true, supportsDocument: true, thinkingBudgetTokens: null/undefined
    expect(model.supportsThinking).toBe(true);
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

  it('updates capability flags in ModelsAdminService.update', async () => {
    const existingModel = new AiModel();
    existingModel.id = 'm-123';
    existingModel.name = 'Old Model';
    existingModel.supportsThinking = false;
    existingModel.supportsVision = false;
    existingModel.supportsDocument = false;
    existingModel.thinkingBudgetTokens = null;

    const repo = {
      findOne: jest.fn().mockResolvedValue(existingModel),
      save: jest.fn().mockImplementation((m) => Promise.resolve(m)),
    } as any;
    const providers = {
      findOne: jest.fn().mockResolvedValue(null),
    } as any;

    const service = new ModelsAdminService(repo, providers);
    const updated = await service.update('m-123', {
      supportsThinking: true,
      supportsVision: true,
      supportsDocument: true,
      thinkingBudgetTokens: 8192,
    });

    expect(updated.supportsThinking).toBe(true);
    expect(updated.supportsVision).toBe(true);
    expect(updated.supportsDocument).toBe(true);
    expect(updated.thinkingBudgetTokens).toBe(8192);
    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        supportsThinking: true,
        supportsVision: true,
        supportsDocument: true,
        thinkingBudgetTokens: 8192,
      }),
    );
  });
});
