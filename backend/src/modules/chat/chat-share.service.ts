import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { ChatShare } from './chat-share.entity';
import { Conversation } from './conversation.entity';
import { Message } from './message.entity';
import { AiModel } from '../models-admin/ai-model.entity';

@Injectable()
export class ChatShareService {
  constructor(
    @InjectRepository(ChatShare)
    private shareRepo: Repository<ChatShare>,
    @InjectRepository(Conversation)
    private convRepo: Repository<Conversation>,
    @InjectRepository(Message)
    private msgRepo: Repository<Message>,
    @InjectRepository(AiModel)
    private modelRepo: Repository<AiModel>,
  ) {}

  /**
   * Generates a 12-character cryptographically secure URL-safe share code
   */
  private generateShareCode(): string {
    return crypto.randomBytes(9).toString('base64url');
  }

  /**
   * Captures and freezes the conversation snapshot up to this exact moment.
   * Subsequent messages sent to the conversation will NOT be added to this snapshot.
   */
  async createOrUpdateShare(userId: string, conversationId: string) {
    const conv = await this.convRepo.findOne({
      where: { id: conversationId, isDeleted: false },
    });

    if (!conv) {
      throw new NotFoundException('گفتگوی مورد نظر یافت نشد.');
    }

    if (conv.userId !== userId) {
      throw new ForbiddenException('شما دسترسی اشتراک‌گذاری این گفتگو را ندارید.');
    }

    // Fetch all active messages in conversation ordered chronologically
    const messages = await this.msgRepo.find({
      where: { conversationId, isDeleted: false },
      order: { createdAt: 'ASC' },
      relations: ['attachments'],
    });

    if (!messages || messages.length === 0) {
      throw new BadRequestException('امکان اشتراک‌گذاری گفتگوی خالی وجود ندارد.');
    }

    // Resolve model name if available
    let modelName = 'مدل هوش مصنوعی';
    if (conv.modelId) {
      const model = await this.modelRepo.findOne({ where: { id: conv.modelId } });
      if (model) {
        modelName = model.name;
      }
    }

    // Build immutable snapshot of messages
    const snapshotMessages = messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: m.createdAt ? m.createdAt.toISOString() : new Date().toISOString(),
      sources: m.sources || null,
      reasoning_content: m.reasoning_content || null,
      thinkingDurationMs: m.thinkingDurationMs || null,
      attachments: m.attachments
        ? m.attachments.map((a) => ({
            id: a.id,
            originalName: a.originalName,
            mimeType: a.mimeType,
            fileType: a.fileType,
            fileSize: a.fileSize,
          }))
        : [],
    }));

    // Check if an existing share record exists for this conversation and user
    let share = await this.shareRepo.findOne({
      where: { conversationId, userId },
    });

    if (share) {
      share.title = conv.title || 'گفتگوی بدون عنوان';
      share.modelId = conv.modelId;
      share.modelName = modelName;
      share.snapshotMessages = snapshotMessages;
      share.isActive = true;
      share = await this.shareRepo.save(share);
    } else {
      let shareCode = this.generateShareCode();
      // Ensure unique code
      while (await this.shareRepo.findOne({ where: { shareCode } })) {
        shareCode = this.generateShareCode();
      }

      share = this.shareRepo.create({
        shareCode,
        conversationId,
        userId,
        title: conv.title || 'گفتگوی بدون عنوان',
        modelId: conv.modelId,
        modelName,
        snapshotMessages,
        isActive: true,
      });
      share = await this.shareRepo.save(share);
    }

    return {
      id: share.id,
      shareCode: share.shareCode,
      title: share.title,
      modelId: share.modelId,
      modelName: share.modelName,
      messageCount: share.snapshotMessages.length,
      createdAt: share.createdAt,
      updatedAt: share.updatedAt,
      isActive: share.isActive,
    };
  }

  /**
   * Public retrieval of a frozen conversation snapshot by shareCode (no auth required)
   */
  async getPublicShare(shareCode: string) {
    const share = await this.shareRepo.findOne({
      where: { shareCode, isActive: true },
    });

    if (!share) {
      throw new NotFoundException('گفتگوی به‌اشتراک‌گذاشته‌شده یافت نشد یا غیرفعال شده است.');
    }

    // Increment view count asynchronously
    this.shareRepo.increment({ id: share.id }, 'viewCount', 1).catch(() => {});

    return {
      shareCode: share.shareCode,
      title: share.title,
      modelId: share.modelId,
      modelName: share.modelName,
      messages: share.snapshotMessages,
      createdAt: share.createdAt,
      updatedAt: share.updatedAt,
    };
  }

  /**
   * Get active share status for the conversation owner
   */
  async getUserShare(userId: string, conversationId: string) {
    const share = await this.shareRepo.findOne({
      where: { conversationId, userId, isActive: true },
    });

    if (!share) {
      return null;
    }

    return {
      id: share.id,
      shareCode: share.shareCode,
      title: share.title,
      modelId: share.modelId,
      modelName: share.modelName,
      messageCount: share.snapshotMessages.length,
      createdAt: share.createdAt,
      updatedAt: share.updatedAt,
      isActive: share.isActive,
      viewCount: share.viewCount,
    };
  }

  /**
   * Revoke public share link for a conversation
   */
  async revokeShare(userId: string, conversationId: string) {
    const share = await this.shareRepo.findOne({
      where: { conversationId, userId },
    });

    if (!share) {
      throw new NotFoundException('پیوند اشتراک فعالی برای این گفتگو یافت نشد.');
    }

    share.isActive = false;
    await this.shareRepo.save(share);

    return {
      success: true,
      message: 'پیوند اشتراک با موفقیت باطل شد.',
    };
  }

  /**
   * Fork/clone a public shared chat into the authenticated user's account to continue the conversation
   */
  async forkShare(userId: string, shareCode: string) {
    const share = await this.shareRepo.findOne({
      where: { shareCode, isActive: true },
    });

    if (!share) {
      throw new NotFoundException('گفتگوی به‌اشتراک‌گذاشته‌شده یافت نشد.');
    }

    const newConv = this.convRepo.create({
      userId,
      title: `${share.title} (نسخه کپی)`,
      modelId: share.modelId,
    });
    const savedConv = await this.convRepo.save(newConv);

    if (share.snapshotMessages && share.snapshotMessages.length > 0) {
      const messagesToCreate = share.snapshotMessages.map((m) =>
        this.msgRepo.create({
          conversationId: savedConv.id,
          role: m.role,
          content: m.content,
          sources: m.sources,
          reasoning_content: m.reasoning_content,
          thinkingDurationMs: m.thinkingDurationMs,
        }),
      );
      await this.msgRepo.save(messagesToCreate);
    }

    return {
      conversationId: savedConv.id,
      title: savedConv.title,
    };
  }
}
