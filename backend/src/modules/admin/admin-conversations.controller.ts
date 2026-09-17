import {
  Controller,
  Get,
  Delete,
  Param,
  Query,
  UseGuards,
  HttpCode,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Conversation } from '../chat/conversation.entity';
import { Message } from '../chat/message.entity';
import { JwtAuthGuard } from '../../shared/jwt-auth.guard';
import { AdminGuard } from '../../shared/admin.guard';

@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin/conversations')
export class AdminConversationsController {
  constructor(
    @InjectRepository(Conversation) private convRepo: Repository<Conversation>,
    @InjectRepository(Message) private msgRepo: Repository<Message>,
  ) {}

  @Get()
  async listConversations(
    @Query('search') search?: string,
    @Query('userId') userId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const conversations = await this.convRepo
      .find({
        where: { isDeleted: false },
        relations: ['user', 'messages'],
        order: { updatedAt: 'DESC' },
      })
      .catch(async () => this.convRepo.find({ where: { isDeleted: false } }));

    let results = (conversations || []).map((c) => ({
      id: c.id,
      title: c.title || 'بدون عنوان',
      userId: c.userId,
      user: c.user
        ? {
            id: c.user.id,
            email: c.user.email,
            displayName: c.user.displayName,
          }
        : null,
      messageCount: Array.isArray(c.messages) ? c.messages.filter((m) => !m.isDeleted).length : 0,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      modelId: c.modelId,
    }));

    if (userId) {
      results = results.filter((c) => c.userId === userId);
    }

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      results = results.filter(
        (c) =>
          (c.title && c.title.toLowerCase().includes(q)) ||
          (c.user?.email && c.user.email.toLowerCase().includes(q)) ||
          (c.user?.displayName && c.user.displayName.toLowerCase().includes(q)),
      );
    }

    if (page || limit) {
      const p = page ? Math.max(1, parseInt(page, 10)) : 1;
      const l = limit ? Math.max(1, parseInt(limit, 10)) : 50;
      const skip = (p - 1) * l;
      return results.slice(skip, skip + l);
    }

    return results;
  }

  @Get(':id')
  async getConversation(@Param('id') id: string) {
    const conversation = await this.convRepo
      .findOne({
        where: { id, isDeleted: false },
        relations: ['user', 'messages'],
      })
      .catch(async () => this.convRepo.findOne({ where: { id, isDeleted: false } }));

    if (!conversation) {
      throw new NotFoundException('گفتگو یافت نشد');
    }

    let messages = conversation.messages;
    if (!messages && this.msgRepo) {
      messages = await this.msgRepo.find({
        where: { conversationId: id, isDeleted: false },
        order: { createdAt: 'ASC' },
      });
    }

    const sortedMessages = Array.isArray(messages)
      ? [...messages]
          .filter((m) => !m.isDeleted)
          .sort(
            (a, b) =>
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
          )
      : [];

    return {
      ...conversation,
      messages: sortedMessages,
      user: conversation.user
        ? {
            id: conversation.user.id,
            email: conversation.user.email,
            displayName: conversation.user.displayName,
          }
        : null,
    };
  }

  @Delete(':id')
  @HttpCode(204)
  async deleteConversation(@Param('id') id: string) {
    const conversation = await this.convRepo.findOne({ where: { id, isDeleted: false } });
    if (!conversation) {
      throw new NotFoundException('گفتگو یافت نشد');
    }
    conversation.isDeleted = true;
    await this.convRepo.save(conversation);
    await this.msgRepo.update({ conversationId: id }, { isDeleted: true });
  }
}
