import { Injectable, ConflictException, UnauthorizedException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { RefreshToken } from './refresh-token.entity';
import { FA } from '../../shared/messages.fa';

@Injectable()
export class AuthService {
  private static revoked = new Set<string>();

  constructor(
    private users: UsersService,
    private jwt: JwtService,
    @Optional()
    @InjectRepository(RefreshToken)
    private refreshTokenRepo?: Repository<RefreshToken>,
    @Optional()
    private dataSource?: DataSource,
  ) {}

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private async tokens(u: any, clientInfo?: { ip?: string; userAgent?: string }, manager?: EntityManager) {
    const payload = { sub: u.id, email: u.email, role: u.role };
    const accessToken = this.jwt.sign(payload, { expiresIn: '1h' });
    const refreshToken = this.jwt.sign({ ...payload, type: 'refresh' }, { expiresIn: '7d' });

    const repo = manager ? manager.getRepository(RefreshToken) : this.refreshTokenRepo;
    if (repo) {
      try {
        const tokenHash = this.hashToken(refreshToken);
        await repo.save(
          repo.create({
            userId: u.id,
            tokenHash,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            isRevoked: false,
            ip: clientInfo?.ip || null,
            userAgent: clientInfo?.userAgent || null,
          }),
        );
      } catch {
        // In-memory or fallback
      }
    }

    return {
      accessToken,
      refreshToken,
    };
  }

  toUserJson(u: any) {
    return {
      id: u.id,
      email: u.email,
      displayName: u.displayName,
      role: u.role,
      isActive: u.isActive !== false,
      createdAt: u.createdAt,
    };
  }

  async signup(email: string, password: string, displayName?: string, clientInfo?: { ip?: string; userAgent?: string }) {
    if (await this.users.findByEmail(email))
      throw new ConflictException('Email is already registered');
    const passwordHash = await bcrypt.hash(password, 10);
    const u = await this.users.create({ email, passwordHash, displayName, role: 'user' });
    const tokenResult = await this.tokens(u, clientInfo);
    return { user: this.toUserJson(u), ...tokenResult };
  }

  async login(email: string, password: string, clientInfo?: { ip?: string; userAgent?: string }) {
    const u = await this.users.findByEmail(email.trim().toLowerCase());
    if (!u || !(await bcrypt.compare(password, u.passwordHash)))
      throw new UnauthorizedException(FA.invalidCredentials);
    if (u.isActive === false)
      throw new UnauthorizedException('حساب کاربری غیرفعال است');
    const tokenResult = await this.tokens(u, clientInfo);
    return { user: this.toUserJson(u), ...tokenResult };
  }

  async refresh(rawRefreshToken: string, clientInfo?: { ip?: string; userAgent?: string }) {
    if (!rawRefreshToken || typeof rawRefreshToken !== 'string') {
      throw new UnauthorizedException(FA.refreshTokenInvalid);
    }

    let decoded: any;
    try {
      decoded = this.jwt.verify(rawRefreshToken);
    } catch {
      throw new UnauthorizedException(FA.refreshTokenInvalid);
    }

    if (!decoded || decoded.type !== 'refresh' || !decoded.sub) {
      throw new UnauthorizedException(FA.refreshTokenInvalid);
    }

    let existing: RefreshToken | null = null;
    if (this.refreshTokenRepo) {
      const tokenHash = this.hashToken(rawRefreshToken);
      existing = await this.refreshTokenRepo.findOne({
        where: { tokenHash },
      });

      if (!existing) {
        throw new UnauthorizedException(FA.refreshTokenInvalid);
      }

      if (existing.isRevoked || existing.expiresAt < new Date()) {
        // Reuse detection / revocation
        await this.refreshTokenRepo.update({ userId: decoded.sub }, { isRevoked: true });
        throw new UnauthorizedException(FA.refreshTokenInvalid);
      }
    }

    const user = await this.users.findById(decoded.sub);
    if (!user || user.isActive === false || user.isDeleted) {
      throw new UnauthorizedException('حساب کاربری غیرفعال یا حذف شده است');
    }

    // Atomic refresh token rotation in database transaction
    let newTokens: any;
    if (this.refreshTokenRepo && this.dataSource) {
      newTokens = await this.dataSource.transaction(async (manager) => {
        const repo = manager.getRepository(RefreshToken);
        // 1. Revoke the used refresh token
        if (existing) {
          existing.isRevoked = true;
          await repo.save(existing);
        }

        // 2. Issue new tokens and save new refresh token within the same transaction
        return await this.tokens(user, clientInfo, manager);
      });
    } else {
      if (this.refreshTokenRepo && existing) {
        existing.isRevoked = true;
        await this.refreshTokenRepo.save(existing);
      }
      newTokens = await this.tokens(user, clientInfo);
    }

    return {
      user: this.toUserJson(user),
      ...newTokens,
    };
  }

  async logout(token?: string, rawRefreshToken?: string) {
    if (token) {
      AuthService.revoked.add(token);
    }
    if (rawRefreshToken && this.refreshTokenRepo) {
      try {
        const tokenHash = this.hashToken(rawRefreshToken);
        await this.refreshTokenRepo.update({ tokenHash }, { isRevoked: true });
      } catch {
        // ignore
      }
    }
  }

  isRevoked(t: string) {
    return AuthService.revoked.has(t);
  }

  static isTokenRevoked(t: string): boolean {
    return AuthService.revoked.has(t);
  }
}
