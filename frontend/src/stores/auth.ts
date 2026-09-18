import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { User, QuotaState } from '../types'
import { authService } from '../services/auth.service'
import { profileService } from '../services/profile.service'
import { isTokenExpired } from '../lib/jwt'

export const useAuthStore = defineStore('auth', () => {
  const rawToken = localStorage.getItem('token')
  if (rawToken && isTokenExpired(rawToken)) {
    localStorage.removeItem('user')
    localStorage.removeItem('token')
    localStorage.removeItem('refreshToken')
  }

  const savedUser = localStorage.getItem('user')
  const user = ref<User | null>(savedUser ? JSON.parse(savedUser) : null)
  const token = ref<string | null>(localStorage.getItem('token'))
  const refreshToken = ref<string | null>(localStorage.getItem('refreshToken'))
  const loading = ref(false)
  const error = ref<string | null>(null)
  const quota = ref<QuotaState>({ blocked: false, reason: null, remainingTokens: null, remainingMessages: null, remainingPercent: null, resetAt: null })
  const quotaLoaded = ref(false)

  const isAuthenticated = computed(() => !!token.value && !!user.value)
  const isAdmin = computed(() => user.value?.role === 'admin')
  const quotaStatusColor = computed(() => {
    const percent = quota.value.remainingPercent
    if (percent === null || percent > 50) return 'text-emerald-500'
    if (percent >= 20) return 'text-amber-500'
    return 'text-rose-500'
  })

  function applyQuotaSnapshot(snapshot: QuotaState) {
    quota.value = snapshot
    quotaLoaded.value = true
  }

  async function refreshQuota() {
    try {
      const { chatService } = await import('../services/chat.service')
      applyQuotaSnapshot(await chatService.getQuota())
    } catch {
      // Quota refresh is advisory; sending still remains server-authoritative.
    }
  }

  function setSession(newUser: User, newAccessToken: string, newRefreshToken: string) {
    user.value = newUser
    token.value = newAccessToken
    refreshToken.value = newRefreshToken
    localStorage.setItem('user', JSON.stringify(newUser))
    localStorage.setItem('token', newAccessToken)
    localStorage.setItem('refreshToken', newRefreshToken)
  }

  function updateUser(updatedUser: User) {
    user.value = updatedUser
    localStorage.setItem('user', JSON.stringify(updatedUser))
  }

  /**
   * The auth (login/signup) payload carries no avatarUrl, so the avatar in
   * the sidebar only appeared after the profile modal was opened. This
   * fetches /users/me once and syncs the full profile (avatar included)
   * into the session right after login and on page refresh.
   */
  async function refreshProfile(): Promise<void> {
    if (!token.value) return
    try {
      updateUser(await profileService.getProfile())
    } catch (err: any) {
      // 401 is handled globally (auto logout + toast) in services/api.ts;
      // any other failure keeps the current session untouched.
      if (err?.statusCode !== 401) {
        console.warn('Profile refresh failed:', err)
      }
    }
  }

  async function login(email: string, password: string): Promise<boolean> {
    loading.value = true
    error.value = null
    try {
      const response = await authService.login(email.trim().toLowerCase(), password)
      setSession(response.user, response.accessToken, response.refreshToken)
      void refreshProfile()
      return true
    } catch (err: any) {
      let msg = err?.message || 'ورود با خطا مواجه شد.'
      if (
        typeof msg === 'string' &&
        (msg.toLowerCase().includes('invalid email or password') ||
         msg.toLowerCase().includes('unauthorized') ||
         err?.statusCode === 401)
      ) {
        msg = 'ایمیل یا رمز عبور اشتباه است.'
      }
      error.value = msg
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
      void refreshProfile()
      return true
    } catch (err: any) {
      let msg = err?.message || 'ثبت‌نام با خطا مواجه شد.'
      if (
        typeof msg === 'string' &&
        msg.toLowerCase().includes('already registered')
      ) {
        msg = 'این نشانی ایمیل قبلاً در سامانه ثبت شده است.'
      }
      error.value = msg
      return false
    } finally {
      loading.value = false
    }
  }

  async function logout() {
    try {
      if (token.value) {
        await authService.logout(refreshToken.value || undefined).catch(() => {})
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

  // Proactive token expiration monitor
  if (typeof window !== 'undefined') {
    const checkExpiry = () => {
      if (token.value && isTokenExpired(token.value)) {
        void logout()
        if (window.location.pathname !== '/login' && (!import.meta.env || import.meta.env.MODE !== 'test')) {
          window.location.href = '/login'
        }
      }
    }
    window.addEventListener('focus', checkExpiry)
  }

  // Existing session (page refresh / direct URL): sync the profile — avatar
  // included — immediately instead of waiting for the profile modal.
  if (token.value && user.value) {
    void refreshProfile()
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
    logout,
    updateUser,
    refreshProfile,
    quota,
    quotaLoaded,
    quotaStatusColor,
    applyQuotaSnapshot,
    refreshQuota,
  }
})
