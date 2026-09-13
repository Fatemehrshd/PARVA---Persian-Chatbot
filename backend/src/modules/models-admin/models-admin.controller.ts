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
import { IsString, IsOptional, IsBoolean } from 'class-validator';
import { ModelsAdminService } from './models-admin.service';
import { JwtAuthGuard } from '../../shared/jwt-auth.guard';
import { AdminGuard } from '../../shared/admin.guard';
class CreateModelDto {
  @IsString() name: string;
  @IsString() provider: string;
  @IsString() apiIdentifier: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin/models')
export class ModelsAdminController {
  constructor(private svc: ModelsAdminService) {}
  @Get() list() {
    return this.svc.list();
  }
  @Post() @UsePipes(new ValidationPipe({ whitelist: true })) create(@Body() d: CreateModelDto) {
    return this.svc.create(d);
  }
  @Delete(':modelId') @HttpCode(204) remove(@Param('modelId') id: string) {
    return this.svc.remove(id);
  }
  @Patch(':modelId/default') setDefault(@Param('modelId') id: string) {
    return this.svc.setDefault(id);
  }
}
