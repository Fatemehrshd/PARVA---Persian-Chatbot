import { Controller, Get, Post, Body, Res, Req, HttpCode } from '@nestjs/common';
import type { Response, Request } from 'express';
import { ModelsAdminService } from '../models-admin/models-admin.service';

@Controller(['v1', ''])
export class OpenAiCompatController {
  constructor(private modelsService: ModelsAdminService) {}

  @Get(['models', 'v1/models'])
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

  @Post(['chat/completions', 'v1/chat/completions'])
  @HttpCode(200)
  async chatCompletions(@Body() body: any, @Res() res: Response, @Req() _req: Request) {
    const { model: requestedModel, messages = [], stream = false } = body;
    const lastUserMsg = [...messages].reverse().find((m: any) => m.role === 'user');
    const userContent = lastUserMsg?.content || 'Hello';

    const activeModels = await this.modelsService.listActive();
    const matchedModel = activeModels.find(
      (m) => m.apiIdentifier === requestedModel || m.name === requestedModel,
    );

    const modelName = matchedModel?.apiIdentifier || requestedModel || 'gpt-4o';
    const completionId = `chatcmpl-${Date.now()}`;
    const created = Math.floor(Date.now() / 1000);
    const replyText = `[${modelName}] Echo: ${userContent}`;

    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const words = replyText.split(/(\s+)/);
      for (const w of words) {
        const chunk = {
          id: completionId,
          object: 'chat.completion.chunk',
          created,
          model: modelName,
          choices: [
            {
              index: 0,
              delta: { content: w },
              finish_reason: null,
            },
          ],
        };
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      }

      res.write('data: [DONE]\n\n');
      return res.end();
    }

    return res.json({
      id: completionId,
      object: 'chat.completion',
      created,
      model: modelName,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: replyText,
          },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 15,
        total_tokens: 25,
      },
    });
  }
}

