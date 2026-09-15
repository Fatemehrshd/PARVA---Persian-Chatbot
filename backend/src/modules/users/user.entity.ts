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
  @Column({ type: 'text', nullable: true }) bio?: string;
  /** Public URL served by the backend from object storage (see StorageService). */
  @Column({ nullable: true }) avatarUrl?: string;
  /** Internal object-storage key (avatars/<id>/<file>) so replacing can delete it. */
  @Column({ nullable: true }) avatarKey?: string;
  @Column({ default: 'user' }) role: string;
  // ---- user preferences ----
  @Column({ default: 'fa' }) language: string;
  @Column({ default: 'dark' }) theme: string;
  @Column({ nullable: true }) timezone?: string;
  /** The user's preferred chat model; falls back to the platform default. */
  @Column({ nullable: true }) defaultModelId?: string;
  /** Total tokens consumed by the user across chats */
  @Column({ type: 'int', default: 0 }) usedTokens: number;
  @CreateDateColumn() createdAt: Date;
  @OneToMany(() => Conversation, (c) => c.user) conversations: Conversation[];
}
