import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Conversation } from '../chat/conversation.entity';
import { Message } from '../chat/message.entity';

export type FileAttachmentType = 'image' | 'pdf' | 'excel' | 'text';
export type FileAttachmentStatus = 'uploading' | 'processing' | 'ready' | 'error';

@Entity('file_attachments')
export class FileAttachment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: true })
  user?: User;

  @Column({ nullable: true })
  conversationId?: string;

  @ManyToOne(() => Conversation, { onDelete: 'SET NULL', nullable: true })
  conversation?: Conversation;

  @Column({ nullable: true })
  messageId?: string;

  @ManyToOne(() => Message, (m) => m.attachments, { onDelete: 'SET NULL', nullable: true })
  message?: Message;

  @Column()
  originalName: string;

  @Column()
  mimeType: string;

  @Column({
    type: 'varchar',
    default: 'image',
  })
  fileType: FileAttachmentType;

  @Column({ type: 'bigint' })
  fileSize: number;

  @Column()
  minioKey: string;

  @Column({
    type: 'varchar',
    default: 'processing',
  })
  status: FileAttachmentStatus;

  @Column({ type: 'text', nullable: true })
  errorMessage?: string;

  @Column({ type: 'text', nullable: true })
  extractedText?: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @Column({ default: false })
  isDeleted: boolean;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
