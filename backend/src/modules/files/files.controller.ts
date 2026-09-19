import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  UseGuards,
  Req,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
  BadRequestException,
  HttpCode,
  Body,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../shared/jwt-auth.guard';
import { FilesService } from './files.service';

@UseGuards(JwtAuthGuard)
@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Get('settings')
  async getSettings() {
    return this.filesService.getUploadLimits();
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 50 * 1024 * 1024 } }))
  async uploadSingle(
    @Req() req: any,
    @UploadedFile() file: Express.Multer.File,
    @Body('conversationId') conversationId?: string,
  ) {
    if (!file) {
      throw new BadRequestException('هیچ فایلی ارسال نشده است');
    }
    return this.filesService.uploadFile(req.user.sub, file, conversationId);
  }

  @Post('upload-multiple')
  @UseInterceptors(FilesInterceptor('files', 10, { limits: { fileSize: 50 * 1024 * 1024 } }))
  async uploadMultiple(
    @Req() req: any,
    @UploadedFiles() files: Express.Multer.File[],
    @Body('conversationId') conversationId?: string,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('هیچ فایلی ارسال نشده است');
    }

    const limits = await this.filesService.getUploadLimits();
    if (files.length > limits.maxFileCount) {
      throw new BadRequestException(
        `حداکثر ${limits.maxFileCount} فایل به صورت همزمان قابل ارسال است`,
      );
    }

    const totalSize = files.reduce((sum, f) => sum + f.size, 0);
    if (totalSize > limits.maxTotalSizeBytes) {
      throw new BadRequestException(
        `مجموع حجم فایل‌ها (${(totalSize / (1024 * 1024)).toFixed(1)} مگابایت) بیشتر از سقف مجاز (${limits.maxTotalSizeMb} مگابایت) است`,
      );
    }

    const results = [];
    for (const f of files) {
      const res = await this.filesService.uploadFile(req.user.sub, f, conversationId);
      results.push(res);
    }
    return results;
  }

  @Get(':id/status')
  async getStatus(@Req() req: any, @Param('id') id: string) {
    return this.filesService.getFileStatus(req.user.sub, id);
  }

  @Get(':id/content')
  async getContent(
    @Req() req: any,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const isAdmin = req.user?.role === 'admin';
    const file = await this.filesService.getFileRecord(req.user.sub, id, isAdmin);
    const buffer = await this.filesService.getFileBuffer(file);
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(file.originalName)}"`,
    );
    res.end(buffer);
  }

  @Post(':id/retry')
  @HttpCode(200)
  async retry(@Req() req: any, @Param('id') id: string) {
    return this.filesService.retryFileProcessing(req.user.sub, id);
  }

  @Delete(':id')
  @HttpCode(204)
  async delete(@Req() req: any, @Param('id') id: string) {
    await this.filesService.deleteFile(req.user.sub, id);
  }
}
