import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private repo: Repository<User>) {}

  findByEmail(email: string) {
    return this.repo.findOne({ where: { email: email.trim().toLowerCase() } });
  }

  findById(id: string) {
    return this.repo.findOne({ where: { id } }).catch(() => null);
  }

  findByUsername(username: string) {
    return this.repo.findOne({ where: { username } }).catch(() => null);
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
          'u.createdAt AS "createdAt"',
          'COUNT(c.id) AS "conversationsCount"',
        ])
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
        createdAt: u.createdAt,
        conversationsCount: Number(u.conversationsCount || 0),
      }));
    } catch {
      const all = await this.repo.find({ relations: ['conversations'] }).catch(() => this.repo.find());
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
        createdAt: u.createdAt,
        conversationsCount: u.conversations?.length ?? 0,
      }));
    }
  }

  async updateByAdmin(userId: string, data: Partial<User>) {
    let user;
    try {
      user = await this.repo.findOne({ where: { id: userId } });
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
    return this.repo.save(user);
  }

  async deleteByAdmin(userId: string) {
    let user;
    try {
      user = await this.repo.findOne({ where: { id: userId } });
    } catch (err: any) {
      if (err?.code === '22P02') throw new NotFoundException('Resource not found');
      throw err;
    }
    if (!user) throw new NotFoundException('Resource not found');
    await this.repo.remove(user);
  }

  async updateStatusByAdmin(userId: string, isActive: boolean) {
    let user;
    try {
      user = await this.repo.findOne({ where: { id: userId } });
    } catch (err: any) {
      if (err?.code === '22P02') throw new NotFoundException('Resource not found');
      throw err;
    }
    if (!user) throw new NotFoundException('Resource not found');
    user.isActive = isActive;
    return this.repo.save(user);
  }
}

