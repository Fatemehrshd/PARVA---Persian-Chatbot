import { request } from './api'
import type {
  AdminDashboardStats,
  FeedbackItem,
  WebSearchUsage,
  AdminUser,
  UpdateAdminUserRequest,
  AdminConversationSummary,
  AdminConversationDetail,
  AdminFileListResponse,
  AdminFileStats,
  AdminFileDetail,
  ModelAccessLevel,
  ModelAccessMap,
} from '../types'

export const adminService = {
  async getDashboardStats(): Promise<AdminDashboardStats> {
    return request<AdminDashboardStats>('/admin/dashboard/stats')
  },

  async getFeedbackList(): Promise<FeedbackItem[]> {
    return request<FeedbackItem[]>('/admin/dashboard/feedback')
  },

  async listUsers(params?: {
    search?: string
    role?: string
    isActive?: boolean
    page?: number
    limit?: number
    sortBy?: string
    sortOrder?: 'ASC' | 'DESC' | 'asc' | 'desc'
    [key: string]: any
  }): Promise<AdminUser[] | { items: AdminUser[]; total: number; page: number; limit: number; totalPages: number }> {
    const searchParams = new URLSearchParams()
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && v !== '') {
          searchParams.set(k, String(v))
        }
      }
    }
    const qs = searchParams.toString()
    return request<any>(`/admin/users${qs ? `?${qs}` : ''}`)
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

  async getSettings(): Promise<{
    globalTokenLimit: number
    tokenRatePer1000?: number
    systemPrompt: string
    fileMaxSizeMb?: number
    fileMaxTotalSizeMb?: number
    fileMaxCount?: number
    excelMaxRows?: number
    fileProcessingTimeoutSec?: number
    webSearchUsage?: WebSearchUsage | null
    roleTokenLimits?: Record<string, number>
    taskMultipliers?: Record<string, number>
    roleQuotas?: Record<string, { tokenLimit: number | null; messageLimit: number | null; resetHours: number | null }>
    /** نقش → سطوح دسترسی مدل مجاز (public/commercial/private). */
    modelAccess?: ModelAccessMap
    roles?: string[]
  }> {
    return request('/admin/settings')
  },

  async updateSettings(data: {
    globalTokenLimit?: number
    tokenRatePer1000?: number
    systemPrompt?: string
    fileMaxSizeMb?: number
    fileMaxTotalSizeMb?: number
    fileMaxCount?: number
    excelMaxRows?: number
    fileProcessingTimeoutSec?: number
    webSearchQuotaTotal?: number
    webSearchUsedCredits?: number
    roleTokenLimits?: Record<string, number | null>
    taskMultipliers?: Record<string, number | null>
    roleQuotas?: Record<string, { tokenLimit: number | null; messageLimit: number | null; resetHours: number | null } | null>
    /** نقش → سطوح دسترسی مدل مجاز؛ null یعنی بازگشت به پیش‌فرض. */
    modelAccess?: Record<string, ModelAccessLevel[] | null>
  }): Promise<any> {
    return request('/admin/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },

  async listConversations(params?: {
    search?: string
    userId?: string
    page?: number
    limit?: number
    sortBy?: string
    sortOrder?: 'ASC' | 'DESC' | 'asc' | 'desc'
    [key: string]: any
  }): Promise<AdminConversationSummary[] | { items: AdminConversationSummary[]; total: number; page: number; limit: number; totalPages: number }> {
    const searchParams = new URLSearchParams()
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && v !== '') {
          searchParams.set(k, String(v))
        }
      }
    }
    const qs = searchParams.toString()
    return request<any>(`/admin/conversations${qs ? `?${qs}` : ''}`)
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
    fileType?: string
    search?: string
    userId?: string
    sortBy?: string
    sortOrder?: 'ASC' | 'DESC' | 'asc' | 'desc'
  }): Promise<AdminFileListResponse> {
    const searchParams = new URLSearchParams()
    if (params?.page) searchParams.set('page', String(params.page))
    if (params?.limit) searchParams.set('limit', String(params.limit))
    if (params?.status) searchParams.set('status', params.status)
    if (params?.fileType) searchParams.set('fileType', params.fileType)
    if (params?.search) searchParams.set('search', params.search)
    if (params?.userId) searchParams.set('userId', params.userId)
    if (params?.sortBy) searchParams.set('sortBy', params.sortBy)
    if (params?.sortOrder) searchParams.set('sortOrder', params.sortOrder)
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