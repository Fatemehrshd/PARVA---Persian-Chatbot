import { request } from './api'
import type { AuthResponse, LoginRequest, SignupRequest, LogoutRequest } from '../types'

/**
 * Authentication Service (Maps 1:1 with OpenAPI tag: Auth)
 * Handles account sign-up, user login, and session revocation.
 */
export const authService = {
  /**
   * Create a new user account.
   * POST /auth/signup
   */
  async signup(email: string, password: string, displayName?: string): Promise<AuthResponse> {
    const payload: SignupRequest = {
      email,
      password,
      ...(displayName ? { displayName } : {})
    }
    return request<AuthResponse>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify(payload)
    })
  },

  /**
   * Authenticate with email & password to receive access and refresh tokens.
   * POST /auth/login
   */
  async login(email: string, password: string): Promise<AuthResponse> {
    const payload: LoginRequest = { email: email.trim().toLowerCase(), password }
    return request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload)
    })
  },

  /**
   * Invalidate the current session and revoke refresh token.
   * POST /auth/logout
   */
  async logout(refreshToken?: string): Promise<void> {
    const payload: LogoutRequest = {
      ...(refreshToken ? { refreshToken } : {})
    }
    return request<void>('/auth/logout', {
      method: 'POST',
      body: JSON.stringify(payload)
    })
  },

  /**
   * Refresh access token using stored refresh token.
   * POST /auth/refresh
   */
  async refreshToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    return request<{ accessToken: string; refreshToken: string }>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken })
    })
  }
}
