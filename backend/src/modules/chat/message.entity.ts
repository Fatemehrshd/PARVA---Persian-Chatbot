import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne } from 'typeorm';
import { Conversation } from './conversation.entity';
@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn('uuid') id: string;
  @ManyToOne(() => Conversation, (c) => c.messages, { onDelete: 'CASCADE' }) conversation: Conversation;
  @Column() conversationId: string;
  @Column() role: string;
  @Column('text') content: string;
  @CreateDateColumn() createdAt: Date;
}
