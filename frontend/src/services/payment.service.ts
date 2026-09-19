import { request } from './api';
import type {
  Payment,
  CheckoutResponse,
  VerifyPaymentResponse,
  Coupon,
  CreateCouponRequest,
  UpdateCouponRequest,
  ValidateCouponResponse,
} from '../types';

export const paymentService = {
  async checkout(data: {
    planId: string;
    gateway?: string;
    callbackUrl?: string;
    idempotencyKey?: string;
    couponCode?: string;
  }): Promise<CheckoutResponse> {
    return request<CheckoutResponse>('/payments/checkout', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async validateCoupon(data: {
    code: string;
    planId: string;
  }): Promise<ValidateCouponResponse> {
    return request<ValidateCouponResponse>('/payments/coupons/validate', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async verify(data: {
    authority: string;
    status?: string;
    payload?: any;
  }): Promise<VerifyPaymentResponse> {
    return request<VerifyPaymentResponse>('/payments/verify', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getByAuthority(authority: string): Promise<Payment> {
    return request<Payment>(`/payments/by-authority/${authority}`);
  },

  async getMyPayments(): Promise<Payment[]> {
    return request<Payment[]>('/payments/my');
  },

  async getAllPayments(params?: {
    page?: number;
    limit?: number;
    userId?: string;
    status?: string;
  }): Promise<{
    items: Payment[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    stats?: {
      totalRevenue: number;
      successfulCount: number;
      subscriptionsByPlan: { planId: string; planName: string; count: number }[];
    };
  }> {
    const sp = new URLSearchParams();
    if (params) {
      if (params.page) sp.set('page', String(params.page));
      if (params.limit) sp.set('limit', String(params.limit));
      if (params.userId) sp.set('userId', params.userId);
      if (params.status) sp.set('status', params.status);
    }
    const qs = sp.toString();
    return request<any>(`/admin/payments${qs ? `?${qs}` : ''}`);
  },

  // Admin Coupon Management
  async adminGetCoupons(params?: {
    page?: number;
    limit?: number;
    search?: string;
    isActive?: boolean;
  }): Promise<{
    items: Coupon[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const sp = new URLSearchParams();
    if (params) {
      if (params.page) sp.set('page', String(params.page));
      if (params.limit) sp.set('limit', String(params.limit));
      if (params.search) sp.set('search', params.search);
      if (params.isActive !== undefined) sp.set('isActive', String(params.isActive));
    }
    const qs = sp.toString();
    return request<any>(`/admin/coupons${qs ? `?${qs}` : ''}`);
  },

  async adminCreateCoupon(data: CreateCouponRequest): Promise<Coupon> {
    return request<Coupon>('/admin/coupons', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async adminUpdateCoupon(id: string, data: UpdateCouponRequest): Promise<Coupon> {
    return request<Coupon>(`/admin/coupons/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async adminDeleteCoupon(id: string): Promise<{ success: boolean; message: string }> {
    return request<{ success: boolean; message: string }>(`/admin/coupons/${id}`, {
      method: 'DELETE',
    });
  },
};
