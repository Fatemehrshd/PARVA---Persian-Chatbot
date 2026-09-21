import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * Transactional Outbox events.
 *
 * Rows are inserted in the SAME database transaction as the business change
 * (e.g. payment verification, subscription assignment) so the audit event is
 * guaranteed to be written if and only if the business change commits.
 * A background relay (OutboxService) drains the table and invokes
 * AuditService.log for each event, with retries on failure.
 */
@Entity('outbox_events')
@Index(['status', 'nextAttemptAt'])
export class OutboxEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Logical event type, e.g. 'audit.log' */
  @Column({ length: 100 })
  type: string;

  /** JSON payload dispatched to the consumer (AuditService.log params) */
  @Column({ type: 'jsonb' })
  payload: Record<string, any>;

  /** pending | processing | done | failed */
  @Index()
  @Column({ length: 20, default: 'pending' })
  status: string;

  /** Number of delivery attempts so far */
  @Column({ type: 'int', default: 0 })
  attempts: number;

  /** Earliest time the relay may pick this row again (exponential backoff) */
  @Column({ type: 'timestamptz', nullable: true })
  nextAttemptAt: Date | null;

  /** Last consumer error message (for debugging stuck events) */
  @Column({ type: 'text', nullable: true })
  lastError: string | null;

  /** Trace correlation so relayed audit logs keep their original trace */
  @Column({ length: 64, nullable: true })
  traceId: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
