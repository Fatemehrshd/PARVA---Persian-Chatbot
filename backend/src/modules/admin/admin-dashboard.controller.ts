import { Controller, Get, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { Conversation } from '../chat/conversation.entity';
import { Message } from '../chat/message.entity';
import { AiModel } from '../models-admin/ai-model.entity';
import { AiProvider } from '../models-admin/ai-provider.entity';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../../shared/jwt-auth.guard';
import { AdminGuard } from '../../shared/admin.guard';

@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin/dashboard')
export class AdminDashboardController {
  constructor(
    @InjectRepository(User) private usersRepo: Repository<User>,
    @InjectRepository(Conversation) private convRepo: Repository<Conversation>,
    @InjectRepository(Message) private msgRepo: Repository<Message>,
    @InjectRepository(AiModel) private modelRepo: Repository<AiModel>,
    @InjectRepository(AiProvider) private providerRepo: Repository<AiProvider>,
    private settings: SettingsService,
  ) {}

  @Get('stats')
  async getStats() {
    const [
      totalUsers,
      totalModels,
      activeModels,
      totalProviders,
      activeProviders,
      totalConversations,
      totalMessages,
      tokensSumRow,
      settingsData,
      likesCount,
      dislikesCount,
    ] = await Promise.all([
      this.usersRepo.count().catch(() => 0),
      this.modelRepo.count().catch(() => 0),
      this.modelRepo.count({ where: { isActive: true } }).catch(() => 0),
      this.providerRepo.count().catch(() => 0),
      this.providerRepo.count({ where: { isActive: true } }).catch(() => 0),
      this.convRepo.count().catch(() => 0),
      this.msgRepo.count().catch(() => 0),
      typeof this.usersRepo.createQueryBuilder === 'function'
        ? this.usersRepo
            .createQueryBuilder('u')
            .select('SUM(u.usedTokens)', 'sum')
            .getRawOne()
            .catch(async () => {
              const allUsers = typeof this.usersRepo.find === 'function' ? await this.usersRepo.find().catch(() => []) : [];
              const sum = (allUsers as any[]).reduce((acc: number, u: any) => acc + (u.usedTokens || 0), 0);
              return { sum };
            })
        : (typeof this.usersRepo.find === 'function'
            ? this.usersRepo.find().then((allUsers) => ({
                sum: (allUsers as any[]).reduce((acc: number, u: any) => acc + (u.usedTokens || 0), 0),
              }))
            : Promise.resolve({ sum: 0 })),
      this.settings.getAll(),
      this.msgRepo.count({ where: { feedback: 'like' } }).catch(() => 0),
      this.msgRepo.count({ where: { feedback: 'dislike' } }).catch(() => 0),
    ]);

    const totalTokensUsed = Number(tokensSumRow?.sum || 0);
    const totalLikes = Number(likesCount || 0);
    const totalDislikes = Number(dislikesCount || 0);
    const totalFeedback = totalLikes + totalDislikes;
    const satisfactionRate = totalFeedback > 0 ? Math.round((totalLikes / totalFeedback) * 100) : 100;

    return {
      totalUsers,
      totalModels,
      activeModels,
      totalProviders,
      activeProviders,
      totalConversations,
      totalMessages,
      totalTokensUsed,
      totalLikes,
      totalDislikes,
      satisfactionRate,
      globalTokenLimit: settingsData.globalTokenLimit,
      tokenRatePer1000: settingsData.tokenRatePer1000,
      systemPrompt: settingsData.systemPrompt,
      webSearchUsage: settingsData.webSearchUsage,
    };
  }

  @Get('feedback')
  async getFeedbackList() {
    const messages = await this.msgRepo.find({
      where: [
        { feedback: 'like' },
        { feedback: 'dislike' },
      ],
      relations: ['conversation'],
      order: { createdAt: 'DESC' },
      take: 30,
    });
    return messages.map((m) => ({
      id: m.id,
      conversationId: m.conversationId,
      conversationTitle: m.conversation?.title || 'گفتگوی بدون عنوان',
      contentSnippet: (m.content || '').slice(0, 160),
      feedback: m.feedback,
      createdAt: m.createdAt,
    }));
  }
}
