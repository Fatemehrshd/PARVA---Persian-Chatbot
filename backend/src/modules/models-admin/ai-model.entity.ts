import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { AiProvider } from './ai-provider.entity';
@Entity('ai_models')
export class AiModel {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() name: string;
  /** Free-text provider label (kept for backward compatibility / display). */
  @Column() provider: string;
  @Column() apiIdentifier: string;
  /** Optional per-model credential/baseUrl override of its provider. */
  @Column({ nullable: true }) apiKey?: string;
  @Column({ nullable: true }) baseUrl?: string;
  /** Owning provider row (ON DELETE CASCADE from ai_providers). */
  @Column({ nullable: true }) providerId?: string;
  @ManyToOne(() => AiProvider, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'providerId' })
  providerRef?: AiProvider;
  @Column({ default: true }) isActive: boolean;
  @Column({ default: false }) isDefault: boolean;
  /** Per-model capability flags (default: thinking on, vision & document on) */
  @Column({ default: true }) supportsThinking: boolean = true;
  @Column({ default: true }) supportsVision: boolean = true;
  @Column({ default: true }) supportsDocument: boolean = true;
  /** Optional maximum reasoning/thinking token budget cap (null = unlimited/model default) */
  @Column({ type: 'int', nullable: true, default: null })
  thinkingBudgetTokens?: number | null;
  @CreateDateColumn() createdAt: Date;
}
