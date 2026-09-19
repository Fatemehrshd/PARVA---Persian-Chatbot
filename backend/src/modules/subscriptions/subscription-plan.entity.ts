import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { PlanModel } from './plan-model.entity';
import { Subscription } from './subscription.entity';

@Entity('subscription_plans')
export class SubscriptionPlan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 50 })
  slug: string;

  @Column({ length: 100 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'bigint', default: 0 })
  price: string;

  @Column({ length: 10, default: 'IRR' })
  currency: string;

  @Column({ type: 'int', default: 30 })
  durationDays: number;

  @Column({ type: 'int', default: 0 })
  tokenQuota: number;

  @Column({ type: 'int', nullable: true })
  messageQuota: number | null;

  @Column({ type: 'int', default: 6 })
  resetHours: number;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  features: {
    webSearch?: boolean;
    thinking?: boolean;
    document?: boolean;
    maxFileSizeMb?: number;
    [key: string]: any;
  };

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'boolean', default: false })
  isDefault: boolean;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @Column({ type: 'boolean', default: false })
  isDeleted: boolean;

  @OneToMany(() => PlanModel, (pm) => pm.plan, { cascade: true })
  planModels: PlanModel[];

  @OneToMany(() => Subscription, (s) => s.plan)
  subscriptions: Subscription[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
