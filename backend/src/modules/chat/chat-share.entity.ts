import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  Index,
} from 'typeorm';
import { Conversation } from './conversation.entity';
import { User } from '../users/user.entity';

@Entity('chat_shares')
export class ChatShare {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ length: 32 })
  shareCode: string;

  @ManyToOne(() => Conversation, { onDelete: 'SET NULL', nullable: true })
  conversation: Conversation;

  @Column({ nullable: true })
  conversationId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;

  @Column()
  userId: string;

  @Column()
  title: string;

  @Column({ nullable: true })
  modelId: string;

  @Column({ nullable: true })
  modelName: string;

  /**
   * Immutable / frozen snapshot of messages as of the share creation timestamp.
   * Subsequent messages or message edits in the original conversation do NOT affect this snapshot.
   */
  @Column('jsonb')
  snapshotMessages: Array<{
    id: string;
    role: string;
    content: string;
    createdAt: string;
    sources?: any;
    reasoning_content?: string | null;
    thinkingDurationMs?: number | null;
    attachments?: any;
  }>;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: 0 })
  viewCount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
