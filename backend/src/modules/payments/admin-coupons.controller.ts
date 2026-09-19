import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { CouponsService, CreateCouponDto, UpdateCouponDto } from './coupons.service';
import { JwtAuthGuard } from '../../shared/jwt-auth.guard';
import { AdminGuard } from '../../shared/admin.guard';

@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin/coupons')
export class AdminCouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  @Get()
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('isActive') isActive?: string,
  ) {
    return this.couponsService.findAll({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 10,
      search,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
    });
  }

  @Post()
  async create(@Body() dto: CreateCouponDto) {
    return this.couponsService.create(dto);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.couponsService.findById(id);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateCouponDto) {
    return this.couponsService.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.couponsService.delete(id);
  }
}
