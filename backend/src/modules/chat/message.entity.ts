import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, OneToMany } from 'typeorm';
import { Conversation } from './conversation.entity';
import { FileAttachment } from '../files/file-attachment.entity';

@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn('uuid') id: string;
  @ManyToOne(() => Conversation, (c) => c.messages, { onDelete: 'CASCADE' })
  conversation: Conversation;
  @Column() conversationId: string;
  @Column() role: string;
  @Column('text') content: string;
  @Column({ default: false }) isInterrupted: boolean;
  @Column({ default: false }) stoppedByUser: boolean;
  @Column({ default: false }) isDeleted: boolean;
  /** Web-search sources attached to this assistant reply (null when unused). */
  @Column({ type: 'jsonb', nullable: true, default: null })
  sources?: { title: string; url: string; snippet?: string }[] | null;
  /** User feedback on assistant responses: 'like' | 'dislike' | null */
  @Column({ type: 'varchar', length: 20, nullable: true, default: null })
  feedback?: 'like' | 'dislike' | null;
  @OneToMany(() => FileAttachment, (f) => f.message)
  attachments: FileAttachment[];
  @CreateDateColumn() createdAt: Date;
}
