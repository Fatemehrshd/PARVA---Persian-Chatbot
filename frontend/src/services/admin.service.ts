import { request } from './api'
import type {
  AdminDashboardStats,
  WebSearchUsage,
  AdminUser,
  UpdateAdminUserRequest,
  AdminConversationSummary,
  AdminConversationDetail,
  AdminFileListResponse,
  AdminFileStats,
  AdminFileDetail,
} from '../types'

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
      body: JSON.stringify(data),
    })
  },

  async updateUserStatus(userId: string, isActive: boolean): Promise<AdminUser> {
    return request<AdminUser>(`/admin/users/${userId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive }),
    })
  },

  async getSettings(): Promise<{ globalTokenLimit: number; tokenRatePer1000?: number; systemPrompt: string; webSearchUsage?: WebSearchUsage | null }> {
    return request('/admin/settings')
  },

  async updateSettings(data: {
    globalTokenLimit?: number
    tokenRatePer1000?: number
    systemPrompt?: string
    fileMaxSizeMb?: number
    fileMaxTotalSizeMb?: number
    fileMaxCount?: number
    webSearchQuotaTotal?: number
    webSearchUsedCredits?: number
  }): Promise<{ globalTokenLimit: number; tokenRatePer1000?: number; systemPrompt: string; webSearchUsage?: WebSearchUsage | null }> {
    return request<{ globalTokenLimit: number; tokenRatePer1000?: number; systemPrompt: string; webSearchUsage?: WebSearchUsage | null }>('/admin/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },

  async listConversations(params?: {
    search?: string
    userId?: string
    page?: number
    limit?: number
  }): Promise<AdminConversationSummary[]> {
    const searchParams = new URLSearchParams()
    if (params?.search) searchParams.set('search', params.search)
    if (params?.userId) searchParams.set('userId', params.userId)
    if (params?.page) searchParams.set('page', String(params.page))
    if (params?.limit) searchParams.set('limit', String(params.limit))
    const qs = searchParams.toString()
    return request<AdminConversationSummary[]>(`/admin/conversations${qs ? `?${qs}` : ''}`)
  },

  async getConversation(id: string): Promise<AdminConversationDetail> {
    return request<AdminConversationDetail>(`/admin/conversations/${id}`)
  },

  async deleteConversation(id: string): Promise<void> {
    return request<void>(`/admin/conversations/${id}`, {
      method: 'DELETE',
    })
  },

  // Files management
  async getFileStats(): Promise<AdminFileStats> {
    return request<AdminFileStats>('/admin/files/stats')
  },

  async listFiles(params?: {
    page?: number
    limit?: number
    status?: string
    search?: string
    userId?: string
  }): Promise<AdminFileListResponse> {
    const searchParams = new URLSearchParams()
    if (params?.page) searchParams.set('page', String(params.page))
    if (params?.limit) searchParams.set('limit', String(params.limit))
    if (params?.status) searchParams.set('status', params.status)
    if (params?.search) searchParams.set('search', params.search)
    if (params?.userId) searchParams.set('userId', params.userId)
    const qs = searchParams.toString()
    return request<AdminFileListResponse>(`/admin/files${qs ? `?${qs}` : ''}`)
  },

  async getFileDetail(id: string): Promise<AdminFileDetail> {
    return request<AdminFileDetail>(`/admin/files/${id}`)
  },

  async retryFile(id: string): Promise<{ id: string; status: string; message: string }> {
    return request<{ id: string; status: string; message: string }>(`/admin/files/${id}/retry`, {
      method: 'POST',
    })
  },

  async deleteFile(id: string): Promise<void> {
    return request<void>(`/admin/files/${id}`, {
      method: 'DELETE',
    })
  },
}