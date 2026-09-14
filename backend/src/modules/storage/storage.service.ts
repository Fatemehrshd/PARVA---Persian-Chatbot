import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  InternalServerErrorException,
} from '@nestjs/common';
import * as minio from 'minio';

/**
 * Object storage backed by MinIO (S3-compatible). Configured purely via env
 * (see .env.example). When MinIO env vars are absent the service reports
 * itself as unavailable and every write throws 503 — there is intentionally
 * no silent disk fallback so misconfiguration surfaces immediately.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private client?: minio.Client;
  private readonly bucket = process.env.MINIO_BUCKET || 'codeless';

  get configured(): boolean {
    return Boolean(
      process.env.MINIO_ENDPOINT &&
        process.env.MINIO_ACCESS_KEY &&
        process.env.MINIO_SECRET_KEY,
    );
  }

  private ensure(): minio.Client {
    if (!this.configured)
      throw new ServiceUnavailableException(
        'Object storage (MinIO) is not configured; avatar upload is disabled',
      );
    if (this.client) return this.client;
    this.client = new minio.Client({
      endPoint: process.env.MINIO_ENDPOINT!,
      port: Number(process.env.MINIO_PORT ?? 9000),
      useSSL: (process.env.MINIO_USE_SSL ?? 'false') === 'true',
      accessKey: process.env.MINIO_ACCESS_KEY!,
      secretKey: process.env.MINIO_SECRET_KEY!,
    });
    return this.client;
  }

  /** Ensures the target bucket exists (best-effort; requires admin creds). */
  async ensureBucket(): Promise<void> {
    if (!this.configured) return;
    const c = this.ensure();
    try {
      const exists = await c.bucketExists(this.bucket);
      if (!exists) await c.makeBucket(this.bucket, process.env.MINIO_REGION || 'us-east-1');
    } catch (err) {
      this.logger.warn(`MinIO bucket bootstrap skipped: ${err instanceof Error ? err.message : err}`);
    }
  }

  async put(key: string, data: Buffer, contentType: string): Promise<void> {
    const c = this.ensure();
    await c.putObject(this.bucket, key, data, data.length, {
      'Content-Type': contentType,
    });
  }

  async getBuffer(key: string): Promise<Buffer> {
    const c = this.ensure();
    const stream = await c.getObject(this.bucket, key).catch(() => {
      throw new InternalServerErrorException('failed to read stored object');
    });
    return await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on('data', (d) => chunks.push(Buffer.from(d)));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  }

  async remove(key: string): Promise<void> {
    const c = this.ensure();
    await c.removeObject(this.bucket, key);
  }

  /** Public GET path served by the backend (streams bytes from MinIO). */
  publicUrl(key: string): string {
    const base = (process.env.PUBLIC_BASE_URL || '').replace(/\/+$/, '');
    return `${base}/static/${key}`;
  }
}
