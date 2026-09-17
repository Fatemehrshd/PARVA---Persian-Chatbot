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
import { ApiFeatures } from '../../shared/api-features';

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
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'ASC' | 'DESC',
  ) {
    const conversations = await this.convRepo
      .find({
        where: { isDeleted: false },
        relations: ['user', 'messages'],
        order: { updatedAt: 'DESC' },
      })
      .catch(async () => this.convRepo.find({ where: { isDeleted: false } }));

    const results = (conversations || []).map((c) => ({
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
      userDisplayName: c.user?.displayName || null,
      userEmail: c.user?.email || null,
      messageCount: Array.isArray(c.messages) ? c.messages.filter((m) => !m.isDeleted).length : 0,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      modelId: c.modelId,
    }));

    const applied = ApiFeatures.applyToArray(
      results,
      { search, userId, page, limit, sortBy, sortOrder },
      {
        searchableFields: ['title', 'userDisplayName', 'userEmail', 'modelId'],
        allowedFilterFields: ['userId', 'modelId'],
        defaultSortField: 'updatedAt',
        defaultSortOrder: 'DESC',
      },
    );

    return applied.items;
  }

  @Get(':id')
  async getConversation(@Param('id') id: string) {
    const conversation = await this.convRepo
      .findOne({
        where: { id, isDeleted: false },
        relations: ['user', 'messages', 'messages.attachments'],
      })
      .catch(async () =>
        this.convRepo.findOne({
          where: { id, isDeleted: false },
          relations: ['user', 'messages'],
        }),
      )
      .catch(async () => this.convRepo.findOne({ where: { id, isDeleted: false } }));

    if (!conversation) {
      throw new NotFoundException('گفتگو یافت نشد');
    }

    let messages = conversation.messages;
    if (!messages && this.msgRepo) {
      messages = await this.msgRepo.find({
        where: { conversationId: id, isDeleted: false },
        relations: ['attachments'],
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
