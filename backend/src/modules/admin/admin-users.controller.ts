import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
  HttpCode,
  BadRequestException,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { SettingsService, resolveEffectiveTokenLimit } from './settings.service';
import { UpdateUserAdminDto, UpdateUserStatusDto } from './dto';
import { JwtAuthGuard } from '../../shared/jwt-auth.guard';
import { AdminGuard } from '../../shared/admin.guard';
import { CurrentUser } from '../../shared/current-user.decorator';
import { ApiFeatures } from '../../shared/api-features';

@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin/users')
export class AdminUsersController {
  constructor(
    private users: UsersService,
    private settings: SettingsService,
  ) {}

  @Get()
  async listUsers(@Query() query: Record<string, any>) {
    const [all, roleLimits, globalLimit, multipliers, rate] = await Promise.all([
      this.users.listWithStats(),
      this.settings.getRoleTokenLimits(),
      this.settings.getGlobalTokenLimit(),
      typeof this.settings.getTaskMultipliers === 'function'
        ? this.settings.getTaskMultipliers().catch(() => ({}))
        : Promise.resolve({}),
      typeof this.settings.getTokenRatePer1000 === 'function'
        ? this.settings.getTokenRatePer1000().catch(() => 10)
        : Promise.resolve(10),
    ]);
    // سقف نقش/سراسری به صورت زنده روی هر کاربر resolve می‌شود تا جدول
    // کاربران پنل ادمین همیشه سقف مؤثر (اختصاصی ← نقش ← سراسری) را ببیند.
    const withEffective = all.map((u: any) => ({
      ...u,
      effectiveTokenLimit: resolveEffectiveTokenLimit(u, roleLimits, globalLimit),
      usedCostUsd: Number(
        Object.entries(u.usageByType || {})
          .reduce((sum, [type, tokens]) => {
            const multiplier = type === 'normal' ? 1 : (multipliers as Record<string, number>)[type] ?? 1;
            return sum + (Number(tokens) * rate * multiplier) / 1000;
          }, 0)
          .toFixed(4),
      ),
    }));
    if (!query || Object.keys(query).length === 0) {
      return withEffective;
    }
    const result = ApiFeatures.applyToArray(withEffective, query, {
      searchableFields: ['displayName', 'email', 'username'],
      allowedFilterFields: ['role', 'isActive'],
      defaultSortField: 'createdAt',
      defaultSortOrder: 'ASC',
    });
    if (query.page || query.limit) {
      return result;
    }
    return result.items;
  }

  @Patch(':userId')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  updateUser(@Param('userId') id: string, @Body() dto: UpdateUserAdminDto) {
    return this.users.updateByAdmin(id, dto);
  }

  @Patch(':userId/status')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  updateUserStatus(@Param('userId') id: string, @Body() dto: UpdateUserStatusDto) {
    return this.users.updateStatusByAdmin(id, dto.isActive);
  }

  @Delete(':userId')
  @HttpCode(204)
  async deleteUser(@CurrentUser() currentAdmin: any, @Param('userId') id: string) {
    if (currentAdmin && currentAdmin.sub === id) {
      throw new BadRequestException('نمی‌توانید حساب کاربری خود را حذف کنید');
    }
    await this.users.deleteByAdmin(id);
  }
}
