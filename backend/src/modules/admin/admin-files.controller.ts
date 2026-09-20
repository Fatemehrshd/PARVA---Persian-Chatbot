import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  UseGuards,
  HttpCode,
  NotFoundException,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FileAttachment } from '../files/file-attachment.entity';
import { User } from '../users/user.entity';
import { FilesService, fixUtf8MangledString } from '../files/files.service';
import { QueueManagerService } from '../files/queue-manager.service';
import { JwtAuthGuard } from '../../shared/jwt-auth.guard';
import { AdminGuard } from '../../shared/admin.guard';
import { ApiFeatures } from '../../shared/api-features';

@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin/files')
export class AdminFilesController {
  constructor(
    @InjectRepository(FileAttachment)
    private readonly fileRepo: Repository<FileAttachment>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly filesService: FilesService,
    private readonly queueManager: QueueManagerService,
  ) {}

  @Get('stats')
  async getFileStats() {
    const totalFiles = await this.fileRepo.count({ where: { isDeleted: false } });
    const processingFiles = await this.fileRepo.count({
      where: { isDeleted: false, status: 'processing' },
    });
    const readyFiles = await this.fileRepo.count({
      where: { isDeleted: false, status: 'ready' },
    });
    const errorFiles = await this.fileRepo.count({
      where: { isDeleted: false, status: 'error' },
    });

    const sumResult = await this.fileRepo
      .createQueryBuilder('f')
      .select('SUM(f.fileSize)', 'totalBytes')
      .where('f.isDeleted = false')
      .getRawOne();

    const totalSizeBytes = Number(sumResult?.totalBytes || 0);

    return {
      totalFiles,
      processingFiles,
      readyFiles,
      errorFiles,
      totalSizeBytes,
      totalSizeMb: Number((totalSizeBytes / (1024 * 1024)).toFixed(1)),
    };
  }

  @Get()
  async listFiles(
    @Query('page') pageStr?: string,
    @Query('limit') limitStr?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('searchField') searchField?: string,
    @Query('userId') userId?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'ASC' | 'DESC',
  ) {
    const query = this.fileRepo
      .createQueryBuilder('file')
      .leftJoinAndSelect('file.user', 'user')
      .where('file.isDeleted = false');

    const mappedSort = sortBy === 'name' ? 'originalName' : sortBy === 'size' ? 'fileSize' : (sortBy || 'createdAt');
    const mappedOrder = (sortOrder?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC') as 'ASC' | 'DESC';

    const apiFeatures = new ApiFeatures(
      query,
      {
        page: pageStr,
        limit: limitStr,
        search,
        searchField,
        status: status && status !== 'all' ? status : undefined,
        userId,
        sortBy: mappedSort,
        sortOrder: mappedOrder,
      },
      'file',
    )
      .filter(['status', 'userId'])
      .search(['originalName', 'user.email', 'user.displayName'])
      .sort(mappedSort, mappedOrder)
      .paginate(50);

    const { items: files, total, page, limit, totalPages } = await apiFeatures.exec();

    const items = files.map((f) => ({
      id: f.id,
      originalName: fixUtf8MangledString(f.originalName),
      mimeType: f.mimeType,
      fileType: f.fileType,
      fileSize: Number(f.fileSize),
      status: f.status,
      errorMessage: f.errorMessage,
      createdAt: f.createdAt,
      updatedAt: f.updatedAt,
      conversationId: f.conversationId,
      messageId: f.messageId,
      hasExtractedText: Boolean(f.extractedText),
      metadata: f.metadata,
      user: f.user
        ? {
            id: f.user.id,
            email: f.user.email,
            displayName: f.user.displayName,
          }
        : null,
    }));

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  @Get(':id')
  async getFileDetail(@Param('id') id: string) {
    const file = await this.fileRepo.findOne({
      where: { id, isDeleted: false },
      relations: ['user', 'conversation'],
    });

    if (!file) {
      throw new NotFoundException('فایل یافت نشد');
    }

    return {
      id: file.id,
      originalName: fixUtf8MangledString(file.originalName),
      mimeType: file.mimeType,
      fileType: file.fileType,
      fileSize: Number(file.fileSize),
      status: file.status,
      errorMessage: file.errorMessage,
      extractedText: file.extractedText,
      metadata: file.metadata,
      minioKey: file.minioKey,
      createdAt: file.createdAt,
      updatedAt: file.updatedAt,
      conversationId: file.conversationId,
      messageId: file.messageId,
      conversationTitle: file.conversation?.title,
      user: file.user
        ? {
            id: file.user.id,
            email: file.user.email,
            displayName: file.user.displayName,
          }
        : null,
    };
  }

  @Get(':id/content')
  async getFileContent(
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const file = await this.fileRepo.findOne({
      where: { id, isDeleted: false },
    });

    if (!file) {
      throw new NotFoundException('فایل یافت نشد');
    }

    const buffer = await this.filesService.getFileBuffer(file);
    const fixedName = fixUtf8MangledString(file.originalName);
    const encodedName = encodeURIComponent(fixedName);
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodedName}"; filename*=UTF-8''${encodedName}`,
    );
    res.end(buffer);
  }

  @Post(':id/retry')
  @HttpCode(200)
  async retryFile(@Param('id') id: string) {
    const file = await this.fileRepo.findOne({
      where: { id, isDeleted: false },
    });

    if (!file) {
      throw new NotFoundException('فایل یافت نشد');
    }

    file.status = 'processing';
    file.errorMessage = undefined;
    await this.fileRepo.save(file);

    await this.queueManager.enqueueFileProcessing(file.id);

    return {
      id: file.id,
      status: 'processing',
      message: 'فایل برای پردازش مجدد به صف ارسال شد',
    };
  }

  @Delete(':id')
  @HttpCode(204)
  async deleteFile(@Param('id') id: string) {
    const file = await this.fileRepo.findOne({
      where: { id, isDeleted: false },
    });

    if (!file) {
      throw new NotFoundException('فایل یافت نشد');
    }

    await this.filesService.deleteFile(file.userId, file.id);
  }
}
