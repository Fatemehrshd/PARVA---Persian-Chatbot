<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { CheckCircle2, XCircle, ArrowRight, RefreshCw, MessageSquare } from '@lucide/vue'
import { paymentService } from '../services/payment.service'
import { useAuthStore } from '../stores/auth'
import BaseButton from '../components/ui/BaseButton.vue'
import type { Payment } from '../types'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const isLoading = ref(true)
const payment = ref<Payment | null>(null)
const authority = computed(() => String(route.query.authority || route.query.Authority || ''))
const queryStatus = computed(() => String(route.query.status || route.query.Status || ''))

const isSuccess = computed(() => {
  if (payment.value) {
    return payment.value.status === 'SUCCESS'
  }
  return queryStatus.value.toUpperCase() === 'OK'
})

onMounted(async () => {
  if (authority.value) {
    try {
      try {
        payment.value = await paymentService.getByAuthority(authority.value)
      } catch {
        // payment may not be fetched yet or error
      }

      // If payment is pending or not yet verified, and queryStatus is OK, verify it now
      const isPending = !payment.value || payment.value.status === 'PENDING'
      if (isPending && queryStatus.value.toUpperCase() === 'OK') {
        try {
          const verifyRes = await paymentService.verify({
            authority: authority.value,
            status: 'OK',
          })
          if (verifyRes?.payment) {
            payment.value = verifyRes.payment
          } else {
            payment.value = await paymentService.getByAuthority(authority.value)
          }
        } catch (err) {
          console.error('Payment auto-verification failed:', err)
        }
      }

      if (payment.value?.status === 'SUCCESS') {
        authStore.refreshQuota().catch(() => {})
        authStore.refreshIdentity().catch(() => {})
      }
    } finally {
      isLoading.value = false
    }
  } else {
    isLoading.value = false
  }
})
</script>

<template>
  <div class="result-page" dir="rtl">
    <div class="result-card">
      <!-- Loading State -->
      <template v-if="isLoading">
        <div class="icon-wrap loading">
          <RefreshCw :size="40" class="animate-spin text-primary" />
        </div>
        <h2 class="result-title">در حال استعلام وضعیت پرداخت...</h2>
        <p class="result-desc">لطفاً چند لحظه شکیبا باشید، در حال تایید تراکنش با درگاه بانکی هستیم.</p>
      </template>

      <!-- Success State -->
      <template v-else-if="isSuccess">
        <div class="icon-wrap success">
          <CheckCircle2 :size="48" class="text-emerald-500" />
        </div>
        <h2 class="result-title">پرداخت با موفقیت انجام شد</h2>
        <p class="result-desc">اشتراک شما با موفقیت فعال شد و دسترسی به امکانات جدید برقرار گردید.</p>

        <div v-if="payment" class="receipt-box">
          <div class="receipt-row">
            <span class="label">طرح خریداری‌شده:</span>
            <span class="val font-bold">{{ payment.plan?.name || 'پلن اشتراک' }}</span>
          </div>
          <div class="receipt-row">
            <span class="label">مبلغ پرداختی:</span>
            <span class="val">{{ Number(payment.amount).toLocaleString('fa-IR') }} ریال</span>
          </div>
          <div v-if="payment.refId" class="receipt-row">
            <span class="label">شماره پیگیری:</span>
            <span class="val font-mono text-xs" dir="ltr">{{ payment.refId }}</span>
          </div>
        </div>

        <BaseButton variant="primary" class="w-full justify-center mt-6" @click="router.push('/')">
          <MessageSquare :size="16" />
          <span>بازگشت به گفتگوها و شروع چت</span>
        </BaseButton>
      </template>

      <!-- Failure State -->
      <template v-else>
        <div class="icon-wrap failure">
          <XCircle :size="48" class="text-rose-500" />
        </div>
        <h2 class="result-title">تراکنش ناموفق بود</h2>
        <p class="result-desc">پرداخت انجام نشد یا توسط کاربر لغو گردید. در صورت کسر وجه، تا ساعاتی دیگر به حسابتان بازمی‌گردد.</p>

        <div class="action-grid mt-6">
          <BaseButton variant="primary" class="w-full justify-center" @click="router.push('/subscription')">
            <RefreshCw :size="16" />
            <span>تلاش مجدد</span>
          </BaseButton>

          <BaseButton variant="secondary" class="w-full justify-center" @click="router.push('/')">
            <ArrowRight :size="16" />
            <span>بازگشت به خانه</span>
          </BaseButton>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.result-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--background);
  color: var(--foreground);
  padding: 20px;
}

.result-card {
  width: 100%;
  max-width: 440px;
  background-color: var(--card);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 36px 28px;
  text-align: center;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.08);
}

.icon-wrap {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20px;
}

.icon-wrap.loading {
  background-color: rgba(99, 102, 241, 0.1);
}

.icon-wrap.success {
  background-color: rgba(16, 185, 129, 0.1);
}

.icon-wrap.failure {
  background-color: rgba(239, 68, 68, 0.1);
}

.result-title {
  font-size: 20px;
  font-weight: 800;
  margin: 0 0 8px;
}

.result-desc {
  font-size: 13.5px;
  color: var(--muted-foreground);
  line-height: 1.6;
  margin: 0 0 20px;
}

.receipt-box {
  background-color: var(--accent);
  border-radius: 12px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 12px;
  text-align: right;
  font-size: 13px;
}

.receipt-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.receipt-row .label {
  color: var(--muted-foreground);
}

.action-grid {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
</style>
