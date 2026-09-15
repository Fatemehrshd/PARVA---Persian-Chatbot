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

@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin/settings')
export class AdminSettingsController {
  constructor(private settings: SettingsService) {}

  @Get()
  getSettings() {
    return this.settings.getAll();
  }

  @Put()
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  updateSettings(@Body() dto: UpdateSettingsDto) {
    return this.settings.update(dto);
  }
}
