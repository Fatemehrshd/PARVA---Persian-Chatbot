import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FileAttachment, FileAttachmentType } from './file-attachment.entity';
import { StorageService } from '../storage/storage.service';
import { MalwareScannerService } from './malware-scanner.service';
import { QueueManagerService } from './queue-manager.service';
import { SettingsService } from '../admin/settings.service';
import { randomUUID } from 'crypto';

export interface UploadedFileInfo {
  id: string;
  originalName: string;
  mimeType: string;
  fileType: FileAttachmentType;
  fileSize: number;
  status: string;
  url?: string;
  expiresAt?: Date;
}

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);

  constructor(
    @InjectRepository(FileAttachment)
    private readonly fileRepo: Repository<FileAttachment>,
    private readonly storage: StorageService,
    private readonly scanner: MalwareScannerService,
    private readonly queue: QueueManagerService,
    private readonly settings: SettingsService,
  ) {}

  /**
   * Retrieves dynamic limits configured in system settings.
   */
  async getUploadLimits() {
    const maxFileSizeMb = Number(await this.settings.get('file_max_size_mb')) || 20;
    const maxTotalSizeMb = Number(await this.settings.get('file_max_total_size_mb')) || 50;
    const maxFileCount = Number(await this.settings.get('file_max_count')) || 5;

    return {
      maxFileSizeMb,
      maxTotalSizeMb,
      maxFileCount,
      maxFileSizeBytes: maxFileSizeMb * 1024 * 1024,
      maxTotalSizeBytes: maxTotalSizeMb * 1024 * 1024,
    };
  }

  /**
   * Identifies attachment type from mimeType and filename.
   */
  resolveFileType(mimeType: string, filename: string): FileAttachmentType {
    const lowerName = filename.toLowerCase();

    // 1. Image formats: PNG, JPG, JPEG, JFIF, WEBP, GIF, SVG
    const isImageExt = /\.(jpg|jpeg|jfif|png|webp|gif|svg)$/i.test(lowerName);
    const isImageMime = mimeType.startsWith('image/') || mimeType === 'image/jpeg' || mimeType === 'image/pjpeg';
    if (isImageExt && (isImageMime || mimeType === 'application/octet-stream')) {
      return 'image';
    }

    // 2. PDF documents: .pdf
    const isPdfExt = lowerName.endsWith('.pdf');
    const isPdfMime = mimeType === 'application/pdf';
    if (isPdfExt && (isPdfMime || mimeType === 'application/octet-stream')) {
      return 'pdf';
    }

    // 3. Excel & Spreadsheet documents: .xlsx, .xls, .csv
    const isExcelExt = /\.(xlsx|xls|csv)$/i.test(lowerName);
    const isExcelMime =
      mimeType.includes('spreadsheet') ||
      mimeType.includes('excel') ||
      mimeType.includes('csv') ||
      mimeType === 'text/csv' ||
      mimeType === 'application/csv' ||
      mimeType === 'application/vnd.ms-excel' ||
      mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    if (isExcelExt && (isExcelMime || mimeType === 'application/octet-stream' || mimeType.startsWith('text/'))) {
      return 'excel';
    }

    // 4. Text & Markdown documents: .txt, .md, .text, .markdown
    const isTextExt = /\.(txt|md|text|markdown)$/i.test(lowerName);
    const isTextMime =
      mimeType.startsWith('text/') ||
      mimeType === 'application/octet-stream' ||
      mimeType === 'text/plain' ||
      mimeType === 'text/markdown' ||
      mimeType === 'text/x-markdown';
    if (isTextExt && (isTextMime || mimeType === 'application/octet-stream')) {
      return 'text';
    }

    throw new BadRequestException(
      'فرمت فایل انتخاب‌شده مجاز نیست. تنها فرمت‌های عکس (PNG, JPG, JPEG, JFIF, WEBP, GIF, SVG)، اسناد متنی (TXT, MD)، اسناد PDF و اکسل (XLSX, XLS, CSV) پشتیبانی می‌شوند.',
    );
  }

  /**
   * Pre-storage pipeline & secure upload.
   */
  async uploadFile(
    userId: string,
    file: Express.Multer.File,
    conversationId?: string,
  ): Promise<UploadedFileInfo> {
    const limits = await this.getUploadLimits();

    try {
      // 1. Validate file size
      if (file.size > limits.maxFileSizeBytes) {
        throw new BadRequestException(
          `حجم فایل (${(file.size / (1024 * 1024)).toFixed(1)} مگابایت) بیشتر از سقف مجاز (${limits.maxFileSizeMb} مگابایت) است`,
        );
      }

      // 2. Validate file type
      const fileType = this.resolveFileType(file.mimetype, file.originalname);

      // 3. Pre-storage Security & Malware Scan Pipeline
      const scanResult = await this.scanner.scanBuffer(file.buffer, file.originalname);
      if (scanResult.isInfected) {
        throw new BadRequestException('فایل ناسالم تشخیص داده شد');
      }

      // 4. Store in MinIO with Server-Side Encryption
      const safeExt = file.originalname.split('.').pop() || '';
      const minioKey = `attachments/${userId}/${randomUUID()}.${safeExt}`;
      await this.storage.put(minioKey, file.buffer, file.mimetype);

      // 5. Persist record in database
      const twoDaysFromNow = new Date(Date.now() + 48 * 60 * 60 * 1000);
      const record = this.fileRepo.create({
        userId,
        conversationId,
        originalName: file.originalname,
        mimeType: file.mimetype,
        fileType,
        fileSize: file.size,
        minioKey,
        status: 'processing',
        expiresAt: twoDaysFromNow,
      });

      const saved = await this.fileRepo.save(record);

      // 6. Enqueue for Async processing in BullMQ
      await this.queue.enqueueFileProcessing(saved.id);

      return {
        id: saved.id,
        originalName: saved.originalName,
        mimeType: saved.mimeType,
        fileType: saved.fileType,
        fileSize: saved.fileSize,
        status: saved.status,
        expiresAt: saved.expiresAt,
      };
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }

      const message =
        error instanceof Error ? error.message : 'خطا در ذخیره‌سازی فایل روی سرور';

      this.logger.error(`Upload failed for user ${userId}: ${message}`);
      throw new Error(`آپلود فایل با خطا مواجه شد: ${message}`);
    }
  }

  /**
   * Cancels active upload or removes file attachment from MinIO & database.
   */
  async deleteFile(userId: string, fileId: string): Promise<void> {
    const file = await this.fileRepo.findOne({ where: { id: fileId, userId } });
    if (!file) {
      // already deleted or doesn't exist
      return;
    }

    // Delete object from MinIO
    if (file.minioKey) {
      await this.storage.delete(file.minioKey);
    }

    // Mark as deleted (Soft Delete)
    file.isDeleted = true;
    await this.fileRepo.save(file);
  }

  /**
   * Retrieves current status of an uploaded file.
   */
  async getFileStatus(userId: string, fileId: string) {
    const file = await this.fileRepo.findOne({
      where: { id: fileId, userId, isDeleted: false },
    });

    if (!file) {
      throw new NotFoundException('فایل یافت نشد');
    }

    return {
      id: file.id,
      originalName: file.originalName,
      mimeType: file.mimeType,
      fileType: file.fileType,
      fileSize: file.fileSize,
      status: file.status,
      errorMessage: file.errorMessage,
      metadata: file.metadata,
      hasExtractedText: Boolean(file.extractedText),
    };
  }

  /**
   * Retries processing for a file with 'error' status.
   */
  async retryFileProcessing(userId: string, fileId: string) {
    const file = await this.fileRepo.findOne({
      where: { id: fileId, userId, isDeleted: false },
    });

    if (!file) {
      throw new NotFoundException('فایل یافت نشد');
    }

    file.status = 'processing';
    file.errorMessage = undefined;
    await this.fileRepo.save(file);

    await this.queue.enqueueFileProcessing(file.id);

    return { id: file.id, status: 'processing' };
  }

  /**
   * Finds multiple ready files by IDs.
   */
  async getFilesByIds(userId: string, ids: string[]): Promise<FileAttachment[]> {
    if (!ids || ids.length === 0) return [];
    return this.fileRepo.find({
      where: ids.map((id) => ({ id, userId, isDeleted: false })),
    });
  }

  /**
   * Retrieves file entity record owned by user.
   */
  async getFileRecord(userId: string, fileId: string): Promise<FileAttachment> {
    const file = await this.fileRepo.findOne({
      where: { id: fileId, userId, isDeleted: false },
    });
    if (!file) {
      throw new NotFoundException('فایل یافت نشد');
    }
    return file;
  }

  /**
   * Retrieves binary buffer for a file attachment from MinIO.
   */
  async getFileBuffer(file: FileAttachment): Promise<Buffer> {
    return this.storage.getBuffer(file.minioKey);
  }
}
