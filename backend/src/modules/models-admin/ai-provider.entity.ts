import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany } from 'typeorm';

/**
 * A configurable AI provider (any OpenAI-compatible endpoint: OpenAI,
 * Ollama, LM Studio, vLLM, ...). Models belong to a provider and inherit
 * its baseUrl/apiKey unless they carry their own override.
 * apiKey is write-only over the API: every response masks it (`sk-...last4`).
 */
@Entity('ai_providers')
export class AiProvider {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ unique: true }) name: string;
  @Column({ nullable: true }) baseUrl?: string;
  @Column({ nullable: true }) apiKey?: string;
  @Column({ default: true }) isActive: boolean;
  /** This provider's default model (admin can always re-point it). */
  @Column({ nullable: true }) defaultModelId?: string;
  @CreateDateColumn() createdAt: Date;
}
