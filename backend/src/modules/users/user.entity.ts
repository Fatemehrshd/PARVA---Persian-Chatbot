import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany } from 'typeorm';
import { Conversation } from '../chat/conversation.entity';
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ unique: true }) email: string;
  @Column() passwordHash: string;
  @Column({ nullable: true }) displayName: string;
  @Column({ default: 'user' }) role: string;
  @CreateDateColumn() createdAt: Date;
  @OneToMany(() => Conversation, (c) => c.user) conversations: Conversation[];
}
