<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ShieldCheck, CheckCircle2, XCircle, CreditCard } from '@lucide/vue'
import { paymentService } from '../services/payment.service'
import { useUiStore } from '../stores/ui'
import BaseButton from '../components/ui/BaseButton.vue'

const route = useRoute()
const router = useRouter()
const uiStore = useUiStore()

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
          <span class="info-val">پلتفرم هوش مصنوعی پروا</span>
        </div>
        <div class="info-row">
          <span class="info-label">درگاه پرداخت:</span>
          <span class="info-val">{{ isZarinpal ? 'زرین‌پال (آزمایشی)' : 'شبیه‌ساز داخلی' }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">مبلغ قابل پرداخت:</span>
          <span class="info-val price">{{ amount.toLocaleString('fa-IR') }} ریال</span>
        </div>
        <div class="info-row">
          <span class="info-label">کد ارجاع سفارش:</span>
          <span class="info-val code" dir="ltr">{{ authority }}</span>
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
  </div>
</template>

<style scoped>
.sandbox-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--background);
  color: var(--foreground);
  padding: 20px;
}

.sandbox-card {
  width: 100%;
  max-width: 440px;
  background-color: var(--card);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 28px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.08);
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
  background-color: rgba(99, 102, 241, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.gateway-icon-wrap.zarinpal-icon {
  background-color: rgba(245, 158, 11, 0.15);
}

.gateway-title {
  font-size: 16px;
  font-weight: 700;
  margin: 0 0 4px;
}

.sandbox-badge {
  font-size: 11.5px;
  background-color: rgba(99, 102, 241, 0.12);
  color: #6366f1;
  padding: 2px 8px;
  border-radius: 6px;
  font-weight: 600;
}

.sandbox-badge.zarinpal-badge {
  background-color: rgba(245, 158, 11, 0.15);
  color: #d97706;
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
  margin-bottom: 20px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13.5px;
}

.info-label {
  color: var(--muted-foreground);
}

.info-val {
  font-weight: 600;
}

.info-val.price {
  color: #10b981;
  font-size: 15px;
  font-weight: 700;
}

.info-val.code {
  font-family: monospace;
  font-size: 12px;
  color: var(--muted-foreground);
}

.sandbox-notice {
  display: flex;
  align-items: center;
  gap: 10px;
  background-color: var(--accent);
  padding: 10px 14px;
  border-radius: 10px;
  font-size: 12.5px;
  color: var(--muted-foreground);
  margin-bottom: 24px;
}

.sandbox-notice p {
  margin: 0;
}

.action-buttons {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.success-btn {
  background-color: #10b981 !important;
  border-color: #10b981 !important;
}

.success-btn:hover {
  background-color: #059669 !important;
}

.cancel-btn:hover {
  color: #ef4444;
}
</style>
