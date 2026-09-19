import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Res,
  HttpStatus,
  HttpException,
  Header,
  HttpCode,
} from '@nestjs/common';
import type { Response } from 'express';
import { TtsService, TtsEngine } from './tts.service';

export class SynthesizeDto {
  text: string;
  engine?: TtsEngine;
  voice?: string;
  rate?: string;
  pitch?: string;
  model?: string;
}

@Controller('tts')
export class TtsController {
  constructor(private readonly ttsService: TtsService) {}

  @Get('voices')
  getVoices() {
    return this.ttsService.getAvailableEngines();
  }

  @Post('synthesize')
  @HttpCode(HttpStatus.OK)
  @Header('Content-Type', 'audio/mpeg')
  @Header('Cache-Control', 'public, max-age=86400')
  async synthesizePost(@Body() body: SynthesizeDto, @Res() res: Response) {
    if (!body?.text?.trim()) {
      throw new HttpException('متن جهت تبدیل به صدا الزامی است', HttpStatus.BAD_REQUEST);
    }
    try {
      const stream = await this.ttsService.synthesizeStream({
        text: body.text,
        engine: body.engine,
        voice: body.voice,
        rate: body.rate,
        pitch: body.pitch,
        model: body.model,
      });

      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Accept-Ranges', 'bytes');
      stream.pipe(res);
    } catch (err: any) {
      throw new HttpException(
        err.message || 'خطا در تبدیل متن به گفتار',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('synthesize')
  @Header('Content-Type', 'audio/mpeg')
  @Header('Cache-Control', 'public, max-age=86400')
  async synthesizeGet(
    @Query('text') text: string,
    @Query('engine') engine: TtsEngine,
    @Query('voice') voice: string,
    @Query('rate') rate: string,
    @Query('pitch') pitch: string,
    @Query('model') model: string,
    @Res() res: Response,
  ) {
    if (!text?.trim()) {
      throw new HttpException('متن جهت تبدیل به صدا الزامی است', HttpStatus.BAD_REQUEST);
    }
    try {
      const stream = await this.ttsService.synthesizeStream({
        text,
        engine,
        voice,
        rate,
        pitch,
        model,
      });

      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Accept-Ranges', 'bytes');
      stream.pipe(res);
    } catch (err: any) {
      throw new HttpException(
        err.message || 'خطا در تبدیل متن به گفتار',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
