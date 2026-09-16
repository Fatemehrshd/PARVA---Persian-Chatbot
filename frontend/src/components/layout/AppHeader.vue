<script setup lang="ts">
import { useUiStore } from '../../stores/ui'
import { useAuthStore } from '../../stores/auth'

const uiStore = useUiStore()
const authStore = useAuthStore()
</script>

<template>
  <header class="app-header">
    <!-- Left Section: Sidebar Toggle -->
    <div class="header-left">
      <button
        class="icon-button"
        @click="uiStore.toggleSidebar"
        :title="uiStore.sidebarOpen ? 'بستن نوار کناری' : 'باز کردن نوار کناری'"
        aria-label="تغییر وضعیت نوار کناری"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
          <line x1="9" y1="3" x2="9" y2="21"/>
        </svg>
      </button>

      <span class="header-brand-title font-mono text-xs hidden sm:inline text-muted-foreground">NeuralChat</span>
    </div>

    <!-- Right Section: Admin Panel, Settings, User Profile -->
    <div class="header-right">
      
      <!-- Settings Button -->
      <button
        class="icon-button"
        @click="uiStore.openSettings"
        title="تنظیمات"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
        </svg>
      </button>

      <!-- Admin Panel link/button (Admin Only) -->
      <button
        v-if="authStore.isAdmin"
        class="icon-text-btn px-2 sm:px-3"
        @click="uiStore.openAdminModels"
        title="پنل ادمین (مدیریت مدل‌ها)"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
          <line x1="8" y1="21" x2="16" y2="21"></line>
          <line x1="12" y1="17" x2="12" y2="21"></line>
        </svg>
        <span class="btn-label hidden sm:inline">پنل ادمین</span>
      </button>

      <!-- Auth State / User Button -->
      <template v-if="authStore.isAuthenticated">
        <div class="user-pill">
          <div class="header-avatar">
            {{ authStore.user?.displayName?.charAt(0).toUpperCase() || 'U' }}
          </div>
          <span class="user-name-header font-medium text-xs hidden sm:inline px-1">
            {{ authStore.user?.displayName || authStore.user?.email }}
          </span>
        </div>
      </template>
      <template v-else>
        <router-link to="/login" class="login-trigger-btn px-2 sm:px-3 text-xs sm:text-sm inline-flex items-center justify-center">
          ورود
        </router-link>
      </template>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  position: relative;
  height: var(--header-height);
  width: 100%;
  background-color: var(--background);
  border-bottom: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  z-index: 50;
  flex-shrink: 0;
}

.header-left, .header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-brand-title {
  letter-spacing: 0.05em;
  user-select: none;
}

.icon-button {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  color: var(--secondary-foreground);
  cursor: pointer;
  border: none;
  background-color: transparent;
  transition: all 150ms ease;
}

.icon-button:hover {
  background-color: var(--secondary);
  color: var(--foreground);
}

.icon-text-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  background-color: var(--secondary);
  border: none;
  border-radius: var(--radius-sm);
  font-size: 12px;
  color: var(--secondary-foreground);
  cursor: pointer;
  transition: all 150ms ease;
}

.icon-text-btn:hover {
  background-color: var(--secondary);
  color: var(--foreground);
}

.user-pill {
  display: flex;
  align-items: center;
  gap: 8px;
  background-color: var(--secondary);
  padding: 3px 8px 3px 4px;
  border-radius: 20px;
  border: none;
}

.header-avatar {
  width: 32px;
  height: 32px;
  flex: 0 0 32px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--primary), #a78bfa);
  color: #fff;
  font-size: 11px;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
}

.user-name-header {
  color: var(--foreground);
}

.login-trigger-btn {
  padding: 5px 12px;
  background-color: var(--primary);
  color: var(--primary-foreground);
  border-radius: var(--radius-sm);
  font-size: 12px;
  font-weight: 500;
  border: none;
}
</style>
