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
  /** Soft-delete flag; row is kept for audit, hidden from listings. */
  @Column({ default: false }) isDeleted: boolean;
  @CreateDateColumn() createdAt: Date;
}
