<script setup lang="ts">
import {
  User,
  Palette,
  Settings,
  ShieldCheck,
  LogOut,
} from '@lucide/vue'
import { useAuthStore } from '../../stores/auth'
import { useUiStore } from '../../stores/ui'

const authStore = useAuthStore()
const uiStore = useUiStore()

const emit = defineEmits<{
  close: []
  openSettings: []
  openAdminPanel: []
  openLogout: []
}>()

const isRtl = () => uiStore.direction === 'rtl'
</script>

<template>
  <Transition name="profile-menu">
    <div class="profile-menu-panel" role="menu" aria-label="Profile menu">
      <!-- Profile -->
      <button class="menu-item" role="menuitem" @click="emit('close')">
        <User :size="15" class="menu-icon" />
        <span>{{ isRtl() ? 'نمایه' : 'Profile' }}</span>
      </button>

      <!-- Customization -->
      <button class="menu-item" role="menuitem" @click="emit('close')">
        <Palette :size="15" class="menu-icon" />
        <span>{{ isRtl() ? 'شخصی‌سازی' : 'Customization' }}</span>
      </button>

      <!-- Settings -->
      <button class="menu-item" role="menuitem" @click="emit('openSettings')">
        <Settings :size="15" class="menu-icon" />
        <span>{{ isRtl() ? 'تنظیمات' : 'Settings' }}</span>
      </button>

      <!-- Admin Panel (admin only) -->
      <button
        v-if="authStore.isAdmin"
        class="menu-item"
        role="menuitem"
        @click="emit('openAdminPanel')"
      >
        <ShieldCheck :size="15" class="menu-icon" />
        <span>{{ isRtl() ? 'پنل ادمین' : 'Admin Panel' }}</span>
      </button>

      <div class="menu-divider" />

      <!-- Sign Out -->
      <button class="menu-item menu-item--danger" role="menuitem" @click="emit('openLogout')">
        <LogOut :size="15" class="menu-icon" />
        <span>{{ isRtl() ? 'خروج از حساب' : 'Sign Out' }}</span>
      </button>
    </div>
  </Transition>
</template>

<style scoped>
.profile-menu-panel {
  position: absolute;
  bottom: calc(100% + 8px);
  inset-inline-start: 0;
  inset-inline-end: 0;
  background-color: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 5px;
  box-shadow:
    0 -8px 32px rgba(0, 0, 0, 0.35),
    0 2px 8px rgba(0, 0, 0, 0.2);
  z-index: 200;
  min-width: 180px;
}

.menu-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 10px;
  border-radius: var(--radius-sm);
  background-color: transparent;
  border: none;
  cursor: pointer;
  color: var(--foreground);
  font-size: 13px;
  font-weight: 400;
  font-family: var(--font-sans);
  transition: background-color 150ms ease, color 150ms ease;
  text-align: start;
}

.menu-item:hover {
  background-color: var(--surface-alt, var(--secondary));
}

.menu-icon {
  color: var(--muted-foreground);
  flex-shrink: 0;
  transition: color 150ms ease;
}

.menu-item:hover .menu-icon {
  color: var(--primary);
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
  margin: 4px 2px;
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
