import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { SubscriptionPlan } from './subscription-plan.entity';
import { AiModel } from '../models-admin/ai-model.entity';

@Entity('plan_models')
@Index(['planId', 'modelId'], { unique: true })
export class PlanModel {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  planId: string;

  @ManyToOne(() => SubscriptionPlan, (p) => p.planModels, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'planId' })
  plan: SubscriptionPlan;

  @Column({ type: 'uuid' })
  modelId: string;

  @ManyToOne(() => AiModel, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'modelId' })
  model: AiModel;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
