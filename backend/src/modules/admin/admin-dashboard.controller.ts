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
    ]);

    const totalTokensUsed = Number(tokensSumRow?.sum || 0);

    return {
      totalUsers,
      totalModels,
      activeModels,
      totalProviders,
      activeProviders,
      totalConversations,
      totalMessages,
      totalTokensUsed,
      globalTokenLimit: settingsData.globalTokenLimit,
      systemPrompt: settingsData.systemPrompt,
    };
  }
}
