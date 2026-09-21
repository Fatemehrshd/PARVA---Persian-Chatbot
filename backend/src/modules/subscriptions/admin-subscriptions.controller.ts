import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionStatus } from './subscription.entity';
import { JwtAuthGuard } from '../../shared/jwt-auth.guard';
import { AdminGuard } from '../../shared/admin.guard';
import { CurrentUser } from '../../shared/current-user.decorator';
import { IsString, IsNotEmpty, IsOptional, IsNumber } from 'class-validator';

class AssignPlanAdminDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  planId: string;

  @IsNumber()
  @IsOptional()
  durationDays?: number;
}

class CancelSubscriptionAdminDto {
  @IsString()
  @IsOptional()
  reason?: string;
}

@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin/subscriptions')
export class AdminSubscriptionsController {
  constructor(private subscriptionsService: SubscriptionsService) {}

  @Get()
  async getAllSubscriptions(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('userId') userId?: string,
    @Query('status') status?: SubscriptionStatus,
  ) {
    return this.subscriptionsService.findAllForAdmin({
      page,
      limit,
      userId,
      status,
    });
  }

  @Post('assign')
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async assignPlan(
    @Body() dto: AssignPlanAdminDto,
    @CurrentUser() admin: any,
  ) {
    return this.subscriptionsService.assignPlanToUser({
      userId: dto.userId,
      planId: dto.planId,
      source: 'admin_manual',
      durationDays: dto.durationDays,
      actorId: admin.id,
      actorType: 'admin',
    });
  }

  @Post(':id/cancel')
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async cancelSubscription(
    @Param('id') id: string,
    @Body() dto: CancelSubscriptionAdminDto,
    @CurrentUser() admin: any,
  ) {
    return this.subscriptionsService.cancelSubscription(id, dto.reason, admin.id);
  }
}
