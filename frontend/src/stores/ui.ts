import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

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
  const theme = ref<'dark' | 'light'>((localStorage.getItem('theme') as 'dark' | 'light') || 'dark')

  function applyTheme(newTheme: 'dark' | 'light') {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', newTheme === 'dark')
      document.documentElement.setAttribute('data-theme', newTheme)
    }
  }

  // Set initial theme
  applyTheme(theme.value)

  watch(theme, (newTheme) => {
    localStorage.setItem('theme', newTheme)
    applyTheme(newTheme)
  })

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

  function setTheme(newTheme: 'dark' | 'light') {
    theme.value = newTheme
  }

  function toggleTheme() {
    theme.value = theme.value === 'dark' ? 'light' : 'dark'
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
    setOnline,
    initNetworkListeners
  }
})
