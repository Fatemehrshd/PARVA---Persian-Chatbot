export interface RequestPaymentResult {
  authority: string;
  paymentUrl: string;
  gateway: string;
}

export interface VerifyPaymentResult {
  success: boolean;
  refId: string | null;
  message?: string;
  rawResponse?: any;
}

export interface PaymentGatewayProvider {
  readonly name: string;

  requestPayment(params: {
    paymentId: string;
    amount: number;
    currency: string;
    callbackUrl: string;
    description?: string;
  }): Promise<RequestPaymentResult>;

  verifyPayment(params: {
    authority: string;
    amount: number;
    payload?: any;
  }): Promise<VerifyPaymentResult>;
}
