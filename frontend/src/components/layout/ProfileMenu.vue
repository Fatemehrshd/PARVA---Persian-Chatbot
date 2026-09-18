<script setup lang="ts">
import {
  User,
  Palette,
  ShieldCheck,
  LogOut,
  Moon,
  Sun,
} from '@lucide/vue'
import { onMounted } from 'vue'
import { useAuthStore } from '../../stores/auth'
import { useUiStore } from '../../stores/ui'

const authStore = useAuthStore()
const uiStore = useUiStore()

function refreshQuota() {
  void authStore.refreshQuota()
}

onMounted(refreshQuota)

const emit = defineEmits<{
  close: []
  openProfile: []
  openSettings: []
  openAdminPanel: []
  openLogout: []
}>()
</script>

<template>
  <Transition name="profile-menu">
    <div class="profile-menu-panel" role="menu" aria-label="منوی کاربری">
      <div
        v-if="authStore.quotaLoaded"
        data-testid="quota-summary"
        class="quota-summary"
        role="presentation"
        aria-readonly="true"
      >
        <span :class="authStore.quotaStatusColor">
          {{ authStore.quota.remainingPercent === null ? '∞' : `${authStore.quota.remainingPercent}٪` }} باقی‌مانده
        </span>
      </div>

      <!-- Profile -->
      <button class="menu-item" role="menuitem" @click="emit('openProfile')">
        <User :size="15" class="menu-icon" />
        <span class="menu-label">نمایه کاربری</span>
      </button>

      <!-- Customization & Theme -->
      <button class="menu-item" role="menuitem" @click="emit('openSettings')">
        <Palette :size="15" class="menu-icon text-primary" />
        <span class="menu-label">شخصی‌سازی و تم</span>
        <span class="theme-badge" :title="uiStore.theme === 'dark' ? 'حالت تیره' : 'حالت روشن'">
          <Moon v-if="uiStore.theme === 'dark'" :size="12" />
          <Sun v-else :size="12" />
        </span>
      </button>

      <!-- Admin Panel (admin only) -->
      <button
        v-if="authStore.isAdmin"
        class="menu-item menu-item--admin"
        role="menuitem"
        @click="emit('openAdminPanel')"
      >
        <ShieldCheck :size="15" class="menu-icon text-amber-500" />
        <span class="menu-label">پنل ادمین</span>
      </button>

      <div class="menu-divider" />

      <!-- Sign Out -->
      <button class="menu-item menu-item--danger" role="menuitem" @click="emit('openLogout')">
        <LogOut :size="15" class="menu-icon" />
        <span class="menu-label">خروج از حساب</span>
      </button>
    </div>
  </Transition>
</template>

<style scoped>
.profile-menu-panel {
  position: absolute;
  bottom: calc(100% + 10px);
  inset-inline-start: 0;
  inset-inline-end: 0;
  background-color: var(--card);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 6px;
  box-shadow:
    0 -12px 32px rgba(0, 0, 0, 0.4),
    0 2px 10px rgba(0, 0, 0, 0.2);
  z-index: 200;
  min-width: 190px;
  backdrop-filter: blur(16px);
}

.menu-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 9px;
  background-color: transparent;
  border: none;
  cursor: pointer;
  color: var(--foreground);
  font-size: 13px;
  font-weight: 500;
  font-family: var(--font-sans);
  transition: background-color 150ms ease, color 150ms ease;
  text-align: start;
}

.quota-summary {
  padding: 8px 10px;
  margin-bottom: 4px;
  border-radius: 9px;
  background: color-mix(in srgb, var(--secondary) 55%, transparent);
  border: 1px solid var(--border);
  text-align: center;
  font-size: 12px;
  font-weight: 700;
}

.menu-item:hover {
  background-color: var(--surface-alt, var(--secondary));
}

.menu-label {
  flex: 1;
}

.menu-icon {
  color: var(--muted-foreground);
  flex-shrink: 0;
  transition: color 150ms ease;
}

.menu-item:hover .menu-icon {
  color: var(--primary);
}

.theme-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 6px;
  background-color: var(--secondary);
  color: var(--muted-foreground);
  border: 1px solid var(--border);
}

.menu-item:hover .theme-badge {
  color: var(--primary);
  border-color: var(--primary);
}

.menu-item--admin:hover .menu-icon {
  color: #f59e0b;
}

.menu-item--danger {
  color: var(--muted-foreground);
}

.menu-item--danger:hover {
  background-color: rgba(239, 68, 68, 0.12);
  color: #f87171;
}

.menu-item--danger:hover .menu-icon {
  color: #f87171;
}

.menu-divider {
  height: 1px;
  background-color: var(--border);
  margin: 5px 2px;
  opacity: 0.8;
}

/* Transition */
.profile-menu-enter-active,
.profile-menu-leave-active {
  transition: opacity 160ms ease, transform 160ms ease;
  transform-origin: bottom center;
}

.profile-menu-enter-from {
  opacity: 0;
  transform: translateY(6px) scale(0.97);
}

.profile-menu-leave-to {
  opacity: 0;
  transform: translateY(4px) scale(0.98);
}
</style>
