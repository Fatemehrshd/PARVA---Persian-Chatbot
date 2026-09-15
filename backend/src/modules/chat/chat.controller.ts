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
  @Get() list(@Req() req: any) {
    return this.chat.list(req.user.sub);
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
  @Get(':id/messages') history(@Req() req: any, @Param('id') id: string) {
    return this.chat.history(req.user.sub, id);
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
    const gen = this.chat.generate(req.user.sub, id, d.content);
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
    const writeToken = (t: string) => {
      if (!clientDisconnected && !res.writableEnded) {
        try {
          res.write(`event: token\ndata: ${JSON.stringify({ content: t })}\n\n`);
        } catch {
          clientDisconnected = true;
        }
      }
    };
    if (!first.done && first.value?.token) writeToken(first.value.token);
    try {
      for await (const chunk of gen) {
        if (clientDisconnected) break;
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
    } catch {
      // Stream error or client aborted
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
}
