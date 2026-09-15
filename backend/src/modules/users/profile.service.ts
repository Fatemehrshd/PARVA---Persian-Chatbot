import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { User } from './user.entity';
import { UsersService } from './users.service';
import { StorageService } from '../storage/storage.service';
import {
  UpdateProfileDto,
  ChangeEmailDto,
  ChangePasswordDto,
} from './dto';

const USERNAME_RE = /^[a-z0-9_]{3,30}$/;
/** Max accepted avatar upload size: 2 MB (also enforced by the multer limit). */
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const AVATAR_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

@Injectable()
export class ProfileService {
  constructor(
    private users: UsersService,
    private storage: StorageService,
  ) {}

  private async mustFind(id: string): Promise<User> {
    const u = await this.users.findById(id);
    if (!u) throw new NotFoundException('Resource not found');
    return u;
  }

  toProfileJson(u: User) {
    return {
      id: u.id,
      email: u.email,
      displayName: u.displayName ?? null,
      username: u.username ?? null,
      avatarUrl: u.avatarUrl ?? null,
      role: u.role,
      createdAt: u.createdAt,
    };
  }

  async getProfile(userId: string) {
    return this.toProfileJson(await this.mustFind(userId));
  }

  async updateProfile(userId: string, d: UpdateProfileDto) {
    const u = await this.mustFind(userId);
    if (d.displayName !== undefined) u.displayName = d.displayName || null;
    if (d.username !== undefined) {
      const uname = (d.username || '').toLowerCase();
      if (uname) {
        if (!USERNAME_RE.test(uname))
          throw new BadRequestException(
            'نام کاربری نامعتبر است (۳ تا ۳۰ کاراکتر؛ فقط حروف کوچک انگلیسی، عدد و _)',
          );
        const taken = await this.users.findByUsername(uname);
        if (taken && taken.id !== u.id)
          throw new ConflictException('این نام کاربری قبلاً ثبت شده است');
      }
      u.username = uname || null;
    }
    await this.users.save(u);
    return this.toProfileJson(u);
  }

  /** Email change requires re-authentication with the CURRENT password; applies immediately. */
  async changeEmail(userId: string, d: ChangeEmailDto) {
    const u = await this.mustFind(userId);
    if (!(await bcrypt.compare(d.password, u.passwordHash)))
      throw new UnauthorizedException('رمز عبور فعلی نادرست است');
    const taken = await this.users.findByEmail(d.email);
    if (taken && taken.id !== u.id)
      throw new ConflictException('Email is already registered');
    u.email = d.email;
    await this.users.save(u);
    return this.toProfileJson(u);
  }

  async changePassword(userId: string, d: ChangePasswordDto) {
    const u = await this.mustFind(userId);
    if (!(await bcrypt.compare(d.currentPassword, u.passwordHash)))
      throw new UnauthorizedException('رمز عبور فعلی نادرست است');
    u.passwordHash = await bcrypt.hash(d.newPassword, 10);
    await this.users.save(u);
    return { changed: true };
  }

  /**
   * Avatar upload: stored on MinIO; the previous object is deleted so the
   * bucket never accumulates orphans. Rejects non-image/unknown mimetype
   * BEFORE touching storage.
   */
  async setAvatar(
    userId: string,
    file: { buffer?: Buffer; mimetype?: string } | undefined,
  ) {
    const u = await this.mustFind(userId);
    const ext = file?.mimetype ? AVATAR_TYPES[file.mimetype] : undefined;
    if (!file?.buffer || !ext)
      throw new BadRequestException('فایل باید یک تصویر PNG، JPEG یا WebP باشد');
    if (file.buffer.length > MAX_AVATAR_BYTES)
      throw new BadRequestException('حجم تصویر نباید بیشتر از ۲ مگابایت باشد');
    const key = `avatars/${u.id}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
    const oldKey = u.avatarKey;
    await this.storage.put(key, file.buffer, file.mimetype!);
    u.avatarKey = key;
    u.avatarUrl = this.storage.publicUrl(key);
    try {
      await this.users.save(u);
    } catch (e) {
      await this.storage.remove(key).catch(() => undefined);
      throw e;
    }
    if (oldKey) await this.storage.remove(oldKey).catch(() => undefined);
    return this.toProfileJson(u);
  }

  async removeAvatar(userId: string) {
    const u = await this.mustFind(userId);
    if (u.avatarKey) {
      await this.storage.remove(u.avatarKey).catch(() => undefined);
      u.avatarKey = null;
      u.avatarUrl = null;
      await this.users.save(u);
    }
    return this.toProfileJson(u);
  }
}
