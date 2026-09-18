import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany } from 'typeorm';
import { Conversation } from '../chat/conversation.entity';
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ unique: true }) email: string;
  @Column() passwordHash: string;
  @Column({ nullable: true }) displayName: string;
  /** Optional unique handle (lowercase, [a-z0-9_]); reserved for profiles. */
  @Column({ unique: true, nullable: true }) username?: string;
  /** Public URL served by the backend from object storage (see StorageService). */
  @Column({ nullable: true }) avatarUrl?: string;
  /** Internal object-storage key (avatars/<id>/<file>) so replacing can delete it. */
  @Column({ nullable: true }) avatarKey?: string;
  @Column({ default: 0 }) usedTokens: number;
  @Column({ type: 'int', nullable: true, default: null }) tokenLimit?: number | null;
  @Column({ type: 'int', nullable: true, default: null }) messageLimit?: number | null;
  /** شروع دوره سهمیه جاری (ریست تنبل). */
  @Column({ type: 'timestamptz', nullable: true, default: null }) periodStart?: Date | null;
  @Column({ type: 'int', default: 0 }) periodUsedTokens: number;
  @Column({ type: 'int', default: 0 }) periodUsedMessages: number;
  /** شمارش توکن به تفکیک نوع کار: { normal, image, document, thinking } */
  @Column({ type: 'jsonb', default: {} }) usageByType?: Record<string, number>;
  @Column({ default: 'user' }) role: string;
  @Column({ default: true }) isActive: boolean;
  /** Soft-delete flag; row is kept for audit, hidden from all listings/auth. */
  @Column({ default: false }) isDeleted: boolean;
  @CreateDateColumn() createdAt: Date;
  @OneToMany(() => Conversation, (c) => c.user) conversations: Conversation[];
}
