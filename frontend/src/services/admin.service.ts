import { request } from './api'
import type { AdminDashboardStats, AdminUser, UpdateAdminUserRequest } from '../types'

export const adminService = {
  async getDashboardStats(): Promise<AdminDashboardStats> {
    return request<AdminDashboardStats>('/admin/dashboard/stats')
  },

  async listUsers(): Promise<AdminUser[]> {
    return request<AdminUser[]>('/admin/users')
  },

  async updateUser(userId: string, data: UpdateAdminUserRequest): Promise<AdminUser> {
    return request<AdminUser>(`/admin/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    })
  },

  async updateUserStatus(userId: string, isActive: boolean): Promise<AdminUser> {
    return request<AdminUser>(`/admin/users/${userId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive })
    })
  },

  async getSettings(): Promise<{ globalTokenLimit: number; systemPrompt: string }> {
    return request('/admin/settings')
  },

  async updateSettings(data: { globalTokenLimit?: number; systemPrompt?: string }) {
    return request('/admin/settings', {
      method: 'PUT',
      body: JSON.stringify(data)
    })
  }
}