import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { memoryStorage } from 'multer';
import { ProfileService } from './profile.service';
import { MAX_AVATAR_BYTES } from './profile.service';
import { StorageService } from '../storage/storage.service';
import { JwtAuthGuard } from '../../shared/jwt-auth.guard';
import { CurrentUser } from '../../shared/current-user.decorator';
import { UpdateProfileDto, ChangeEmailDto, ChangePasswordDto, UpdateThemePreferenceDto } from './dto';
import { QuotaInterceptor } from '../../shared/response-envelope.interceptor';

@UseGuards(JwtAuthGuard)
@UseInterceptors(QuotaInterceptor)
@Controller('users/me')
export class UsersController {
  constructor(private profile: ProfileService) {}

  @Get()
  getProfile(@CurrentUser() user: any) {
    return this.profile.getProfile(user.sub);
  }

  @Get('theme')
  getThemePreference(@CurrentUser() user: any) {
    return this.profile.getThemePreference(user.sub);
  }

  @Patch('theme')
  updateThemePreference(@CurrentUser() user: any, @Body() d: UpdateThemePreferenceDto) {
    return this.profile.updateThemePreference(user.sub, d.preference ?? null);
  }

  @Patch()
  updateProfile(@CurrentUser() user: any, @Body() d: UpdateProfileDto) {
    return this.profile.updateProfile(user.sub, d);
  }

  @Post('email')
  changeEmail(@CurrentUser() user: any, @Body() d: ChangeEmailDto) {
    return this.profile.changeEmail(user.sub, d);
  }

  @Post('password')
  changePassword(@CurrentUser() user: any, @Body() d: ChangePasswordDto) {
    return this.profile.changePassword(user.sub, d);
  }

  @Post('avatar')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_AVATAR_BYTES },
    }),
  )
  uploadAvatar(@CurrentUser() user: any, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('فایل تصویر (فیلد `file`) ارسال نشده است');
    return this.profile.setAvatar(user.sub, file);
  }

  @Delete('avatar')
  deleteAvatar(@CurrentUser() user: any) {
    return this.profile.removeAvatar(user.sub);
  }
}

/**
 * Serves uploaded avatars from MinIO. Public (opaque random-key URLs, same
 * convention as any object-storage CDN link); no personal data is exposed.
 */
@Controller('static/avatars')
export class AvatarsStaticController {
  constructor(private storage: StorageService) {}
  @Get(':userId/:file')
  async serve(@Param('userId') userId: string, @Param('file') file: string, @Res() res: Response) {
    // path-traversal guard: only clean single path segments are accepted
    if (!/^[a-zA-Z0-9_-]+$/.test(userId) || !/^[a-zA-Z0-9._-]+$/.test(file))
      throw new BadRequestException('Invalid path');
    const buf = await this.storage.getBuffer(`avatars/${userId}/${file}`).catch(() => {
      throw new NotFoundException('Resource not found');
    });
    const ext = file.split('.').pop()?.toLowerCase();
    res.setHeader(
      'Content-Type',
      ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg',
    );
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.end(buf);
  }
}
