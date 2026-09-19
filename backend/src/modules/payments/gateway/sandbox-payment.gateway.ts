import { Injectable } from '@nestjs/common';
import {
  PaymentGatewayProvider,
  RequestPaymentResult,
  VerifyPaymentResult,
} from './payment-gateway.interface';
import { randomUUID } from 'crypto';

@Injectable()
export class SandboxPaymentGateway implements PaymentGatewayProvider {
  readonly name = 'sandbox';

  async requestPayment(params: {
    paymentId: string;
    amount: number;
    currency: string;
    callbackUrl: string;
    description?: string;
  }): Promise<RequestPaymentResult> {
    const authority = `SBX_${randomUUID().replace(/-/g, '').slice(0, 20)}`;
    const paymentUrl = `/sandbox-gateway?authority=${authority}&amount=${params.amount}&callbackUrl=${encodeURIComponent(
      params.callbackUrl,
    )}`;

    return {
      authority,
      paymentUrl,
      gateway: this.name,
    };
  }

  async verifyPayment(params: {
    authority: string;
    amount: number;
    payload?: any;
  }): Promise<VerifyPaymentResult> {
    const isFailed =
      params.payload?.status === 'NOK' ||
      params.payload?.status === 'FAILED' ||
      params.payload?.cancel === true;

    if (isFailed) {
      return {
        success: false,
        refId: null,
        message: 'تراکنش توسط کاربر یا درگاه لغو شد.',
        rawResponse: params.payload,
      };
    }

    const refId = `REF_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
    return {
      success: true,
      refId,
      message: 'پرداخت در محیط آزمایشی با موفقیت انجام شد.',
      rawResponse: params.payload,
    };
  }
}
