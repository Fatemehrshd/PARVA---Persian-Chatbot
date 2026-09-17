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
} from '@nestjs/common';
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
