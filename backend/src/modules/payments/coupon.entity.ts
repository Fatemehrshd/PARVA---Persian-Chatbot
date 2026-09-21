import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { CouponUsage } from './coupon-usage.entity';
import { Payment } from './payment.entity';

export type DiscountType = 'PERCENTAGE' | 'FIXED';

@Entity('coupons')
export class Coupon {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ unique: true })
  code: string;

  @Column({ nullable: true })
  description?: string;

  @Column({ type: 'varchar', length: 20, default: 'PERCENTAGE' })
  discountType: DiscountType;

  /** Percentage (e.g. 20 for 20%) or Fixed amount in Rials (e.g. 500000) */
  @Column({ type: 'decimal', precision: 12, scale: 2 })
  discountValue: number;

  /** Maximum discount amount in Rials for percentage discounts */
  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  maxDiscountAmount?: number | null;

  /** Minimum plan price in Rials required to use this coupon */
  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  minOrderAmount?: number | null;

  /** Total usage limit across all users */
  @Column({ type: 'int', nullable: true })
  usageLimit?: number | null;

  /** Number of times this coupon has been successfully used */
  @Column({ type: 'int', default: 0 })
  usedCount: number;

  /** Maximum times a single user can use this coupon */
  @Column({ type: 'int', default: 1 })
  perUserLimit: number;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt?: Date | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @OneToMany(() => CouponUsage, (u) => u.coupon)
  usages: CouponUsage[];

  @OneToMany(() => Payment, (p) => p.coupon)
  payments: Payment[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
