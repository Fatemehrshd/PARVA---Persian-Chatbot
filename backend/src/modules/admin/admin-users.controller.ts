import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  UsePipes,
  ValidationPipe,
  HttpCode,
  BadRequestException,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { UpdateUserAdminDto } from './dto';
import { JwtAuthGuard } from '../../shared/jwt-auth.guard';
import { AdminGuard } from '../../shared/admin.guard';
import { CurrentUser } from '../../shared/current-user.decorator';

@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin/users')
export class AdminUsersController {
  constructor(private users: UsersService) {}

  @Get()
  listUsers() {
    return this.users.listWithStats();
  }

  @Patch(':userId')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  updateUser(@Param('userId') id: string, @Body() dto: UpdateUserAdminDto) {
    return this.users.updateByAdmin(id, dto);
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
