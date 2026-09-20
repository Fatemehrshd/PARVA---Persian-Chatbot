import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentStatus } from './payment.entity';
import { JwtAuthGuard } from '../../shared/jwt-auth.guard';
import { AdminGuard } from '../../shared/admin.guard';

@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin/payments')
export class AdminPaymentsController {
  constructor(private paymentsService: PaymentsService) {}

  @Get()
  async getAllPayments(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('userId') userId?: string,
    @Query('status') status?: PaymentStatus,
    @Query('search') search?: string,
    @Query('searchField') searchField?: string,
  ) {
    return this.paymentsService.findAllForAdmin({
      page,
      limit,
      userId,
      status,
      search,
      searchField,
    });
  }
}
