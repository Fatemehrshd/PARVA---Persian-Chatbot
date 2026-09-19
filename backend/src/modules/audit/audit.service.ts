import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './audit-log.entity';

const REDACTED_KEYS = new Set([
  'password',
  'token',
  'accesstoken',
  'refreshtoken',
  'secret',
  'apikey',
  'cardnumber',
  'cvv',
  'authorization',
]);

export function sanitizeAuditData(data: any): any {
  if (!data || typeof data !== 'object') {
    return data;
  }
  if (Array.isArray(data)) {
    return data.map(sanitizeAuditData);
  }
  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    if (REDACTED_KEYS.has(lowerKey) || lowerKey.includes('password') || lowerKey.includes('secret')) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeAuditData(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

export interface CreateAuditLogParams {
  actorId?: string | null;
  actorType?: 'admin' | 'user' | 'system';
  action: string;
  entityType: 'subscription' | 'payment' | 'plan' | 'user' | 'system_setting';
  entityId?: string | null;
  changes?: { before?: any; after?: any } | null;
  metadata?: Record<string, any>;
  ip?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLog)
    private auditRepo: Repository<AuditLog>,
  ) {}

  async log(params: CreateAuditLogParams): Promise<AuditLog> {
    try {
      const sanitizedChanges = params.changes
        ? {
            before: sanitizeAuditData(params.changes.before),
            after: sanitizeAuditData(params.changes.after),
          }
        : null;

      const sanitizedMetadata = sanitizeAuditData(params.metadata || {});

      const entry = this.auditRepo.create({
        actorId: params.actorId ?? null,
        actorType: params.actorType ?? 'user',
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId ? String(params.entityId) : null,
        changes: sanitizedChanges,
        metadata: sanitizedMetadata,
        ip: params.ip ?? null,
        userAgent: params.userAgent ?? null,
      });

      return await this.auditRepo.save(entry);
    } catch (err: any) {
      this.logger.error(`Failed to record audit log: ${err.message}`, err.stack);
      // Audit log failures should not break the main business transaction, return a stub
      return {} as AuditLog;
    }
  }

  async findAll(options: {
    page?: number;
    limit?: number;
    action?: string;
    entityType?: string;
    actorId?: string;
  }) {
    const page = Math.max(1, Number(options.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(options.limit) || 20));
    const skip = (page - 1) * limit;

    const qb = this.auditRepo.createQueryBuilder('log');

    if (options.action) {
      qb.andWhere('log.action = :action', { action: options.action });
    }
    if (options.entityType) {
      qb.andWhere('log.entityType = :entityType', { entityType: options.entityType });
    }
    if (options.actorId) {
      qb.andWhere('log.actorId = :actorId', { actorId: options.actorId });
    }

    qb.orderBy('log.createdAt', 'DESC');
    qb.skip(skip).take(limit);

    const [items, total] = await qb.getManyAndCount();
    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
