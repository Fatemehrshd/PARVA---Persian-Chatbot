import {
  Controller,
  Get,
  Put,
  Body,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { SettingsService } from './settings.service';
import { UpdateSettingsDto } from './dto';
import { JwtAuthGuard } from '../../shared/jwt-auth.guard';
import { AdminGuard } from '../../shared/admin.guard';
import { UsersService } from '../users/users.service';

@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin/settings')
export class AdminSettingsController {
  constructor(
    private settings: SettingsService,
    private users: UsersService,
  ) {}

  @Get()
  async getSettings() {
    const all = await this.settings.getAll();
    // نقش‌ها داینامیک: هر نقشی که در جدول کاربران وجود داشته باشد نمایش داده می‌شود.
    const roles =
      typeof this.users?.listDistinctRoles === 'function'
        ? await this.users.listDistinctRoles()
        : ['user', 'admin'];
    return { ...all, roles };
  }

  @Put()
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  updateSettings(@Body() dto: UpdateSettingsDto) {
    return this.settings.update(dto);
  }
}
