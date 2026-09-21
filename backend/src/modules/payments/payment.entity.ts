import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { User } from '../users/user.entity';
import { SubscriptionPlan } from '../subscriptions/subscription-plan.entity';

export enum PaymentStatus {
  PENDING = 'PENDING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED',
}

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'uuid' })
  planId: string;

  @ManyToOne(() => SubscriptionPlan, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'planId' })
  plan: SubscriptionPlan;

  @Column({ type: 'bigint' })
  amount: string;

  /** Original price before discount in Rials */
  @Column({ type: 'bigint', nullable: true })
  originalAmount?: string | null;

  /** Discount amount applied in Rials */
  @Column({ type: 'bigint', nullable: true, default: '0' })
  discountAmount?: string | null;

  @Column({ type: 'uuid', nullable: true })
  couponId?: string | null;

  @ManyToOne('Coupon', 'payments', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'couponId' })
  coupon?: any;

  @Column({ length: 10, default: 'IRR' })
  currency: string;

  @Column({
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
  })
  status: PaymentStatus;

  @Column({ length: 50, default: 'sandbox' })
  gateway: string;

  @Index({ unique: true })
  @Column({ length: 100, nullable: true })
  authority: string | null;

  @Column({ length: 100, nullable: true })
  refId: string | null;

  @Index({ unique: true })
  @Column({ length: 100, nullable: true })
  idempotencyKey: string | null;

  @Column({ type: 'text', nullable: true })
  ip: string | null;

  @Column({ type: 'text', nullable: true })
  userAgent: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  verifiedAt: Date | null;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  metadata: Record<string, any>;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
