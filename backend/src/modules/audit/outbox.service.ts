import { Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager, LessThan, In, Not } from 'typeorm';
import { OutboxEvent } from './outbox-event.entity';
import { AuditService, CreateAuditLogParams } from './audit.service';
import { traceContextService } from '../../shared/trace-context.service';

const DEFAULT_BATCH_SIZE = 50;
const DEFAULT_POLL_INTERVAL_MS = 5_000;
const MAX_ATTEMPTS = 8;
const BASE_BACKOFF_MS = 2_000;
/** Events stuck in `processing` longer than this are considered abandoned (crash recovery) */
const PROCESSING_STALE_MS = 60_000;
/** Done events are cleaned up after this age to keep the table small */
const DONE_RETENTION_MS = 24 * 60 * 60 * 1000;

/**
 * Transactional Outbox relay.
 *
 * Producers call `enqueue(manager, params)` INSIDE their business transaction;
 * this service polls the outbox table afterwards and delivers events to
 * AuditService.log with retries and exponential backoff. This guarantees the
 * "at-least-once" audit trail without coupling audit writes to the business
 * transaction's commit latency.
 */
@Injectable()
export class OutboxService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxService.name);
  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private isDraining = false;

  constructor(
    @InjectRepository(OutboxEvent)
    private outboxRepo: Repository<OutboxEvent>,
    private auditService: AuditService,
    @Optional()
    private dataSource?: DataSource,
  ) {}

  onModuleInit() {
    this.schedulePoll();
  }

  onModuleDestroy() {
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
  }

  /**
   * Enqueue an audit-log event inside the caller's transaction.
   * Must be called with the transaction's EntityManager so the outbox row
   * commits (or rolls back) atomically with the business change.
   */
  async enqueue(
    manager: EntityManager,
    params: CreateAuditLogParams,
    traceId?: string | null,
  ): Promise<void> {
    const row = manager.getRepository(OutboxEvent).create({
      type: 'audit.log',
      payload: params as Record<string, any>,
      status: 'pending',
      attempts: 0,
      traceId: traceId ?? params.traceId ?? traceContextService.getTraceId() ?? null,
    });
    await manager.getRepository(OutboxEvent).save(row);
  }

  /**
   * Convenience method for callers OUTSIDE a transaction: persists the outbox
   * row immediately and returns. Delivery still happens asynchronously via the
   * relay loop, keeping fire-and-forget semantics with at-least-once delivery.
   */
  async enqueueStandalone(params: CreateAuditLogParams): Promise<void> {
    try {
      await this.outboxRepo.save(
        this.outboxRepo.create({
          type: 'audit.log',
          payload: params as Record<string, any>,
          status: 'pending',
          attempts: 0,
          traceId: params.traceId ?? traceContextService.getTraceId() ?? null,
        }),
      );
    } catch (err: any) {
      // Never break business flow because of audit persistence problems
      this.logger.warn(`Failed to enqueue standalone outbox event: ${err.message}`);
    }
  }

  private schedulePoll() {
    this.pollTimer = setTimeout(() => {
      void this.drainOnce()
        .catch((err) => this.logger.error(`Outbox drain failed: ${err.message}`, err.stack))
        .finally(() => this.schedulePoll());
    }, DEFAULT_POLL_INTERVAL_MS);
  }

  /**
   * One relay pass: claim a batch of pending events and deliver each to
   * AuditService.log. Uses FOR UPDATE SKIP LOCKED so multiple app instances
   * can relay concurrently without double-claiming rows.
   */
  async drainOnce(): Promise<number> {
    if (this.isDraining) return 0;
    this.isDraining = true;
    try {
      const claimed: OutboxEvent[] = await this.claimBatch();
      for (const event of claimed) {
        await this.deliver(event);
      }
      await this.cleanupOldDoneEvents();
      return claimed.length;
    } finally {
      this.isDraining = false;
    }
  }

  /**
   * Atomically claim a batch of pending events. Prefer SKIP LOCKED when a real
   * DataSource is available; fall back to a simple UPDATE ... RETURNING for
   * test doubles.
   */
  private async claimBatch(): Promise<OutboxEvent[]> {
    if (this.dataSource?.transaction) {
      try {
        return await this.dataSource.transaction(async (manager) => {
          const now = new Date();
          const staleCutoff = new Date(now.getTime() - PROCESSING_STALE_MS);

          const rows = await manager
            .getRepository(OutboxEvent)
            .createQueryBuilder('o')
            .where('o.status = :pending', { pending: 'pending' })
            .orWhere(
              '(o.status = :processing AND o.nextAttemptAt < :staleCutoff)',
              { processing: 'processing', staleCutoff },
            )
            .orWhere('(o.status = :pendingRetry AND o.nextAttemptAt <= :now)', {
              pendingRetry: 'pending',
              now,
            })
            .orderBy('o.createdAt', 'ASC')
            .limit(DEFAULT_BATCH_SIZE)
            .setLock('pessimistic_write')
            .setOnLocked('skip_locked')
            .getMany();

          if (rows.length === 0) return [];

          await manager
            .getRepository(OutboxEvent)
            .update(
              { id: In(rows.map((r) => r.id)) },
              { status: 'processing' },
            );

          return rows.map((r) => ({ ...r, status: 'processing' }));
        });
      } catch (err: any) {
        // Skip LOCKED unsupported (mock repos in tests) → fall through to simple claim
        this.logger.debug(`SKIP LOCKED claim failed, using fallback: ${err.message}`);
      }
    }

    // Fallback claim (no SKIP LOCKED): pending rows due for delivery
    const now = new Date();
    const due = await this.outboxRepo.find({
      where: [
        { status: 'pending' },
        { status: 'processing', nextAttemptAt: LessThan(new Date(now.getTime() - PROCESSING_STALE_MS)) },
      ],
      order: { createdAt: 'ASC' },
      take: DEFAULT_BATCH_SIZE,
    });
    if (due.length === 0) return [];

    const claimed: OutboxEvent[] = [];
    for (const row of due) {
      const result = await this.outboxRepo.update(
        { id: row.id, status: row.status },
        { status: 'processing' },
      );
      if (result.affected && result.affected > 0) {
        claimed.push({ ...row, status: 'processing' });
      }
    }
    return claimed;
  }

  /**
   * Deliver one event to AuditService.log. On success mark done; on failure
   * schedule a retry with exponential backoff, up to MAX_ATTEMPTS.
   */
  private async deliver(event: OutboxEvent): Promise<void> {
    try {
      const payload = event.payload as CreateAuditLogParams;
      await this.auditService.log({ ...payload, traceId: payload.traceId ?? event.traceId });

      await this.outboxRepo.update(event.id, {
        status: 'done',
        lastError: null,
        nextAttemptAt: null,
      });
    } catch (err: any) {
      const attempts = (event.attempts ?? 0) + 1;
      const canRetry = attempts < MAX_ATTEMPTS;
      const backoffMs = Math.min(BASE_BACKOFF_MS * 2 ** (attempts - 1), 5 * 60_000);

      await this.outboxRepo.update(event.id, {
        status: canRetry ? 'pending' : 'failed',
        attempts,
        lastError: err?.message ?? String(err),
        nextAttemptAt: canRetry ? new Date(Date.now() + backoffMs) : null,
      });

      if (!canRetry) {
        this.logger.error(
          `Outbox event ${event.id} permanently failed after ${attempts} attempts: ${err?.message}`,
        );
      }
    }
  }

  /** Remove old done events to keep the table compact */
  private async cleanupOldDoneEvents(): Promise<void> {
    try {
      const cutoff = new Date(Date.now() - DONE_RETENTION_MS);
      await this.outboxRepo.delete({ status: 'done', createdAt: LessThan(cutoff) });
    } catch {
      // Non-critical housekeeping; ignore failures (e.g. mock repos)
    }
  }

  /** Diagnostic helper for admin dashboards / health checks */
  async getStats() {
    const [pending, processing, failed] = await Promise.all([
      this.outboxRepo.count({ where: { status: 'pending' } }),
      this.outboxRepo.count({ where: { status: 'processing' } }),
      this.outboxRepo.count({ where: { status: In(['failed']) } }),
    ]);
    return { pending, processing, failed, maxAttempts: MAX_ATTEMPTS };
  }
}
