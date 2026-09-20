import { defineStore } from 'pinia'
import { ref, watch, computed } from 'vue'

export interface Toast {
  id: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
  duration?: number
}

export const useUiStore = defineStore('ui', () => {
  // On mobile (< 768px) sidebar is always hidden by default regardless of localStorage
  const isMobileDefault = typeof window !== 'undefined' && window.innerWidth < 768
  const sidebarOpen = ref(isMobileDefault ? false : localStorage.getItem('sidebarOpen') !== 'false')
  // The application is strictly RTL (Persian)
  const direction = ref<'rtl'>('rtl')
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('direction')
  }
  const authModalOpen = ref(false)
  const authMode = ref<'login' | 'signup'>('login')
  const adminModelsModalOpen = ref(false)
  const toasts = ref<Toast[]>([])
  // Single source of truth for the theme currently rendered on screen. It is
  // mirrored to localStorage so the right theme applies before the backend
  // preference syncs in. For signed-in users the per-user backend preference
  // is authoritative and overrides this once synced.
  const storedTheme = typeof localStorage !== 'undefined' ? localStorage.getItem('theme') : null
  const theme = ref<'dark' | 'light'>(storedTheme === 'dark' ? 'dark' : 'light')
  // Per-user theme preference persisted on the backend (null = unset → global default).
  const userThemePreference = ref<'dark' | 'light' | null>(null)
  const themeSynced = ref(false)
  // Auth pages (login/signup) must always render in the light theme, no matter
  // what theme any user or previous session left behind. This is a view-local
  // override: it is never written to localStorage and never sent to the backend.
  const authPageLightMode = ref(false)

  /** Global default theme shown to every user who hasn't set a preference. */
  const DEFAULT_THEME: 'dark' | 'light' = 'light'

  function applyTheme(newTheme: 'dark' | 'light') {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', newTheme === 'dark')
      document.documentElement.setAttribute('data-theme', newTheme)
    }
  }

  /** The theme actually rendered on screen. Priority: auth pages are always
   * light → per-user backend preference → local setting. */
  const effectiveTheme = computed<'dark' | 'light'>(() => {
    if (authPageLightMode.value) return 'light'
    return userThemePreference.value ?? theme.value
  })

  /** Toggle the view-local light override used by the login page. */
  function setAuthPageLightMode(on: boolean) {
    authPageLightMode.value = on
  }

  // Set initial theme
  applyTheme(effectiveTheme.value)

  watch(effectiveTheme, (newTheme) => {
    applyTheme(newTheme)
  })

  watch(theme, (newTheme) => {
    localStorage.setItem('theme', newTheme)
    // local setting only wins when no per-user preference is set
    if (!userThemePreference.value) {
      applyTheme(newTheme)
    }
  })

  /**
   * On page refresh, re-arm the per-user sync so the next call actually
   * fetches the backend preference instead of no-op'ing on `themeSynced`.
   * The sync itself is lazy (async) and safe to call before auth resolves.
   */
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
      try { localStorage.setItem('theme', theme.value) } catch {}
    })
  }

  async function persistThemePreference(preference: 'dark' | 'light' | null) {
    try {
      const { profileService } = await import('../services/profile.service')
      await profileService.updateThemePreference(preference)
    } catch {
      // Offline / backend error: the local change still applies.
    }
  }

  /**
   * Fetch the per-user theme preference from the backend and apply it.
   * Runs once per session; `resetThemeSession()` re-arms it for the next user.
   */
  async function syncUserThemePreference() {
    if (themeSynced.value) return
    themeSynced.value = true
    try {
      const { profileService } = await import('../services/profile.service')
      const pref = await profileService.getThemePreference()
      userThemePreference.value = pref
      theme.value = pref ?? DEFAULT_THEME
    } catch {
      // Backend unavailable or unauthenticated: keep the current setting.
    }
  }

  /** Persist a per-user theme preference on the backend and apply it. */
  function setUserThemePreference(preference: 'dark' | 'light' | null) {
    userThemePreference.value = preference
    theme.value = preference ?? DEFAULT_THEME
    void persistThemePreference(preference)
  }

  /** Clear the per-user preference (falls back to the global default = light). */
  function clearUserThemePreference() {
    setUserThemePreference(null)
  }

  /** Set the displayed theme (quick toggles). Persists per-user when signed in. */
  function setTheme(newTheme: 'dark' | 'light') {
    theme.value = newTheme
    void persistIfSignedIn(newTheme)
  }

  async function persistIfSignedIn(newTheme: 'dark' | 'light') {
    try {
      const { useAuthStore } = await import('../stores/auth')
      const auth = useAuthStore()
      if (!auth.isAuthenticated) return
      userThemePreference.value = newTheme
      await persistThemePreference(newTheme)
    } catch {
      // Ignore; the local change still applies.
    }
  }

  function toggleTheme() {
    setTheme(theme.value === 'dark' ? 'light' : 'dark')
  }

  /**
   * Forget the current session's per-user theme and return to the global
   * default. Called on login/logout so one user's preference never leaks
   * into another user's session.
   */
  function resetThemeSession() {
    themeSynced.value = false
    userThemePreference.value = null
    theme.value = DEFAULT_THEME
  }

  // Sync direction to html element (strictly Persian RTL)
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('dir', 'rtl')
    document.documentElement.setAttribute('lang', 'fa')
  }

  watch(sidebarOpen, (isOpen) => {
    localStorage.setItem('sidebarOpen', String(isOpen))
  })

  function toggleSidebar() {
    sidebarOpen.value = !sidebarOpen.value
  }

  function toggleDirection() {
    direction.value = 'rtl'
  }

  function openAuth(mode: 'login' | 'signup' = 'login') {
    authMode.value = mode
    authModalOpen.value = true
  }

  function closeAuth() {
    authModalOpen.value = false
  }

  function openAdminModels() {
    adminModelsModalOpen.value = true
  }

  function closeAdminModels() {
    adminModelsModalOpen.value = false
  }

  const settingsModalOpen = ref(false)

  function openSettings() {
    settingsModalOpen.value = true
  }

  function closeSettings() {
    settingsModalOpen.value = false
  }

  function showToast(
    message: string,
    type: 'info' | 'success' | 'warning' | 'error' = 'info',
    duration = 4000
  ) {
    // Prevent duplicate toast spam if the exact message is already showing
    const existing = toasts.value.find((t) => t.message === message)
    if (existing) {
      return existing.id
    }

    // Limit to maximum 2 visible toasts at a time to prevent UI clutter and spam
    while (toasts.value.length >= 2) {
      toasts.value.shift()
    }

    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    toasts.value.push({ id, message, type, duration })
    if (duration > 0) {
      setTimeout(() => {
        removeToast(id)
      }, duration)
    }
    return id
  }

  function removeToast(id: string) {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }

  const isOnline = ref(typeof navigator !== 'undefined' ? navigator.onLine : true)

  function setOnline(online: boolean) {
    isOnline.value = online
  }

  function initNetworkListeners() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => setOnline(true))
      window.addEventListener('offline', () => setOnline(false))
    }
  }

  return {
    sidebarOpen,
    direction,
    authModalOpen,
    authMode,
    adminModelsModalOpen,
    settingsModalOpen,
    toasts,
    theme,
    userThemePreference,
    effectiveTheme,
    themeSynced,
    authPageLightMode,
    setAuthPageLightMode,
    isOnline,
    toggleSidebar,
    toggleDirection,
    openAuth,
    closeAuth,
    openAdminModels,
    closeAdminModels,
    openSettings,
    closeSettings,
    showToast,
    removeToast,
    setTheme,
    toggleTheme,
    syncUserThemePreference,
    setUserThemePreference,
    clearUserThemePreference,
    resetThemeSession,
    setOnline,
    initNetworkListeners
  }
})
