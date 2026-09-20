import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { User, QuotaState } from '../types'
import { authService } from '../services/auth.service'
import { profileService } from '../services/profile.service'
import { isTokenExpired } from '../lib/jwt'

export const useAuthStore = defineStore('auth', () => {
  const rawToken = localStorage.getItem('token')
  const rawRefreshToken = localStorage.getItem('refreshToken')
  if (rawToken && isTokenExpired(rawToken) && !rawRefreshToken) {
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

  // ─── Identity (authoritative: refreshed from /users/me + /admin/users) ─────
  /** اکانت لاگین‌شده؛ فقط نقش/وضعیت آن از دیتابیس خوانده می‌شود، نه از localStorage. */
  const identity = ref<{ id: string; role: string; isActive: boolean } | null>(null)

  /** نقش کاربر — فقط از هویت تازه دیتابیس؛ هرگز از توکن یا localStorage. */
  const isAdmin = computed(() => identity.value?.role === 'admin')
  const quota = ref<QuotaState>({ blocked: false, reason: null, remainingTokens: null, remainingMessages: null, remainingPercent: null, resetAt: null })
  const quotaLoaded = ref(false)

  const isAuthenticated = computed(() => !!token.value && !!user.value)
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

  /**
   * The authoritative identity (role + active state) for this session.
   * /users/me is the source of truth — unlike the stored JWT/localStorage copy,
   * it reflects a role an admin has just granted or revoked. As a safety net,
   * an admin-row lookup (GET /admin/users, admin sessions only) re-syncs it.
   */
  async function refreshIdentity(): Promise<void> {
    if (!token.value) return
    try {
      const me = await profileService.getProfile()
      identity.value = { id: me.id, role: me.role, isActive: me.isActive !== false }
      // Keep the cached session in lockstep so reloads never disagree with the DB.
      if (user.value) updateUser({ ...user.value, role: me.role })
    } catch {
      // Advisory: guards fail closed on 401; other errors keep last identity.
    }
    if (isAdmin.value) {
      try {
        const { adminService } = await import('../services/admin.service')
        const users = (await adminService.listUsers().catch(() => [])) as any[]
        const row = (Array.isArray(users) ? users : (users as any)?.items || []).find(
          (candidate: any) => candidate?.id === identity.value?.id
        )
        if (row?.role) {
          identity.value = { id: identity.value!.id, role: row.role, isActive: row.isActive !== false }
          if (user.value) updateUser({ ...user.value, role: row.role })
        }
      } catch {
        // Non-admin-safe: admin UI failure must not break the chat session.
      }
    }
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
   * Pull the per-user theme preference from the backend and apply it.
   * Runs after every auth state change (login, signup, profile refresh).
   */
  async function syncUserTheme() {
    if (!token.value) return
    try {
      const { useUiStore } = await import('../stores/ui')
      const ui = useUiStore()
      await ui.syncUserThemePreference()
    } catch {
      // Non-fatal: theme falls back to the local setting.
    }
  }

  /**
   * Reset the theme session (per-user preference + sync flag) to the global
   * default. Called on login/logout so one account's theme never leaks into
   * the next account's session.
   */
  async function resetThemeSession() {
    try {
      const { useUiStore } = await import('../stores/ui')
      useUiStore().resetThemeSession()
    } catch {
      // Store not available yet — the default stays in place.
    }
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
    await syncUserTheme()
  }

  async function login(email: string, password: string): Promise<boolean> {
    loading.value = true
    error.value = null
    try {
      const response = await authService.login(email.trim().toLowerCase(), password)
      // Start this user's theme session fresh: never inherit the previous
      // account's backend preference.
      await resetThemeSession()
      setSession(response.user, response.accessToken, response.refreshToken)
      await refreshProfile()
      await refreshIdentity()
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
      await resetThemeSession()
      setSession(response.user, response.accessToken, response.refreshToken)
      await refreshProfile()
      await refreshIdentity()
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
      // Return to the global default theme for the next (possibly different) user.
      await resetThemeSession()
    }
  }

  // Proactive token expiration monitor
  if (typeof window !== 'undefined') {
    const checkExpiry = async () => {
      if (token.value && isTokenExpired(token.value)) {
        if (refreshToken.value) {
          try {
            const res = await authService.refreshToken(refreshToken.value)
            token.value = res.accessToken
            refreshToken.value = res.refreshToken
            localStorage.setItem('token', res.accessToken)
            localStorage.setItem('refreshToken', res.refreshToken)
            return
          } catch {
            // Refresh failed, fall through to logout
          }
        }
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
    void refreshIdentity()
  }

  return {
    user,
    token,
    refreshToken,
    loading,
    error,
    isAuthenticated,
    isAdmin,
    identity,
    login,
    signup,
    logout,
    updateUser,
    refreshProfile,
    refreshIdentity,
    quota,
    quotaLoaded,
    quotaStatusColor,
    applyQuotaSnapshot,
    refreshQuota,
  }
})
