import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { FileProcessorService } from './file-processor.service';

@Injectable()
export class QueueManagerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueManagerService.name);
  private redisClient?: IORedis;
  private isRedisAvailable = false;

  private fileQueue?: Queue;
  private fileWorker?: Worker;

  private messageQueue?: Queue;
  private messageWorker?: Worker;

  // In-memory fallback queue for environments without Redis (e.g. CI / unit tests)
  private readonly pendingMessageJobs: Array<{
    jobId: string;
    data: any;
    handler: (data: any) => Promise<any>;
  }> = [];

  constructor(private readonly fileProcessor: FileProcessorService) {}

  async onModuleInit() {
    await this.initRedisAndQueues();
  }

  async onModuleDestroy() {
    await this.closeQueues();
  }

  private async initRedisAndQueues() {
    const host = process.env.REDIS_HOST || '127.0.0.1';
    const port = Number(process.env.REDIS_PORT || 6379);

    try {
      this.redisClient = new IORedis({
        host,
        port,
        maxRetriesPerRequest: null,
        connectTimeout: 2000,
        retryStrategy: () => null,
        lazyConnect: true,
      });

      this.redisClient.on('error', () => {
        // Handled silently to prevent unhandled error event spam when Redis is off
      });

      await this.redisClient.connect();
      this.isRedisAvailable = true;
      this.logger.log(`Connected to Redis at ${host}:${port}. Initializing BullMQ queues...`);

      // 1. File Processing Queue & Worker
      this.fileQueue = new Queue('file-processing', { connection: this.redisClient });
      this.fileWorker = new Worker(
        'file-processing',
        async (job: Job<{ fileId: string }>) => {
          this.logger.log(`Processing file job ${job.id} for fileId: ${job.data.fileId}`);
          await this.fileProcessor.processFile(job.data.fileId);
        },
        { connection: this.redisClient, concurrency: 5 },
      );

      this.fileWorker.on('failed', (job, err) => {
        this.logger.error(`File processing job ${job?.id} failed: ${err.message}`);
      });

      // 2. Message Queue
      this.messageQueue = new Queue('message-queue', { connection: this.redisClient });
    } catch (err: any) {
      this.isRedisAvailable = false;
      try {
        this.redisClient?.disconnect();
      } catch {}
      this.logger.warn(
        `Redis is unavailable (${err?.message || err}). Falling back to asynchronous in-memory queues.`,
      );
    }
  }

  /**
   * Dispatches a file for asynchronous background processing.
   */
  async enqueueFileProcessing(fileId: string): Promise<void> {
    if (this.isRedisAvailable && this.fileQueue) {
      try {
        await this.fileQueue.add('process-file', { fileId });
        return;
      } catch (err) {
        this.logger.warn(`Failed to enqueue in BullMQ, falling back to in-memory execution: ${err}`);
      }
    }

    // In-memory fallback
    setImmediate(async () => {
      try {
        await this.fileProcessor.processFile(fileId);
      } catch (err: any) {
        this.logger.error(`In-memory file processing failed: ${err?.message || err}`);
      }
    });
  }

  /**
   * Enqueues a chat message when previous streaming is active.
   */
  async enqueueChatMessage(
    messageData: {
      conversationId: string;
      userId: string;
      content: string;
      fileIds?: string[];
    },
    executor: (data: typeof messageData) => Promise<void>,
  ): Promise<string> {
    const jobId = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    if (this.isRedisAvailable && this.messageQueue) {
      try {
        await this.messageQueue.add('chat-message', messageData, { jobId });
        // Start worker or listener if not yet created
        return jobId;
      } catch (err) {
        this.logger.warn(`Failed to enqueue message in BullMQ: ${err}`);
      }
    }

    // In-memory fallback: store job and execute
    this.pendingMessageJobs.push({
      jobId,
      data: messageData,
      handler: executor,
    });

    return jobId;
  }

  private async closeQueues() {
    if (this.fileWorker) await this.fileWorker.close();
    if (this.fileQueue) await this.fileQueue.close();
    if (this.messageWorker) await this.messageWorker.close();
    if (this.messageQueue) await this.messageQueue.close();
    if (this.redisClient) await this.redisClient.quit().catch(() => {});
  }
}
