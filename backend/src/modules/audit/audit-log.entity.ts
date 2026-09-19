import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  actorId: string | null;

  @Column({ length: 30, default: 'user' })
  actorType: string;

  @Index()
  @Column({ length: 100 })
  action: string;

  @Index()
  @Column({ length: 50 })
  entityType: string;

  @Index()
  @Column({ type: 'text', nullable: true })
  entityId: string | null;

  @Column({ type: 'jsonb', nullable: true })
  changes: { before?: any; after?: any } | null;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  metadata: Record<string, any>;

  @Column({ type: 'text', nullable: true })
  ip: string | null;

  @Column({ type: 'text', nullable: true })
  userAgent: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
