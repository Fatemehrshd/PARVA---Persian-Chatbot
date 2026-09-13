import { request } from './api'
import type { AuthResponse } from '../types'

export const authService = {
  async signup(email: string, password: string, displayName?: string): Promise<AuthResponse> {
    return request<AuthResponse>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, displayName })
    })
  },

  async login(email: string, password: string): Promise<AuthResponse> {
    return request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    })
  },

  async logout(refreshToken?: string): Promise<void> {
    return request<void>('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken })
    })
  }
}
