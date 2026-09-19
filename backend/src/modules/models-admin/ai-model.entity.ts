import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { AiProvider } from './ai-provider.entity';

/** Visibility tier of a model, resolved against the caller's role/whitelist. */
export type ModelAccessLevel = 'public' | 'commercial' | 'private';

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
  /** Soft-delete flag; row is kept for audit, hidden from listings. */
  @Column({ default: false }) isDeleted: boolean;
  /** public = everyone, commercial = allowed roles, private = whitelisted users. */
  @Column({ default: 'public' }) accessLevel: ModelAccessLevel;
  /** User ids allowed to see/use this model (only meaningful for private). */
  @Column({ type: 'jsonb', default: [] }) allowedUserIds: string[];
  /** Per-model capability flags. Deep thinking is opt-in by default; only explicitly-enabled models expose it. */
  @Column({ default: false }) supportsThinking: boolean = false;
  @Column({ default: true }) supportsVision: boolean = true;
  @Column({ default: true }) supportsDocument: boolean = true;
  /** Optional maximum reasoning/thinking token budget cap (null = unlimited/model default) */
  @Column({ type: 'int', nullable: true, default: null })
  thinkingBudgetTokens?: number | null;
  @CreateDateColumn() createdAt: Date;
}
