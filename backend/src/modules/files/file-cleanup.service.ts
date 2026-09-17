import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, IsNull } from 'typeorm';
import { FileAttachment } from './file-attachment.entity';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class FileCleanupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FileCleanupService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    @InjectRepository(FileAttachment)
    private readonly fileRepo: Repository<FileAttachment>,
    private readonly storage: StorageService,
  ) {}

  onModuleInit() {
    // Run cleanup every 1 hour (3600000 ms)
    this.timer = setInterval(() => {
      this.runCleanup().catch((err) => {
        this.logger.error(`File cleanup cron error: ${err.message}`);
      });
    }, 3600000);

    // Initial check on boot
    setTimeout(() => this.runCleanup().catch(() => {}), 5000);
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  /**
   * Cleans up unattached files older than 2 days (48 hours).
   */
  async runCleanup(): Promise<number> {
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);

    // Find files without attached message created more than 48 hours ago
    const expiredFiles = await this.fileRepo.find({
      where: [
        {
          messageId: IsNull(),
          expiresAt: LessThanOrEqual(new Date()),
          isDeleted: false,
        },
        {
          messageId: IsNull(),
          createdAt: LessThanOrEqual(twoDaysAgo),
          isDeleted: false,
        },
      ],
      take: 100,
    });

    if (expiredFiles.length === 0) return 0;

    let count = 0;
    for (const file of expiredFiles) {
      try {
        await this.storage.delete(file.minioKey);
        file.isDeleted = true;
        await this.fileRepo.save(file);
        count++;
      } catch (err: any) {
        this.logger.warn(`Failed to cleanup file ${file.id}: ${err.message}`);
      }
    }

    this.logger.log(`Cleaned up ${count} expired unused file attachments.`);
    return count;
  }
}
