import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';
@Entity('ai_models')
export class AiModel {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() name: string;
  @Column() provider: string;
  @Column() apiIdentifier: string;
  @Column({ default: true }) isActive: boolean;
  @Column({ default: false }) isDefault: boolean;
  @CreateDateColumn() createdAt: Date;
}
