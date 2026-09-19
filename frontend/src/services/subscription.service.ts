import { request } from './api';
import type {
  SubscriptionPlan,
  Subscription,
  CurrentSubscriptionResponse,
} from '../types';

export const subscriptionService = {
  // Public & User
  async getPublicPlans(): Promise<SubscriptionPlan[]> {
    return request<SubscriptionPlan[]>('/subscriptions/plans');
  },

  async getCurrentSubscription(): Promise<CurrentSubscriptionResponse> {
    return request<CurrentSubscriptionResponse>('/subscriptions/current');
  },

  // Admin Plans
  async getAllPlans(): Promise<SubscriptionPlan[]> {
    return request<SubscriptionPlan[]>('/admin/plans');
  },

  async getPlan(id: string): Promise<SubscriptionPlan> {
    return request<SubscriptionPlan>(`/admin/plans/${id}`);
  },

  async createPlan(data: Partial<SubscriptionPlan> & { modelIds?: string[] }): Promise<SubscriptionPlan> {
    return request<SubscriptionPlan>('/admin/plans', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updatePlan(id: string, data: Partial<SubscriptionPlan> & { modelIds?: string[] }): Promise<SubscriptionPlan> {
    return request<SubscriptionPlan>(`/admin/plans/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async deletePlan(id: string): Promise<{ success: boolean; message: string }> {
    return request<{ success: boolean; message: string }>(`/admin/plans/${id}`, {
      method: 'DELETE',
    });
  },

  // Admin Subscriptions
  async getAllSubscriptions(params?: {
    page?: number;
    limit?: number;
    userId?: string;
    status?: string;
  }): Promise<{ items: Subscription[]; total: number; page: number; limit: number; totalPages: number }> {
    const sp = new URLSearchParams();
    if (params) {
      if (params.page) sp.set('page', String(params.page));
      if (params.limit) sp.set('limit', String(params.limit));
      if (params.userId) sp.set('userId', params.userId);
      if (params.status) sp.set('status', params.status);
    }
    const qs = sp.toString();
    return request<any>(`/admin/subscriptions${qs ? `?${qs}` : ''}`);
  },

  async assignPlan(data: {
    userId: string;
    planId: string;
    durationDays?: number;
  }): Promise<Subscription> {
    return request<Subscription>('/admin/subscriptions/assign', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async assignSubscription(data: {
    userId: string;
    planId: string;
    durationDays?: number;
  }): Promise<Subscription> {
    return this.assignPlan(data);
  },

  async cancelSubscription(id: string, reason?: string): Promise<Subscription> {
    return request<Subscription>(`/admin/subscriptions/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },
};
