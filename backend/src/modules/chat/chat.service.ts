import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Conversation } from './conversation.entity';
import { Message } from './message.entity';
import { ModelsAdminService } from '../models-admin/models-admin.service';
@Injectable()
export class ChatService {
  constructor(@InjectRepository(Conversation) private conv: Repository<Conversation>, @InjectRepository(Message) private msg: Repository<Message>, private models: ModelsAdminService) {}
  list(userId: string) { return this.conv.find({ where: { userId }, order: { updatedAt: 'DESC' } }); }
  async create(userId: string, modelId?: string, title?: string) {
    const mid = modelId ?? (await this.models.getDefault())?.id ?? 'default-model';
    const c = await this.conv.save(this.conv.create({ userId, modelId: mid, title: title ?? 'New conversation' }));
    return c;
  }
  async assertOwned(userId: string, id: string) {
    const c = await this.conv.findOne({ where: { id, userId } });
    if (!c) throw new NotFoundException('Resource not found');
    return c;
  }
  history(userId: string, id: string) { return this.assertOwned(userId, id).then(() => this.msg.find({ where: { conversationId: id }, order: { createdAt: 'ASC' } })); }
  async answer(userId: string, id: string, content: string) {
    await this.assertOwned(userId, id);
    await this.msg.save(this.msg.create({ conversationId: id, role: 'user', content }));
    const reply = `Echo: ${content}`;
    const saved = await this.msg.save(this.msg.create({ conversationId: id, role: 'assistant', content: reply }));
    await this.conv.update(id, {});
    return { reply, saved };
  }
}
