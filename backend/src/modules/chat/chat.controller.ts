import {
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
import { IsString, IsOptional, MinLength } from 'class-validator';
import type { Response, Request } from 'express';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../../shared/jwt-auth.guard';
class CreateConvDto {
  @IsOptional() @IsString() modelId?: string;
  @IsOptional() @IsString() title?: string;
}
class UpdateConvDto {
  @IsString()
  @MinLength(1)
  title: string;
}
class SendMsgDto {
  @IsString() @MinLength(1) content: string;
}
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
  async update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() d: UpdateConvDto,
  ) {
    return this.chat.updateTitle(req.user.sub, id, d.title);
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
    const { reply, saved } = await this.chat.answer(req.user.sub, id, d.content);
    const accept = (req.headers['accept'] as string) ?? '';
    if (accept.includes('application/json')) {
      return res.json({
        success: true,
        message: 'Operation successful',
        data: saved,
      });
    }
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    const words = reply.split(/(\s+)/);
    for (const w of words) {
      res.write(`event: token\ndata: ${JSON.stringify({ content: w })}\n\n`);
    }
    res.write(`event: done\ndata: ${JSON.stringify({ messageId: saved.id })}\n\n`);
    res.end();
  }
}
