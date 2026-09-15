import { getApiBaseUrl, request } from './api'
import type {
  ChangeEmailRequest,
  ChangePasswordRequest,
  UpdateProfileRequest,
  UserProfile,
} from '../types'

export const profileService = {
  async getProfile(): Promise<UserProfile> {
    return resolveAvatarUrl(await request<UserProfile>('/users/me'))
  },

  async updateProfile(payload: UpdateProfileRequest): Promise<UserProfile> {
    return resolveAvatarUrl(await request<UserProfile>('/users/me', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }))
  },

  async changeEmail(payload: ChangeEmailRequest): Promise<UserProfile> {
    return resolveAvatarUrl(await request<UserProfile>('/users/me/email', {
      method: 'POST',
      body: JSON.stringify(payload),
    }))
  },

  async changePassword(payload: ChangePasswordRequest): Promise<{ changed: boolean }> {
    return request<{ changed: boolean }>('/users/me/password', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  async uploadAvatar(file: File): Promise<UserProfile> {
    const body = new FormData()
    body.append('file', file)
    return resolveAvatarUrl(await request<UserProfile>('/users/me/avatar', {
      method: 'POST',
      body,
    }))
  },
}

function resolveAvatarUrl(profile: UserProfile): UserProfile {
  return {
    ...profile,
    avatarUrl: profile.avatarUrl ? resolvePublicAssetUrl(profile.avatarUrl) : null,
  }
}

function resolvePublicAssetUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url
  const apiOrigin = new URL(getApiBaseUrl()).origin
  return `${apiOrigin}${url.startsWith('/') ? url : `/${url}`}`
}