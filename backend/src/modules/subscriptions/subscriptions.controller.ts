import { Controller, Get, UseGuards } from '@nestjs/common';
import { PlansService } from './plans.service';
import { SubscriptionsService } from './subscriptions.service';
import { EntitlementService } from './entitlement.service';
import { JwtAuthGuard } from '../../shared/jwt-auth.guard';
import { CurrentUser } from '../../shared/current-user.decorator';

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(
    private plansService: PlansService,
    private subscriptionsService: SubscriptionsService,
    private entitlementService: EntitlementService,
  ) {}

  @Get('plans')
  async getPublicPlans() {
    return this.plansService.findAll(false);
  }

  @UseGuards(JwtAuthGuard)
  @Get('current')
  async getCurrentSubscription(@CurrentUser() user: any) {
    const userId = user?.id || user?.sub;
    const activeSub = await this.subscriptionsService.getActiveSubscription(userId);
    const entitlements = await this.entitlementService.getUserEntitlements(userId);
    const history = await this.subscriptionsService.getUserHistory(userId);

    return {
      activeSubscription: activeSub,
      entitlements,
      history,
    };
  }
}
