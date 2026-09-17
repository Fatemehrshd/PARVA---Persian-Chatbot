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
import { UpdateUserAdminDto, UpdateUserStatusDto } from './dto';
import { JwtAuthGuard } from '../../shared/jwt-auth.guard';
import { AdminGuard } from '../../shared/admin.guard';
import { CurrentUser } from '../../shared/current-user.decorator';
import { ApiFeatures } from '../../shared/api-features';

@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin/users')
export class AdminUsersController {
  constructor(private users: UsersService) {}

  @Get()
  async listUsers(@Query() query: Record<string, any>) {
    const all = await this.users.listWithStats();
    if (!query || Object.keys(query).length === 0) {
      return all;
    }
    const result = ApiFeatures.applyToArray(all, query, {
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
