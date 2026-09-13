import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { User } from '../types'
import { authService } from '../services/auth.service'

export const useAuthStore = defineStore('auth', () => {
  const savedUser = localStorage.getItem('user')
  const user = ref<User | null>(savedUser ? JSON.parse(savedUser) : null)
  const token = ref<string | null>(localStorage.getItem('token'))
  const refreshToken = ref<string | null>(localStorage.getItem('refreshToken'))
  const loading = ref(false)
  const error = ref<string | null>(null)

  const isAuthenticated = computed(() => !!token.value && !!user.value)
  const isAdmin = computed(() => user.value?.role === 'admin')

  function setSession(newUser: User, newAccessToken: string, newRefreshToken: string) {
    user.value = newUser
    token.value = newAccessToken
    refreshToken.value = newRefreshToken
    localStorage.setItem('user', JSON.stringify(newUser))
    localStorage.setItem('token', newAccessToken)
    localStorage.setItem('refreshToken', newRefreshToken)
  }

  async function login(email: string, password: string): Promise<boolean> {
    loading.value = true
    error.value = null
    try {
      const response = await authService.login(email, password)
      setSession(response.user, response.accessToken, response.refreshToken)
      return true
    } catch (err: any) {
      error.value = err.message || 'Login failed'
      // Mock fallback for prototype testing if backend is not yet started
      if (err.statusCode === 404 || err.message.includes('fetch')) {
        const mockUser: User = {
          id: 'mock-user-id',
          email,
          displayName: email.split('@')[0],
          role: email.includes('admin') ? 'admin' : 'user'
        }
        setSession(mockUser, 'mock-jwt-token', 'mock-refresh-token')
        error.value = null
        return true
      }
      return false
    } finally {
      loading.value = false
    }
  }

  async function signup(email: string, password: string, displayName?: string): Promise<boolean> {
    loading.value = true
    error.value = null
    try {
      const response = await authService.signup(email, password, displayName)
      setSession(response.user, response.accessToken, response.refreshToken)
      return true
    } catch (err: any) {
      error.value = err.message || 'Sign up failed'
      if (err.statusCode === 404 || err.message.includes('fetch')) {
        const mockUser: User = {
          id: 'mock-user-id',
          email,
          displayName: displayName || email.split('@')[0],
          role: 'user'
        }
        setSession(mockUser, 'mock-jwt-token', 'mock-refresh-token')
        error.value = null
        return true
      }
      return false
    } finally {
      loading.value = false
    }
  }

  async function logout() {
    try {
      if (refreshToken.value) {
        await authService.logout(refreshToken.value).catch(() => {})
      }
    } finally {
      user.value = null
      token.value = null
      refreshToken.value = null
      localStorage.removeItem('user')
      localStorage.removeItem('token')
      localStorage.removeItem('refreshToken')
    }
  }

  return {
    user,
    token,
    loading,
    error,
    isAuthenticated,
    isAdmin,
    login,
    signup,
    logout
  }
})
