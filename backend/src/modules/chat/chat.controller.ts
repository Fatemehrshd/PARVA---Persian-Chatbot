import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Body,
  Param,
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
    // Pull the FIRST chunk before committing to SSE: a provider/ownership
    // error that happens before any token is still a plain JSON response.
    const first = await gen.next();
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    const writeToken = (t: string) =>
      res.write(`event: token\ndata: ${JSON.stringify({ content: t })}\n\n`);
    if (!first.done && first.value?.token) writeToken(first.value.token);
    for await (const chunk of gen) {
      if (chunk.token) writeToken(chunk.token);
      if (chunk.saved) {
        res.write(`event: done\ndata: ${JSON.stringify({ messageId: chunk.saved.id })}\n\n`);
      }
    }
    res.end();
  }
}
