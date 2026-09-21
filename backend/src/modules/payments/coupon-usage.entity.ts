import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  Index,
} from 'typeorm';
import { Coupon } from './coupon.entity';
import { User } from '../users/user.entity';
import { Payment } from './payment.entity';

@Entity('coupon_usages')
export class CouponUsage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  couponId: string;

  @ManyToOne(() => Coupon, (c) => c.usages, { onDelete: 'CASCADE' })
  coupon: Coupon;

  @Index()
  @Column()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;

  @Column({ nullable: true })
  paymentId?: string;

  @ManyToOne(() => Payment, { onDelete: 'SET NULL', nullable: true })
  payment?: Payment;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  discountAmount: number;

  @CreateDateColumn()
  createdAt: Date;
}
