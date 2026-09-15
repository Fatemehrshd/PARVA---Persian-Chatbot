import { Injectable, ConflictException, UnauthorizedException } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { FA } from '../../shared/messages.fa';

@Injectable()
export class AuthService {
  private revoked = new Set<string>();
  constructor(
    private users: UsersService,
    private jwt: JwtService,
  ) {}
  private tokens(u: any) {
    const payload = { sub: u.id, email: u.email, role: u.role };
    return {
      accessToken: this.jwt.sign(payload, { expiresIn: '1h' }),
      refreshToken: this.jwt.sign({ ...payload, type: 'refresh' }, { expiresIn: '7d' }),
    };
  }
  toUserJson(u: any) {
    return {
      id: u.id,
      email: u.email,
      displayName: u.displayName,
      role: u.role,
      createdAt: u.createdAt,
    };
  }
  async signup(email: string, password: string, displayName?: string) {
    if (await this.users.findByEmail(email))
      throw new ConflictException('Email is already registered');
    const passwordHash = await bcrypt.hash(password, 10);
    const u = await this.users.create({ email, passwordHash, displayName, role: 'user' });
    return { user: this.toUserJson(u), ...this.tokens(u) };
  }
  async login(email: string, password: string) {
    const u = await this.users.findByEmail(email.trim().toLowerCase());
    if (!u || !(await bcrypt.compare(password, u.passwordHash)))
      throw new UnauthorizedException(FA.invalidCredentials);
    return { user: this.toUserJson(u), ...this.tokens(u) };
  }
  async logout() {
    /* no-op placeholder for future refresh-token rotation */
  }
  isRevoked(t: string) {
    return this.revoked.has(t);
  }
}
