import {
  Controller,
  Get,
  Post,
  Body,
  Res,
  HttpCode,
  NotFoundException,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { ModelsAdminService } from '../models-admin/models-admin.service';
import { OpenAiCompatForwarder } from '../ai/openai-compat.forwarder';
import { JwtAuthGuard } from '../../shared/jwt-auth.guard';

/**
 * Inbound OpenAI-compatible facade so external tooling can point at this
 * platform (documented surface: /v1/models and /v1/chat/completions only).
 * Since replies are forwarded to real (paid) upstream providers,
 * both endpoints require a bearer JWT.
 * Responses use the raw OpenAI shapes (the global envelope interceptor
 * skips /v1 paths) — and when NO credential is configured anywhere the
 * legacy offline echo is kept so local dev stays functional.
 */
@UseGuards(JwtAuthGuard)
@Controller('v1')
export class OpenAiCompatController {
  constructor(
    private modelsService: ModelsAdminService,
    private forwarder: OpenAiCompatForwarder,
  ) {}

  @Get('models')
  async listModels() {
    const activeModels = await this.modelsService.listActive();
    return {
      object: 'list',
      data: activeModels.map((m) => ({
        id: m.apiIdentifier,
        object: 'model',
        created: Math.floor(new Date(m.createdAt).getTime() / 1000),
        owned_by: m.provider,
        permission: [],
        root: m.apiIdentifier,
        parent: null,
      })),
    };
  }

  @Post('chat/completions')
  @HttpCode(200)
  async chatCompletions(@Body() body: any, @Res() res: Response) {
    const { model: requestedModel, messages = [], stream = false } = body;
    const lastUserMsg = [...messages].reverse().find((m: any) => m.role === 'user');
    const userContent = lastUserMsg?.content || 'Hello';

    const activeModels = await this.modelsService.listActive();
    const matchedModel = activeModels.find(
      (m) => m.apiIdentifier === requestedModel || m.name === requestedModel,
    );
    if (requestedModel && !matchedModel) {
      throw new NotFoundException(`The model '${requestedModel}' does not exist`);
    }

    const provider = matchedModel ? await this.modelsService.resolveProvider(matchedModel) : null;
    const target = this.forwarder.resolveTarget(matchedModel ?? null, provider);
    const modelName = matchedModel?.apiIdentifier || requestedModel || 'gpt-4o';
    const completionId = `chatcmpl-${Date.now()}`;
    const created = Math.floor(Date.now() / 1000);

    // Offline/dev fallback (no credential configured anywhere): legacy echo.
    const echoGen = async function* (): AsyncGenerator<string> {
      for (const w of `[${modelName}] Echo: ${userContent}`.split(/(\s+)/)) {
        if (w) yield w;
      }
    };
    const deltas: AsyncGenerator<string> = target
      ? this.forwarder.stream(
          { ...target, apiIdentifier: requestedModel || target.apiIdentifier },
          messages
            .filter((m: any) => typeof m?.content === 'string')
            .map((m: any) => ({ role: m.role, content: m.content })),
        )
      : echoGen();

    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      const sendChunk = (delta: any) => {
        const chunk = {
          id: completionId,
          object: 'chat.completion.chunk',
          created,
          model: modelName,
          choices: [{ index: 0, delta, finish_reason: null }],
        };
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      };
      sendChunk({ role: 'assistant', content: null });
      for await (const token of deltas) sendChunk({ content: token });
      const done = {
        id: completionId,
        object: 'chat.completion.chunk',
        created,
        model: modelName,
        choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
      };
      res.write(`data: ${JSON.stringify(done)}\n\n`);
      res.write('data: [DONE]\n\n');
      return res.end();
    }

    let content = '';
    for await (const token of deltas) content += token;
    return res.json({
      id: completionId,
      object: 'chat.completion',
      created,
      model: modelName,
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: Math.ceil(JSON.stringify(messages).length / 4),
        completion_tokens: Math.ceil(content.length / 4),
        total_tokens: Math.ceil((JSON.stringify(messages).length + content.length) / 4),
      },
    });
  }
}
