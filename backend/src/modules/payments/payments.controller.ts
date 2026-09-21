import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { CheckoutDto } from './dto/checkout.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { ValidateCouponDto } from './dto/validate-coupon.dto';
import { JwtAuthGuard } from '../../shared/jwt-auth.guard';
import { CurrentUser } from '../../shared/current-user.decorator';

@Controller('payments')
export class PaymentsController {
  constructor(private paymentsService: PaymentsService) {}

  @UseGuards(JwtAuthGuard)
  @Post('coupons/validate')
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async validateCoupon(
    @Body() dto: ValidateCouponDto,
    @CurrentUser() user: any,
  ) {
    const userId = user?.id || user?.sub;
    return this.paymentsService.validateCouponForUser(dto.code, dto.planId, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('checkout')
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async checkout(
    @Body() dto: CheckoutDto,
    @CurrentUser() user: any,
    @Req() req: any,
  ) {
    const userId = user?.id || user?.sub || req.user?.id || req.user?.sub;
    const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress;
    const userAgent = req.headers['user-agent'];

    return this.paymentsService.initiateCheckout(userId, dto, {
      ip: String(ip || ''),
      userAgent: String(userAgent || ''),
      user: req.user || user,
    });
  }

  @Post('verify')
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async verify(@Body() dto: VerifyPaymentDto, @Req() req: any) {
    let actorId = req.user?.id || req.user?.sub;
    let actorEmail = req.user?.email;
    let actorName = req.user?.displayName || req.user?.name;

    if (!actorId) {
      const authHeader = req.headers['authorization'] as string;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
          const parts = authHeader.slice(7).trim().split('.');
          if (parts.length === 3) {
            const decoded = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
            actorId = decoded.id || decoded.sub;
            actorEmail = decoded.email;
            actorName = decoded.displayName || decoded.name;
          }
        } catch {}
      }
    }

    return this.paymentsService.verifyPayment(dto, actorId, {
      email: actorEmail,
      name: actorName,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get('my')
  async getMyPayments(@CurrentUser() user: any) {
    const userId = user?.id || user?.sub;
    return this.paymentsService.findUserPayments(userId);
  }

  @Get('by-authority/:authority')
  async getByAuthority(@Param('authority') authority: string) {
    return this.paymentsService.getPaymentByAuthority(authority);
  }
}
