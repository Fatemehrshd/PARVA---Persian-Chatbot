<script setup lang="ts">
import {
  User,
  Palette,
  ShieldCheck,
  LogOut,
  Moon,
  Sun,
  Sparkles,
  Receipt,
} from '@lucide/vue'
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/auth'
import { useUiStore } from '../../stores/ui'
import { subscriptionService } from '../../services/subscription.service'

let router: any = null
try {
  router = useRouter()
} catch {
  router = null
}
const authStore = useAuthStore()
const uiStore = useUiStore()
const currentPlanName = ref<string>('')
const hasActivePurchasedPlan = ref<boolean>(false)

async function refreshUserState() {
  void authStore.refreshIdentity()
  void authStore.refreshQuota()
  try {
    const sub = await subscriptionService.getCurrentSubscription()
    if (sub?.entitlements?.isAdmin) {
      currentPlanName.value = 'مدیر'
      hasActivePurchasedPlan.value = false
    } else {
      const activeSub = sub?.activeSubscription
      if (
        activeSub &&
        activeSub.status === 'ACTIVE' &&
        !activeSub.plan?.isDefault &&
        Number(activeSub.plan?.price) > 0
      ) {
        hasActivePurchasedPlan.value = true
      } else {
        hasActivePurchasedPlan.value = false
      }
      if (sub?.entitlements?.plan?.name) {
        currentPlanName.value = sub.entitlements.plan.name
      }
    }
  } catch {
    // fallback
  }
}

onMounted(refreshUserState)

const emit = defineEmits<{
  close: []
  openProfile: []
  openPayments: []
  openSubscription: []
  openSettings: []
  openAdminPanel: []
  openLogout: []
}>()

function handleOpenSubscription() {
  emit('close')
  if (hasActivePurchasedPlan.value) {
    uiStore.showToast('شما در حال حاضر دارای اشتراک فعال هستید و امکان تغییر آن وجود ندارد.', 'info')
    return
  }
  emit('openSubscription')
  try {
    router?.push?.('/subscription')
  } catch {
    // fallback if router not provided
  }
}
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
        <div class="quota-summary-header">
          <span class="quota-summary-title">
            {{ authStore.quota.planName || (authStore.isAdmin ? 'مدیر سیستم' : 'سهمیه دوره') }}
          </span>
          <span :class="authStore.quotaStatusColor" class="quota-summary-pct">
            {{ authStore.quota.remainingPercent === null ? '∞' : `${Number(authStore.quota.remainingPercent).toLocaleString('fa-IR')}٪` }}
          </span>
        </div>
        <div v-if="authStore.quota.remainingTokens !== null || authStore.quota.remainingMessages !== null" class="quota-summary-detail">
          <span v-if="authStore.quota.remainingTokens !== null">
            {{ Number(authStore.quota.remainingTokens).toLocaleString('fa-IR') }} توکن باقی‌مانده
          </span>
          <span v-if="authStore.quota.remainingMessages !== null">
            · {{ Number(authStore.quota.remainingMessages).toLocaleString('fa-IR') }} پیام
          </span>
        </div>
      </div>

      <!-- Profile -->
      <button class="menu-item" role="menuitem" @click="emit('openProfile')">
        <User :size="15" class="menu-icon" />
        <span class="menu-label">نمایه کاربری</span>
      </button>

      <!-- Payments History -->
      <button class="menu-item" role="menuitem" @click="emit('openPayments')">
        <Receipt :size="15" class="menu-icon text-emerald-500" />
        <span class="menu-label">سوابق پرداخت</span>
      </button>

      <!-- Subscription -->
      <button class="menu-item menu-item--subscription" role="menuitem" @click="handleOpenSubscription">
        <Sparkles :size="15" class="menu-icon text-amber-500" />
        <span class="menu-label">ارتقا و خرید اشتراک</span>
        <span v-if="currentPlanName" class="plan-tag">{{ currentPlanName }}</span>
      </button>

      <!-- Customization & Theme -->
      <button class="menu-item" role="menuitem" @click="emit('openSettings')">
        <Palette :size="15" class="menu-icon text-primary" />
        <span class="menu-label">شخصی‌سازی و تم</span>
        <span class="theme-badge" :title="uiStore.effectiveTheme === 'dark' ? 'حالت تیره' : 'حالت روشن'">
          <Moon v-if="uiStore.effectiveTheme === 'dark'" :size="12" />
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
  margin-bottom: 6px;
  border-radius: 9px;
  background: color-mix(in srgb, var(--secondary) 55%, transparent);
  border: 1px solid var(--border);
  font-size: 12px;
}

.quota-summary-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.quota-summary-title {
  font-size: 11px;
  font-weight: 500;
  color: var(--muted-foreground);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quota-summary-pct {
  font-weight: 700;
  font-family: var(--font-mono);
  font-size: 12px;
  flex-shrink: 0;
}

.quota-summary-detail {
  margin-top: 4px;
  font-size: 10.5px;
  color: var(--muted-foreground);
  font-family: var(--font-mono);
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

.plan-tag {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: 6px;
  background-color: rgba(245, 158, 11, 0.12);
  color: #f59e0b;
  border: 1px solid rgba(245, 158, 11, 0.25);
  margin-inline-start: 6px;
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
