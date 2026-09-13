import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany } from 'typeorm';
import { User } from '../users/user.entity';
import { Message } from './message.entity';
@Entity('conversations')
export class Conversation {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ nullable: true }) title: string;
  @Column({ nullable: true }) modelId: string;
  @ManyToOne('User', 'conversations', { onDelete: 'CASCADE' }) user: User;
  @Column() userId: string;
  @OneToMany(() => Message, (m) => m.conversation) messages: Message[];
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
