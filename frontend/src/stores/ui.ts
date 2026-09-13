import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export const useUiStore = defineStore('ui', () => {
  const sidebarOpen = ref(localStorage.getItem('sidebarOpen') !== 'false')
  const direction = ref<'rtl' | 'ltr'>((localStorage.getItem('direction') as 'rtl' | 'ltr') || 'rtl')
  const authModalOpen = ref(false)
  const authMode = ref<'login' | 'signup'>('login')
  const adminModelsModalOpen = ref(false)

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

  return {
    sidebarOpen,
    direction,
    authModalOpen,
    authMode,
    adminModelsModalOpen,
    settingsModalOpen,
    toggleSidebar,
    toggleDirection,
    openAuth,
    closeAuth,
    openAdminModels,
    closeAdminModels,
    openSettings,
    closeSettings
  }
})
