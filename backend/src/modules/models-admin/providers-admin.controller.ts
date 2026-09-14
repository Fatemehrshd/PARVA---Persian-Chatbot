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
} from '@nestjs/common';
import { IsString, IsOptional, IsBoolean } from 'class-validator';
import { ProvidersAdminService } from './providers-admin.service';
import { JwtAuthGuard } from '../../shared/jwt-auth.guard';
import { AdminGuard } from '../../shared/admin.guard';

class CreateProviderDto {
  @IsString() name: string;
  @IsOptional() @IsString() baseUrl?: string;
  @IsOptional() @IsString() apiKey?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
class UpdateProviderDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() baseUrl?: string;
  @IsOptional() @IsString() apiKey?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
class UpdateProviderStatusDto {
  @IsBoolean() isActive: boolean;
}
class SetProviderDefaultDto {
  @IsString() modelId: string;
}

@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin/providers')
export class ProvidersAdminController {
  constructor(private svc: ProvidersAdminService) {}

  @Get() list() {
    return this.svc.list();
  }
  @Post() create(@Body() d: CreateProviderDto) {
    return this.svc.create(d);
  }
  @Patch(':providerId') update(@Param('providerId') id: string, @Body() d: UpdateProviderDto) {
    return this.svc.update(id, d);
  }
  @Patch(':providerId/status')
  updateStatus(@Param('providerId') id: string, @Body() d: UpdateProviderStatusDto) {
    return this.svc.updateStatus(id, d.isActive);
  }
  @Patch(':providerId/default')
  setDefault(@Param('providerId') id: string, @Body() d: SetProviderDefaultDto) {
    return this.svc.setDefaultModel(id, d.modelId);
  }
  @Delete(':providerId')
  @HttpCode(204)
  async remove(@Param('providerId') id: string) {
    await this.svc.remove(id);
  }
}
