import { request } from './api'
import type { AdminDashboardStats, AdminUser, UpdateAdminUserRequest, AdminConversationSummary, AdminConversationDetail } from '../types'

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

  async updateSettings(data: { globalTokenLimit?: number; systemPrompt?: string }): Promise<{ globalTokenLimit: number; systemPrompt: string }> {
    return request<{ globalTokenLimit: number; systemPrompt: string }>('/admin/settings', {
      method: 'PUT',
      body: JSON.stringify(data)
    })
  },

  async listConversations(params?: { search?: string; userId?: string }): Promise<AdminConversationSummary[]> {
    const searchParams = new URLSearchParams()
    if (params?.search) searchParams.set('search', params.search)
    if (params?.userId) searchParams.set('userId', params.userId)
    const qs = searchParams.toString()
    return request<AdminConversationSummary[]>(`/admin/conversations${qs ? `?${qs}` : ''}`)
  },

  async getConversation(id: string): Promise<AdminConversationDetail> {
    return request<AdminConversationDetail>(`/admin/conversations/${id}`)
  },

  async deleteConversation(id: string): Promise<void> {
    return request<void>(`/admin/conversations/${id}`, {
      method: 'DELETE'
    })
  }
}