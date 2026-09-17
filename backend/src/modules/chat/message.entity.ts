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
  @OneToMany(() => FileAttachment, (f) => f.message)
  attachments: FileAttachment[];
  @CreateDateColumn() createdAt: Date;
}
