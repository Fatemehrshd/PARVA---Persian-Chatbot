import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { PlansService } from './plans.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { JwtAuthGuard } from '../../shared/jwt-auth.guard';
import { AdminGuard } from '../../shared/admin.guard';
import { CurrentUser } from '../../shared/current-user.decorator';

@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin/plans')
export class AdminPlansController {
  constructor(private plansService: PlansService) {}

  @Get()
  async getAllPlans() {
    return this.plansService.findAll(true);
  }

  @Get(':id')
  async getPlanById(@Param('id') id: string) {
    return this.plansService.findById(id);
  }

  @Post()
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async createPlan(@Body() dto: CreatePlanDto, @CurrentUser() admin: any) {
    return this.plansService.create(dto, admin.id);
  }

  @Patch(':id')
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async updatePlan(
    @Param('id') id: string,
    @Body() dto: UpdatePlanDto,
    @CurrentUser() admin: any,
  ) {
    return this.plansService.update(id, dto, admin.id);
  }

  @Delete(':id')
  async deletePlan(@Param('id') id: string, @CurrentUser() admin: any) {
    await this.plansService.delete(id, admin.id);
    return { success: true, message: 'پلن با موفقیت حذف شد.' };
  }
}
