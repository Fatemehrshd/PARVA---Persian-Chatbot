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
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FileAttachment } from '../files/file-attachment.entity';
import { User } from '../users/user.entity';
import { FilesService } from '../files/files.service';
import { QueueManagerService } from '../files/queue-manager.service';
import { JwtAuthGuard } from '../../shared/jwt-auth.guard';
import { AdminGuard } from '../../shared/admin.guard';

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
    @Query('userId') userId?: string,
  ) {
    const page = Math.max(1, Number(pageStr) || 1);
    const limit = Math.max(1, Math.min(100, Number(limitStr) || 50));
    const skip = (page - 1) * limit;

    const query = this.fileRepo
      .createQueryBuilder('file')
      .leftJoinAndSelect('file.user', 'user')
      .where('file.isDeleted = false')
      .orderBy('file.createdAt', 'DESC');

    if (status && status !== 'all') {
      query.andWhere('file.status = :status', { status });
    }

    if (userId) {
      query.andWhere('file.userId = :userId', { userId });
    }

    if (search && search.trim()) {
      const q = `%${search.trim().toLowerCase()}%`;
      query.andWhere(
        '(LOWER(file.originalName) LIKE :q OR LOWER(user.email) LIKE :q OR LOWER(user.displayName) LIKE :q OR file.id::text LIKE :q)',
        { q },
      );
    }

    const [files, total] = await query.skip(skip).take(limit).getManyAndCount();

    const items = files.map((f) => ({
      id: f.id,
      originalName: f.originalName,
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
      originalName: file.originalName,
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
