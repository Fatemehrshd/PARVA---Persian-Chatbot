import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  HttpCode,
  UseGuards,
  Res,
  Req,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import type { Response, Request } from 'express';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../../shared/jwt-auth.guard';
import { CreateConvDto, UpdateConvDto, SendMsgDto } from './dto';
@UseGuards(JwtAuthGuard)
@Controller('chat/conversations')
export class ChatController {
  constructor(private chat: ChatService) {}
  @Get() list(
    @Req() req: any,
    @Query('limit') limit?: string,
    @Query('page') page?: string,
  ) {
    const l = limit ? parseInt(limit, 10) : 50;
    const p = page ? parseInt(page, 10) : 1;
    return this.chat.list(req.user.sub, l, p);
  }
  @Get('search') search(@Req() req: any, @Query('q') query: string) {
    return this.chat.search(req.user.sub, query);
  }
  @Post() @UsePipes(new ValidationPipe({ whitelist: true })) create(
    @Req() req: any,
    @Body() d: CreateConvDto,
  ) {
    return this.chat.create(req.user.sub, d?.modelId, d?.title);
  }
  @Patch(':id')
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async update(@Req() req: any, @Param('id') id: string, @Body() d: UpdateConvDto) {
    if (!d.title && !d.modelId) {
      throw new BadRequestException('حداقل یکی از عنوان یا شناسه مدل باید ارسال شود');
    }
    let result;
    if (d.title) result = await this.chat.updateTitle(req.user.sub, id, d.title);
    if (d.modelId) result = await this.chat.setModel(req.user.sub, id, d.modelId);
    return result;
  }
  @Delete(':id')
  @HttpCode(204)
  async delete(@Req() req: any, @Param('id') id: string) {
    await this.chat.delete(req.user.sub, id);
  }
  @Delete(':id/messages/:messageId')
  @HttpCode(204)
  async deleteMessage(
    @Req() req: any,
    @Param('id') id: string,
    @Param('messageId') messageId: string,
  ) {
    await this.chat.deleteMessage(req.user.sub, id, messageId);
  }
  @Patch(':id/messages/:messageId/feedback')
  async setMessageFeedback(
    @Req() req: any,
    @Param('id') id: string,
    @Param('messageId') messageId: string,
    @Body('feedback') feedback: 'like' | 'dislike' | null,
  ) {
    if (feedback !== undefined && feedback !== null && feedback !== 'like' && feedback !== 'dislike') {
      throw new BadRequestException('بازخورد باید like یا dislike یا null باشد');
    }
    return this.chat.setMessageFeedback(req.user.sub, id, messageId, feedback ?? null);
  }
  @Get(':id/messages') history(@Req() req: any, @Param('id') id: string) {
    return this.chat.history(req.user.sub, id);
  }
  @Get(':id/active-stream')
  async getActiveStream(@Req() req: any, @Param('id') id: string) {
    return this.chat.getActiveStreamStatus(req.user.sub, id);
  }

  @Post(':id/stop')
  @HttpCode(200)
  async stopStream(@Req() req: any, @Param('id') id: string) {
    return this.chat.stopStream(req.user.sub, id);
  }

  @Get(':id/stream')
  async streamActive(
    @Req() req: Request & any,
    @Res() res: Response,
    @Param('id') id: string,
  ) {
    const gen = this.chat.subscribeToStream(req.user.sub, id);
    let clientDisconnected = false;
    req.on('close', () => {
      clientDisconnected = true;
    });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
      for await (const chunk of gen) {
        if (clientDisconnected || res.writableEnded) break;
        if (chunk.sync) {
          res.write(`event: sync\ndata: ${JSON.stringify({ content: chunk.sync })}\n\n`);
        }
        if (chunk.searchStatus) {
          res.write(`event: search-status\ndata: ${JSON.stringify({ state: chunk.searchStatus })}\n\n`);
        }
        if (chunk.sources) {
          res.write(`event: sources\ndata: ${JSON.stringify({ sources: chunk.sources })}\n\n`);
        }
        if (chunk.searchFailed) {
          res.write(`event: sources-error\ndata: ${JSON.stringify({ message: 'جستجوی وب ناموفق بود؛ پاسخ بدون منابع ادامه می‌یابد' })}\n\n`);
        }
        if (chunk.token) {
          res.write(`event: token\ndata: ${JSON.stringify({ content: chunk.token })}\n\n`);
        }
        if (chunk.title) {
          res.write(`event: title\ndata: ${JSON.stringify({ title: chunk.title })}\n\n`);
        }
        if (chunk.saved) {
          res.write(`event: done\ndata: ${JSON.stringify({ messageId: chunk.saved.id })}\n\n`);
        }
        if (chunk.error) {
          res.write(`event: error\ndata: ${JSON.stringify({ error: chunk.error, message: chunk.error })}\n\n`);
          break;
        }
      }
    } catch {
      // client disconnect or stream complete
    } finally {
      if (!res.writableEnded) {
        try {
          res.end();
        } catch {}
      }
    }
  }

  // The OpenAPI contract specifies 200 for this endpoint regardless of
  // whether the reply is streamed or returned as a single JSON message.
  @Post(':id/messages')
  @HttpCode(200)
  async send(
    @Req() req: Request & any,
    @Res() res: Response,
    @Param('id') id: string,
    @Body(new ValidationPipe({ whitelist: true })) d: SendMsgDto,
  ) {
    const gen = this.chat.generate(req.user.sub, id, d.content, d.fileIds, {
      useWebSearch: d.useWebSearch === true,
    });
    const accept = (req.headers['accept'] as string) ?? '';
    if (accept.includes('application/json')) {
      // Buffer the whole stream: nothing has been written yet, so provider
      // failures land in the exception filter as a clean 502 envelope.
      let saved;
      for await (const chunk of gen) if (chunk.saved) saved = chunk.saved;
      return res.json({
        success: true,
        message: 'Operation successful',
        data: saved,
      });
    }
    let clientDisconnected = false;
    req.on('close', () => {
      clientDisconnected = true;
    });

    const first = await gen.next();

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    const writeToken = (t: string) => {
      if (!clientDisconnected && !res.writableEnded) {
        try {
          res.write(`event: token\ndata: ${JSON.stringify({ content: t })}\n\n`);
        } catch {
          clientDisconnected = true;
        }
      }
    };
    if (!first.done && first.value?.error) {
      res.write(`event: error\ndata: ${JSON.stringify({ error: first.value.error, message: first.value.error })}\n\n`);
      if (!res.writableEnded) res.end();
      return;
    }
    if (!first.done && first.value?.sync) {
      res.write(`event: sync\ndata: ${JSON.stringify({ content: first.value.sync })}\n\n`);
    }
    // The first chunk is consumed by gen.next() above — every chunk type must
    // be written here too, or the first event is swallowed. (searchStatus is
    // typically the very first yield when web search is on.)
    if (!first.done && first.value?.searchStatus && !res.writableEnded) {
      res.write(`event: search-status\ndata: ${JSON.stringify({ state: first.value.searchStatus })}\n\n`);
    }
    if (!first.done && first.value?.sources && !res.writableEnded) {
      res.write(`event: sources\ndata: ${JSON.stringify({ sources: first.value.sources })}\n\n`);
    }
    if (!first.done && first.value?.searchFailed && !res.writableEnded) {
      res.write(`event: sources-error\ndata: ${JSON.stringify({ message: 'جستجوی وب ناموفق بود؛ پاسخ بدون منابع ادامه می‌یابد' })}\n\n`);
    }
    if (!first.done && first.value?.token) writeToken(first.value.token);
    try {
      for await (const chunk of gen) {
        if (clientDisconnected) break;
        if (chunk.error && !clientDisconnected && !res.writableEnded) {
          try {
            res.write(`event: error\ndata: ${JSON.stringify({ error: chunk.error, message: chunk.error })}\n\n`);
          } catch {
            clientDisconnected = true;
          }
          break;
        }
        if (chunk.sync && !clientDisconnected && !res.writableEnded) {
          try {
            res.write(`event: sync\ndata: ${JSON.stringify({ content: chunk.sync })}\n\n`);
          } catch {
            clientDisconnected = true;
          }
        }
        if (chunk.searchStatus && !clientDisconnected && !res.writableEnded) {
          try {
            res.write(`event: search-status\ndata: ${JSON.stringify({ state: chunk.searchStatus })}\n\n`);
          } catch {
            clientDisconnected = true;
          }
        }
        if (chunk.sources && !clientDisconnected && !res.writableEnded) {
          try {
            res.write(`event: sources\ndata: ${JSON.stringify({ sources: chunk.sources })}\n\n`);
          } catch {
            clientDisconnected = true;
          }
        }
        if (chunk.searchFailed && !clientDisconnected && !res.writableEnded) {
          try {
            res.write(`event: sources-error\ndata: ${JSON.stringify({ message: 'جستجوی وب ناموفق بود؛ پاسخ بدون منابع ادامه می‌یابد' })}\n\n`);
          } catch {
            clientDisconnected = true;
          }
        }
        if (chunk.token) writeToken(chunk.token);
        if (chunk.title && !clientDisconnected && !res.writableEnded) {
          try {
            res.write(`event: title\ndata: ${JSON.stringify({ title: chunk.title })}\n\n`);
          } catch {
            clientDisconnected = true;
          }
        }
        if (chunk.saved && !clientDisconnected && !res.writableEnded) {
          try {
            res.write(`event: done\ndata: ${JSON.stringify({ messageId: chunk.saved.id })}\n\n`);
          } catch {
            clientDisconnected = true;
          }
        }
      }
    } catch (err: any) {
      if (!clientDisconnected && !res.writableEnded) {
        try {
          const errMessage = err?.message || 'خطا در برقراری ارتباط با مدل هوش مصنوعی';
          res.write(`event: error\ndata: ${JSON.stringify({ error: errMessage, message: errMessage })}\n\n`);
        } catch {
          clientDisconnected = true;
        }
      }
    } finally {
      if (!res.writableEnded) {
        try {
          res.end();
        } catch {
          // ignore
        }
      }
    }
  }

  @Post(':id/messages/:messageId/resume')
  @HttpCode(200)
  async resumeMessage(
    @Req() req: Request & any,
    @Res() res: Response,
    @Param('id') id: string,
    @Param('messageId') messageId: string,
  ) {
    const gen = this.chat.resume(req.user.sub, id, messageId);
    let clientDisconnected = false;
    req.on('close', () => {
      clientDisconnected = true;
    });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const writeToken = (t: string) => {
      if (!clientDisconnected && !res.writableEnded) {
        try {
          res.write(`event: token\ndata: ${JSON.stringify({ content: t })}\n\n`);
        } catch {
          clientDisconnected = true;
        }
      }
    };

    try {
      for await (const chunk of gen) {
        if (clientDisconnected) break;
        if (chunk.token) writeToken(chunk.token);
        if (chunk.saved && !clientDisconnected && !res.writableEnded) {
          try {
            res.write(`event: done\ndata: ${JSON.stringify({ messageId: chunk.saved.id })}\n\n`);
          } catch {
            clientDisconnected = true;
          }
        }
      }
    } catch {
      // client disconnect or stream complete
    } finally {
      if (!res.writableEnded) {
        try {
          res.end();
        } catch {}
      }
    }
  }

  @Post(':id/messages/:messageId/stop')
  @HttpCode(200)
  async stopMessageEndpoint(
    @Req() req: any,
    @Param('id') id: string,
    @Param('messageId') messageId: string,
  ) {
    return this.chat.stopMessage(req.user.sub, id, messageId);
  }
}
