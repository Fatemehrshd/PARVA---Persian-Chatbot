<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ShieldCheck, CheckCircle2, XCircle, CreditCard, Sun, Moon } from '@lucide/vue'
import { paymentService } from '../services/payment.service'
import { useUiStore } from '../stores/ui'
import { useThemeLogo } from '../composables/useThemeLogo'
import BaseButton from '../components/ui/BaseButton.vue'

const route = useRoute()
const router = useRouter()
const uiStore = useUiStore()
const { activeLogo } = useThemeLogo()

const authority = computed(() => String(route.query.authority || route.query.Authority || ''))
const amount = computed(() => Number(route.query.amount || 0))
const gateway = computed(() => String(route.query.gateway || 'sandbox'))
const isZarinpal = computed(() => gateway.value === 'zarinpal' || authority.value.startsWith('ZP_'))
const isSubmitting = ref(false)

async function handlePaySuccess() {
  if (!authority.value) return
  isSubmitting.value = true
  try {
    await paymentService.verify({
      authority: authority.value,
      status: 'OK',
    })
    router.push(`/payment-result?authority=${authority.value}&status=OK`)
  } catch (err: any) {
    uiStore.showToast(err.message || 'خطا در تایید تراکنش', 'error')
    router.push(`/payment-result?authority=${authority.value}&status=NOK`)
  } finally {
    isSubmitting.value = false
  }
}

async function handlePayCancel() {
  if (!authority.value) return
  isSubmitting.value = true
  try {
    await paymentService.verify({
      authority: authority.value,
      status: 'NOK',
      payload: { cancel: true },
    })
  } catch {
    // ignore
  } finally {
    isSubmitting.value = false
    router.push(`/payment-result?authority=${authority.value}&status=NOK`)
  }
}
</script>

<template>
  <div class="sandbox-page" dir="rtl">
    <!-- Ambient Radial Glow -->
    <div class="ambient-glow" aria-hidden="true"></div>

    <!-- Top Bar with Logo & Theme Toggle -->
    <header class="sandbox-top-bar">
      <div class="brand-link" @click="router.push('/')">
        <div class="brand-logo-wrap">
          <img :src="activeLogo" alt="پروا" class="brand-logo" />
        </div>
        <span class="brand-title">پروا</span>
      </div>

      <button
        type="button"
        class="theme-toggle-btn"
        :title="uiStore.theme === 'dark' ? 'تغییر به تم روشن' : 'تغییر به تم تاریک'"
        @click="uiStore.toggleTheme"
      >
        <Sun v-if="uiStore.theme === 'dark'" :size="16" class="text-amber-400" />
        <Moon v-else :size="16" class="text-primary" />
        <span class="text-xs font-medium">{{ uiStore.theme === 'dark' ? 'حالت روشن' : 'حالت شب' }}</span>
      </button>
    </header>

    <main class="sandbox-container">
      <div class="sandbox-card">
        <div class="sandbox-header">
          <div class="gateway-icon-wrap" :class="{ 'zarinpal-icon': isZarinpal }">
            <CreditCard :size="24" :class="isZarinpal ? 'text-amber-500' : 'text-primary'" />
          </div>
          <div>
            <h2 class="gateway-title">{{ isZarinpal ? 'شبیه‌ساز درگاه زرین‌پال' : 'شبیه‌ساز درگاه پرداخت اینترنتی' }}</h2>
            <span class="sandbox-badge" :class="{ 'zarinpal-badge': isZarinpal }">
              {{ isZarinpal ? 'محیط سندباکس زرین‌پال (Zarinpal Sandbox)' : 'محیط آزمایشی (Sandbox)' }}
            </span>
          </div>
        </div>

        <div class="divider"></div>

        <div class="info-rows">
          <div class="info-row">
            <span class="info-label">پذیرنده:</span>
            <span class="info-val font-semibold text-foreground">پلتفرم هوش مصنوعی پروا</span>
          </div>
          <div class="info-row">
            <span class="info-label">درگاه پرداخت:</span>
            <span class="info-val text-xs text-foreground">{{ isZarinpal ? 'زرین‌پال (شاپرک - آزمایشی)' : 'شبیه‌ساز داخلی' }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">مبلغ قابل پرداخت:</span>
            <div class="text-left">
              <span class="info-val price font-mono">{{ Math.floor(amount / 10).toLocaleString('fa-IR') }} تومان</span>
              <span class="text-[10.5px] text-muted-foreground block font-mono">({{ amount.toLocaleString('fa-IR') }} ریال)</span>
            </div>
          </div>
          <div class="info-row">
            <span class="info-label">کد ارجاع سفارش:</span>
            <span class="info-val code select-all" dir="ltr">{{ authority }}</span>
          </div>
        </div>

        <div class="sandbox-notice">
          <ShieldCheck :size="16" class="text-amber-500 shrink-0" />
          <p>این یک درگاه تستی امن است و هیچ مبلغ واقعی از حساب بانکی شما کسر نخواهد شد.</p>
        </div>

        <div class="action-buttons">
          <BaseButton
            variant="primary"
            class="w-full justify-center success-btn"
            :is-loading="isSubmitting"
            @click="handlePaySuccess"
          >
            <CheckCircle2 :size="16" />
            <span>تکمیل پرداخت موفق (تستی)</span>
          </BaseButton>

          <BaseButton
            variant="secondary"
            class="w-full justify-center cancel-btn"
            :disabled="isSubmitting"
            @click="handlePayCancel"
          >
            <XCircle :size="16" />
            <span>انصراف و لغو تراکنش</span>
          </BaseButton>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.sandbox-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: var(--background);
  color: var(--foreground);
  position: relative;
  overflow-x: hidden;
  transition: background-color 0.25s ease, color 0.25s ease;
}

.ambient-glow {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 100%;
  max-width: 900px;
  height: 480px;
  background: radial-gradient(
    ellipse at 50% 15%,
    color-mix(in srgb, var(--primary) 12%, transparent) 0%,
    transparent 70%
  );
  pointer-events: none;
  z-index: 0;
}

.sandbox-top-bar {
  position: relative;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  max-width: 960px;
  margin: 0 auto;
  width: 100%;
}

.brand-link {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  user-select: none;
}

.brand-logo-wrap {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid var(--border);
  background-color: var(--card);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--shadow-sm);
}

.brand-logo {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.brand-title {
  font-size: 17px;
  font-weight: 800;
  color: var(--foreground);
}

.theme-toggle-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--card);
  color: var(--foreground);
  cursor: pointer;
  box-shadow: var(--shadow-sm);
  transition: all 0.15s ease;
}

.theme-toggle-btn:hover {
  background: var(--secondary);
  border-color: var(--primary);
}

.sandbox-container {
  position: relative;
  z-index: 10;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  max-width: 480px;
  width: 100%;
  margin: 0 auto;
}

.sandbox-card {
  width: 100%;
  background-color: var(--card);
  border: 1px solid var(--border);
  border-radius: 24px;
  padding: 32px 26px;
  box-shadow: 0 12px 36px rgba(0, 0, 0, 0.06), 0 1px 3px rgba(0, 0, 0, 0.04);
  backdrop-filter: blur(12px);
}

.sandbox-header {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 20px;
}

.gateway-icon-wrap {
  width: 46px;
  height: 46px;
  border-radius: 12px;
  background-color: color-mix(in srgb, var(--primary) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--primary) 25%, transparent);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.gateway-icon-wrap.zarinpal-icon {
  background-color: color-mix(in srgb, #f59e0b 12%, transparent);
  border-color: color-mix(in srgb, #f59e0b 30%, transparent);
}

.gateway-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--foreground);
  margin: 0 0 4px;
}

.sandbox-badge {
  font-size: 11.5px;
  background-color: color-mix(in srgb, var(--primary) 12%, transparent);
  color: var(--primary);
  padding: 2px 8px;
  border-radius: 6px;
  font-weight: 600;
  border: 1px solid color-mix(in srgb, var(--primary) 20%, transparent);
}

.sandbox-badge.zarinpal-badge {
  background-color: color-mix(in srgb, #f59e0b 12%, transparent);
  color: #d97706;
  border-color: color-mix(in srgb, #f59e0b 25%, transparent);
}

:global(.dark) .sandbox-badge.zarinpal-badge {
  color: #fbbf24;
}

.divider {
  height: 1px;
  background-color: var(--border);
  margin-bottom: 20px;
}

.info-rows {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 18px;
  background: var(--surface-alt);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 16px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
}

.info-label {
  color: var(--muted-foreground);
}

.info-val {
  color: var(--foreground);
}

.info-val.price {
  color: #10b981;
  font-size: 15px;
  font-weight: 700;
}

.info-val.code {
  font-family: var(--font-mono, monospace);
  font-size: 11.5px;
  color: var(--muted-foreground);
  background: var(--card);
  padding: 2px 8px;
  border-radius: 6px;
  border: 1px solid var(--border);
}

.sandbox-notice {
  display: flex;
  align-items: center;
  gap: 10px;
  background-color: color-mix(in srgb, #f59e0b 8%, var(--surface-alt));
  border: 1px solid color-mix(in srgb, #f59e0b 20%, var(--border));
  padding: 10px 14px;
  border-radius: 12px;
  font-size: 12px;
  color: var(--muted-foreground);
  margin-bottom: 22px;
}

.sandbox-notice p {
  margin: 0;
  line-height: 1.5;
}

.action-buttons {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.success-btn {
  background-color: #10b981 !important;
  border-color: #10b981 !important;
  color: #ffffff !important;
}

.success-btn:hover {
  background-color: #059669 !important;
  border-color: #059669 !important;
}

.cancel-btn:hover {
  color: var(--destructive);
}
</style>
