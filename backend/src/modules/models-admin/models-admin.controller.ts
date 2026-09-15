import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Body,
  Param,
  HttpCode,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ModelsAdminService } from './models-admin.service';
import { JwtAuthGuard } from '../../shared/jwt-auth.guard';
import { AdminGuard } from '../../shared/admin.guard';
import { CreateModelDto, UpdateModelStatusDto, UpdateModelDto } from './dto';

@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin/models')
export class ModelsAdminController {
  constructor(private svc: ModelsAdminService) {}

  @Get()
  list() {
    return this.svc.list();
  }

  @Post()
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  create(@Body() d: CreateModelDto) {
    return this.svc.create(d);
  }

  @Patch(':modelId')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  update(@Param('modelId') id: string, @Body() d: UpdateModelDto) {
    return this.svc.update(id, d);
  }

  @Patch(':modelId/status')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  updateStatus(@Param('modelId') id: string, @Body() d: UpdateModelStatusDto) {
    return this.svc.updateStatus(id, d.isActive);
  }

  @Delete(':modelId')
  @HttpCode(204)
  remove(@Param('modelId') id: string) {
    return this.svc.remove(id);
  }

  @Patch(':modelId/default')
  setDefault(@Param('modelId') id: string) {
    return this.svc.setDefault(id);
  }
}
