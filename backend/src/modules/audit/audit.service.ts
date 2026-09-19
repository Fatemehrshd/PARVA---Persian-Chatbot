import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './audit-log.entity';
import { traceContextService } from '../../shared/trace-context.service';
import { registerTracedFetchAuditLogger } from '../../shared/traced-fetch';

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
  traceId?: string | null;
  spanId?: string | null;
  actorId?: string | null;
  actorType?: 'admin' | 'user' | 'system' | string;
  action: string;
  entityType:
    | 'subscription'
    | 'payment'
    | 'plan'
    | 'user'
    | 'system_setting'
    | 'http_request'
    | 'external_fetch'
    | string;
  entityId?: string | null;
  method?: string | null;
  path?: string | null;
  statusCode?: number | null;
  durationMs?: number | null;
  errorMessage?: string | null;
  changes?: { before?: any; after?: any } | null;
  metadata?: Record<string, any>;
  ip?: string | null;
  userAgent?: string | null;
}

export interface FindAuditLogsOptions {
  page?: number;
  limit?: number;
  search?: string;
  traceId?: string;
  action?: string;
  entityType?: string;
  actorId?: string;
  status?: 'all' | 'success' | 'error' | string;
  type?: 'all' | 'http_request' | 'external_fetch' | 'security' | string;
}

@Injectable()
export class AuditService implements OnModuleInit {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLog)
    private auditRepo: Repository<AuditLog>,
  ) {}

  onModuleInit() {
    // Connect tracedFetch with this AuditService instance
    registerTracedFetchAuditLogger(async (entry) => {
      await this.log(entry as CreateAuditLogParams);
    });
  }

  async log(params: CreateAuditLogParams): Promise<AuditLog> {
    try {
      const activeTraceId = params.traceId ?? traceContextService.getTraceId() ?? null;
      const activeSpanId = params.spanId ?? traceContextService.getSpanId() ?? null;

      const sanitizedChanges = params.changes
        ? {
            before: sanitizeAuditData(params.changes.before),
            after: sanitizeAuditData(params.changes.after),
          }
        : null;

      const sanitizedMetadata = sanitizeAuditData(params.metadata || {});

      const entry = this.auditRepo.create({
        traceId: activeTraceId,
        spanId: activeSpanId,
        actorId: params.actorId ?? null,
        actorType: params.actorType ?? 'user',
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId ? String(params.entityId) : null,
        method: params.method ?? null,
        path: params.path ?? null,
        statusCode: typeof params.statusCode === 'number' ? params.statusCode : null,
        durationMs: typeof params.durationMs === 'number' ? params.durationMs : null,
        errorMessage: params.errorMessage ?? null,
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

  async findAll(options: FindAuditLogsOptions) {
    const page = Math.max(1, Number(options.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(options.limit) || 20));
    const skip = (page - 1) * limit;

    const qb = this.auditRepo.createQueryBuilder('log');

    // 1. Text search across action, path, traceId, errorMessage
    if (options.search && options.search.trim().length > 0) {
      const search = `%${options.search.trim()}%`;
      qb.andWhere(
        '(log.action ILIKE :search OR log.path ILIKE :search OR log.traceId ILIKE :search OR log.errorMessage ILIKE :search OR log.entityType ILIKE :search)',
        { search },
      );
    }

    // 2. Exact or partial traceId filter
    if (options.traceId && options.traceId.trim().length > 0) {
      qb.andWhere('log.traceId ILIKE :traceId', { traceId: `%${options.traceId.trim()}%` });
    }

    // 3. Status filter
    if (options.status === 'success') {
      qb.andWhere('(log.statusCode IS NULL OR log.statusCode < 400) AND log.errorMessage IS NULL');
    } else if (options.status === 'error') {
      qb.andWhere('(log.statusCode >= 400 OR log.errorMessage IS NOT NULL OR log.action ILIKE :errKeyword)', {
        errKeyword: '%failed%',
      });
    }

    // 4. Type filter
    if (options.type === 'http_request') {
      qb.andWhere('log.entityType = :reqType', { reqType: 'http_request' });
    } else if (options.type === 'external_fetch') {
      qb.andWhere('log.entityType = :fetchType', { fetchType: 'external_fetch' });
    } else if (options.type === 'security') {
      qb.andWhere('log.entityType NOT IN (:...excludeTypes)', {
        excludeTypes: ['http_request', 'external_fetch'],
      });
    }

    // 5. Explicit action / entityType / actorId
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

    // Quick stats aggregations for the admin dashboard
    let stats = {
      totalLogs: total,
      errorCount: 0,
      fetchCount: 0,
      avgDurationMs: 0,
    };

    try {
      const statsQb = this.auditRepo.createQueryBuilder('log');
      const statResults = await statsQb
        .select('COUNT(*)', 'total')
        .addSelect(
          "COUNT(CASE WHEN (log.statusCode >= 400 OR log.errorMessage IS NOT NULL) THEN 1 END)",
          'errors',
        )
        .addSelect("COUNT(CASE WHEN log.entityType = 'external_fetch' THEN 1 END)", 'fetches')
        .addSelect('AVG(log.durationMs)', 'avgDuration')
        .getRawOne();

      if (statResults) {
        stats = {
          totalLogs: Number(statResults.total) || 0,
          errorCount: Number(statResults.errors) || 0,
          fetchCount: Number(statResults.fetches) || 0,
          avgDurationMs: Math.round(Number(statResults.avgDuration) || 0),
        };
      }
    } catch {
      // Non-blocking stats fallback
    }

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      stats,
    };
  }
}
