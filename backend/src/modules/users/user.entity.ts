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
  @Column({ default: 'user' }) role: string;
  @Column({ default: true }) isActive: boolean;
  @CreateDateColumn() createdAt: Date;
  @OneToMany(() => Conversation, (c) => c.user) conversations: Conversation[];
}
