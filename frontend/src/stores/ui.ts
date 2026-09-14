import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export interface Toast {
  id: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
  duration?: number
}

export const useUiStore = defineStore('ui', () => {
  const sidebarOpen = ref(localStorage.getItem('sidebarOpen') !== 'false')
  const direction = ref<'rtl' | 'ltr'>((localStorage.getItem('direction') as 'rtl' | 'ltr') || 'rtl')
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

  // Sync direction to html element
  document.documentElement.setAttribute('dir', direction.value)
  document.documentElement.setAttribute('lang', direction.value === 'rtl' ? 'fa' : 'en')

  watch(direction, (newDir) => {
    localStorage.setItem('direction', newDir)
    document.documentElement.setAttribute('dir', newDir)
    document.documentElement.setAttribute('lang', newDir === 'rtl' ? 'fa' : 'en')
  })

  watch(sidebarOpen, (isOpen) => {
    localStorage.setItem('sidebarOpen', String(isOpen))
  })

  function toggleSidebar() {
    sidebarOpen.value = !sidebarOpen.value
  }

  function toggleDirection() {
    direction.value = direction.value === 'rtl' ? 'ltr' : 'rtl'
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

  return {
    sidebarOpen,
    direction,
    authModalOpen,
    authMode,
    adminModelsModalOpen,
    settingsModalOpen,
    toasts,
    theme,
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
    toggleTheme
  }
})
