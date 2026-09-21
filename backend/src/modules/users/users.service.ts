import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private repo: Repository<User>) {}

  findByEmail(email: string) {
    return this.repo.findOne({ where: { email: email.trim().toLowerCase(), isDeleted: false } });
  }

  findById(id: string) {
    return this.repo.findOne({ where: { id, isDeleted: false } }).catch(() => null);
  }

  findByUsername(username: string) {
    return this.repo.findOne({ where: { username, isDeleted: false } }).catch(() => null);
  }

  /** نقش‌های موجود در سیستم (حاضر در جدول کاربران + پیش‌فرض‌ها) برای پنل ادمین. */
  async listDistinctRoles(): Promise<string[]> {
    const defaults = ['user', 'admin'];
    try {
      const rows = await this.repo
        .createQueryBuilder('u')
        .select('DISTINCT u.role', 'role')
        .getRawMany();
      const found = rows.map((r) => r?.role).filter((r): r is string => typeof r === 'string' && r.length > 0);
      return Array.from(new Set([...defaults, ...found]));
    } catch {
      return defaults;
    }
  }

  create(data: Partial<User>) {
    return this.repo.save(this.repo.create(data));
  }

  save(user: User) {
    return this.repo.save(user);
  }

  async incrementUsedTokens(userId: string, tokens: number): Promise<void> {
    if (tokens <= 0) return;
    try {
      await this.repo
        .createQueryBuilder()
        .update(User)
        .set({ usedTokens: () => `"usedTokens" + ${Math.floor(tokens)}` })
        .where('id = :id', { id: userId })
        .execute();
    } catch {
      const u = await this.findById(userId);
      if (u) {
        u.usedTokens = (u.usedTokens || 0) + Math.floor(tokens);
        await this.repo.save(u);
      }
    }
  }

  async syncPeriod(user: User, resetHours: number): Promise<User> {
    if (!user || resetHours <= 0) return user;
    const now = new Date();
    if (!user.periodStart) {
      user.periodStart = now;
      await this.repo.save(user);
      return user;
    }
    const elapsed = now.getTime() - new Date(user.periodStart).getTime();
    if (elapsed >= resetHours * 3600_000) {
      user.periodStart = now;
      user.periodUsedTokens = 0;
      user.periodUsedMessages = 0;
      await this.repo.save(user);
    }
    return user;
  }

  async incrementUsage(
    userId: string,
    tokens: number,
    taskType = 'normal',
    messages = 1,
  ): Promise<void> {
    const user = await this.findById(userId);
    if (!user) return;
    const tokenCount = Math.max(0, Math.floor(tokens));
    const messageCount = Math.max(0, Math.floor(messages));
    user.usedTokens = (user.usedTokens || 0) + tokenCount;
    user.periodUsedTokens = (user.periodUsedTokens || 0) + tokenCount;
    user.periodUsedMessages = (user.periodUsedMessages || 0) + messageCount;
    const usageByType = { ...(user.usageByType || {}) };
    usageByType[taskType] = (usageByType[taskType] || 0) + tokenCount;
    user.usageByType = usageByType;
    if (!user.periodStart) user.periodStart = new Date();
    await this.repo.save(user);
  }

  async incrementPeriodMessages(userId: string, messages = 1): Promise<void> {
    const user = await this.findById(userId);
    if (!user) return;
    user.periodUsedMessages = (user.periodUsedMessages || 0) + Math.max(0, Math.floor(messages));
    if (!user.periodStart) user.periodStart = new Date();
    await this.repo.save(user);
  }

  async listWithStats() {
    try {
      const rows = await this.repo
        .createQueryBuilder('u')
        .leftJoin('u.conversations', 'c')
        .select([
          'u.id AS id',
          'u.email AS email',
          'u.displayName AS "displayName"',
          'u.username AS username',
          'u.role AS role',
          'u.isActive AS "isActive"',
          'u.avatarUrl AS "avatarUrl"',
          'u.usedTokens AS "usedTokens"',
          'u.tokenLimit AS "tokenLimit"',
          'u.messageLimit AS "messageLimit"',
          'u.periodStart AS "periodStart"',
          'u.periodUsedTokens AS "periodUsedTokens"',
          'u.periodUsedMessages AS "periodUsedMessages"',
          'u.usageByType AS "usageByType"',
          'u.createdAt AS "createdAt"',
          'COUNT(c.id) AS "conversationsCount"',
        ])
        .where('u.isDeleted = :deleted', { deleted: false })
        .groupBy('u.id')
        .orderBy('u.createdAt', 'ASC')
        .getRawMany();

      return rows.map((u: any) => ({
        id: u.id,
        email: u.email,
        displayName: u.displayName ?? null,
        username: u.username ?? null,
        role: u.role,
        isActive: u.isActive !== false,
        avatarUrl: u.avatarUrl ?? null,
        usedTokens: Number(u.usedTokens || 0),
        tokenLimit: u.tokenLimit !== null && u.tokenLimit !== undefined ? Number(u.tokenLimit) : null,
        messageLimit: u.messageLimit !== null && u.messageLimit !== undefined ? Number(u.messageLimit) : null,
        periodStart: u.periodStart ?? null,
        periodUsedTokens: Number(u.periodUsedTokens || 0),
        periodUsedMessages: Number(u.periodUsedMessages || 0),
        usageByType: u.usageByType || {},
        createdAt: u.createdAt,
        conversationsCount: Number(u.conversationsCount || 0),
      }));
    } catch {
      const all = await this.repo
        .find({ where: { isDeleted: false }, relations: ['conversations'] })
        .catch(() => this.repo.find({ where: { isDeleted: false } }));
      return all.map((u) => ({
        id: u.id,
        email: u.email,
        displayName: u.displayName ?? null,
        username: u.username ?? null,
        role: u.role,
        isActive: u.isActive !== false,
        avatarUrl: u.avatarUrl ?? null,
        usedTokens: Number(u.usedTokens || 0),
        tokenLimit: u.tokenLimit !== null && u.tokenLimit !== undefined ? Number(u.tokenLimit) : null,
        messageLimit: u.messageLimit !== null && u.messageLimit !== undefined ? Number(u.messageLimit) : null,
        periodStart: u.periodStart ?? null,
        periodUsedTokens: Number(u.periodUsedTokens || 0),
        periodUsedMessages: Number(u.periodUsedMessages || 0),
        usageByType: u.usageByType || {},
        createdAt: u.createdAt,
        conversationsCount: u.conversations?.length ?? 0,
      }));
    }
  }

  async updateByAdmin(userId: string, data: Partial<User>) {
    let user;
    try {
      user = await this.repo.findOne({ where: { id: userId, isDeleted: false } });
    } catch (err: any) {
      if (err?.code === '22P02') throw new NotFoundException('Resource not found');
      throw err;
    }
    if (!user) throw new NotFoundException('Resource not found');
    if (data.role !== undefined) user.role = data.role;
    if (data.displayName !== undefined) user.displayName = data.displayName || (null as any);
    if (data.email !== undefined) user.email = data.email;
    if (data.usedTokens !== undefined) user.usedTokens = data.usedTokens;
    if (data.tokenLimit !== undefined) user.tokenLimit = data.tokenLimit;
    if (data.messageLimit !== undefined) user.messageLimit = data.messageLimit;
    return this.repo.save(user);
  }

  async deleteByAdmin(userId: string) {
    let user;
    try {
      user = await this.repo.findOne({ where: { id: userId, isDeleted: false } });
    } catch (err: any) {
      if (err?.code === '22P02') throw new NotFoundException('Resource not found');
      throw err;
    }
    if (!user) throw new NotFoundException('Resource not found');
    // Soft delete: keep the row (and its conversations/files) for audit; the
    // user disappears from listings and can no longer authenticate.
    user.isDeleted = true;
    await this.repo.save(user);
  }

  async updateStatusByAdmin(userId: string, isActive: boolean) {
    let user;
    try {
      user = await this.repo.findOne({ where: { id: userId, isDeleted: false } });
    } catch (err: any) {
      if (err?.code === '22P02') throw new NotFoundException('Resource not found');
      throw err;
    }
    if (!user) throw new NotFoundException('Resource not found');
    user.isActive = isActive;
    return this.repo.save(user);
  }
}

