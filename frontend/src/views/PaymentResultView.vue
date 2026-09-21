<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  CheckCircle2,
  XCircle,
  ArrowRight,
  RefreshCw,
  MessageSquare,
  Copy,
  Check,
  ShieldCheck,
  Sparkles,
  Sun,
  Moon,
  Receipt,
  CreditCard,
  Clock,
} from '@lucide/vue'
import { paymentService } from '../services/payment.service'
import { useAuthStore } from '../stores/auth'
import { useUiStore } from '../stores/ui'
import { useThemeLogo } from '../composables/useThemeLogo'
import BaseButton from '../components/ui/BaseButton.vue'
import type { Payment } from '../types'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const uiStore = useUiStore()
const { activeLogo } = useThemeLogo()

const isLoading = ref(true)
const payment = ref<Payment | null>(null)
const authority = computed(() => String(route.query.authority || route.query.Authority || ''))
const queryStatus = computed(() => String(route.query.status || route.query.Status || ''))

const copiedRefId = ref(false)

const isSuccess = computed(() => {
  if (payment.value) {
    return payment.value.status === 'SUCCESS'
  }
  return queryStatus.value.toUpperCase() === 'OK'
})

const isCancelled = computed(() => {
  if (payment.value) {
    return payment.value.status === 'CANCELLED'
  }
  return queryStatus.value.toUpperCase() === 'NOK'
})

function formatCurrentDate(dateStr?: string | Date): string {
  try {
    const d = dateStr ? new Date(dateStr) : new Date()
    return d.toLocaleString('fa-IR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

async function copyRefId(text?: string | null) {
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
    copiedRefId.value = true
    uiStore.showToast('شماره پیگیری با موفقیت کپی شد', 'success')
    setTimeout(() => {
      copiedRefId.value = false
    }, 2500)
  } catch {
    uiStore.showToast('خطا در کپی شماره پیگیری', 'error')
  }
}

onMounted(async () => {
  if (authority.value) {
    try {
      try {
        payment.value = await paymentService.getByAuthority(authority.value)
      } catch {
        // payment may not be fetched yet or error
      }

      // If payment is pending or not yet verified
      const isPending = !payment.value || payment.value.status === 'PENDING'
      if (isPending) {
        const isOk = queryStatus.value.toUpperCase() === 'OK'
        try {
          const verifyRes = await paymentService.verify({
            authority: authority.value,
            status: isOk ? 'OK' : 'NOK',
            payload: isOk ? undefined : { cancel: true, status: 'NOK' },
          })
          if (verifyRes?.payment) {
            payment.value = verifyRes.payment
          } else {
            payment.value = await paymentService.getByAuthority(authority.value)
          }
        } catch (err) {
          console.error('Payment auto-verification/cancellation handling failed:', err)
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
    <!-- Ambient Background Lighting -->
    <div class="ambient-glow" aria-hidden="true"></div>

    <!-- Top Navigation / Brand Header -->
    <header class="result-top-bar">
      <div class="brand-link" @click="router.push('/')">
        <div class="brand-logo-wrap">
          <img :src="activeLogo" alt="پروا" class="brand-logo" />
        </div>
        <span class="brand-title">پروا</span>
      </div>

      <!-- Theme Switcher Button -->
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

    <!-- Main Content Container -->
    <main class="result-container">
      <div class="result-card">
        <!-- Loading State -->
        <template v-if="isLoading">
          <div class="icon-wrap loading">
            <RefreshCw :size="36" class="animate-spin text-primary" />
          </div>
          <h1 class="result-title">در حال استعلام وضعیت پرداخت...</h1>
          <p class="result-desc">لطفاً چند لحظه شکیبا باشید، در حال تایید تراکنش با درگاه پرداخت بانکی هستیم.</p>

          <div class="loading-placeholder-box">
            <div class="placeholder-line w-3/4"></div>
            <div class="placeholder-line w-1/2"></div>
          </div>
        </template>

        <!-- Success State -->
        <template v-else-if="isSuccess">
          <div class="icon-wrap success">
            <CheckCircle2 :size="42" class="success-icon" />
          </div>

          <div class="status-badge-pill success-pill">
            <ShieldCheck :size="13" />
            <span>پرداخت معتبر شاپرک / زرین‌پال</span>
          </div>

          <h1 class="result-title">پرداخت با موفقیت انجام شد</h1>
          <p class="result-desc">اشتراک شما با موفقیت فعال شد و تمامی دسترسی‌ها و سقف توکن‌های مدل‌ها به حساب کاربری شما افزوده گردید.</p>

          <!-- Modern Receipt Invoice Box -->
          <div class="receipt-box">
            <div class="receipt-header">
              <div class="flex items-center gap-1.5 text-xs font-bold text-foreground">
                <Receipt :size="14" class="text-primary" />
                <span>رسید پرداخت الکترونیکی</span>
              </div>
              <span class="text-[11px] text-muted-foreground font-mono" dir="ltr">{{ formatCurrentDate(payment?.createdAt) }}</span>
            </div>

            <div class="receipt-divider"></div>

            <div class="receipt-rows">
              <!-- Plan -->
              <div class="receipt-row">
                <span class="label flex items-center gap-1.5">
                  <Sparkles :size="13" class="text-primary" />
                  <span>طرح فعال‌شده:</span>
                </span>
                <span class="val font-bold text-foreground">
                  {{ payment?.plan?.name || 'پلن اشتراک انتخابی' }}
                </span>
              </div>

              <!-- Amount -->
              <div class="receipt-row">
                <span class="label flex items-center gap-1.5">
                  <CreditCard :size="13" class="text-muted-foreground" />
                  <span>مبلغ پرداختی:</span>
                </span>
                <div class="val text-left">
                  <strong class="font-bold text-base text-foreground font-mono">
                    {{ payment?.amount ? Math.floor(Number(payment.amount) / 10).toLocaleString('fa-IR') : '۰' }}
                  </strong>
                  <span class="text-xs text-muted-foreground mr-1">تومان</span>
                  <span v-if="payment?.amount" class="text-[10px] text-muted-foreground/80 block font-mono">
                    ({{ Number(payment.amount).toLocaleString('fa-IR') }} ریال)
                  </span>
                </div>
              </div>

              <!-- RefId / Tracking Code -->
              <div v-if="payment?.refId" class="receipt-row">
                <span class="label flex items-center gap-1.5">
                  <Clock :size="13" class="text-muted-foreground" />
                  <span>شماره پیگیری بانکی:</span>
                </span>
                <div class="flex items-center gap-1.5">
                  <span class="val font-mono text-xs text-foreground select-all bg-card/80 px-2 py-0.5 rounded border border-border" dir="ltr">
                    {{ payment.refId }}
                  </span>
                  <button
                    type="button"
                    class="copy-btn"
                    title="کپی شماره پیگیری"
                    @click="copyRefId(payment.refId)"
                  >
                    <Check v-if="copiedRefId" :size="12" class="text-emerald-500" />
                    <Copy v-else :size="12" />
                  </button>
                </div>
              </div>

              <!-- Gateway -->
              <div class="receipt-row">
                <span class="label">درگاه پرداخت:</span>
                <span class="val text-xs text-muted-foreground">
                  زرین‌پال (پرداخت امن شاپرک)
                </span>
              </div>

              <!-- Authority Reference (if no refId or supplementary) -->
              <div v-if="authority" class="receipt-row pt-1 border-t border-border/40 text-[11px]">
                <span class="label">شناسه مرجع (Authority):</span>
                <span class="val font-mono text-[10px] text-muted-foreground truncate max-w-[170px]" dir="ltr">
                  {{ authority }}
                </span>
              </div>
            </div>
          </div>

          <!-- Actions -->
          <div class="action-grid mt-6">
            <BaseButton variant="primary" size="md" class="w-full justify-center" @click="router.push('/')">
              <MessageSquare :size="16" />
              <span>بازگشت به گفتگوها و شروع چت</span>
            </BaseButton>

            <BaseButton variant="secondary" size="md" class="w-full justify-center" @click="router.push('/subscription')">
              <Sparkles :size="15" />
              <span>مشاهده وضعیت اشتراک من</span>
            </BaseButton>
          </div>
        </template>

        <!-- Failure State -->
        <template v-else>
          <div class="icon-wrap failure">
            <XCircle :size="42" class="failure-icon" />
          </div>

          <div class="status-badge-pill failure-pill">
            <span>{{ isCancelled ? 'تراکنش لغو گردید' : 'تراکنش تکمیل نشد' }}</span>
          </div>

          <h1 class="result-title">
            {{ isCancelled ? 'پرداخت توسط کاربر لغو شد' : 'تراکنش ناموفق بود' }}
          </h1>
          <p class="result-desc">
            <span v-if="isCancelled">
              شما از انجام پرداخت در درگاه بانکی انصراف دادید و تراکنش لغو گردید. هیچ مبلغی از حساب شما کسر نشده است.
            </span>
            <span v-else>
              پرداخت در درگاه بانکی انجام نشد یا با خطا مواجه گردید. در صورت کسر هرگونه وجه، مبلغ حداکثر تا ۷۲ ساعت آینده توسط شبکه بانکی به حسابتان بازخواهد گشت.
            </span>
          </p>

          <!-- Failure Info Box -->
          <div v-if="authority" class="receipt-box failure-box">
            <div class="receipt-row">
              <span class="label">شناسه مرجع سفارش:</span>
              <span class="val font-mono text-xs text-foreground" dir="ltr">{{ authority }}</span>
            </div>
            <div class="receipt-row">
              <span class="label">وضعیت ثبت‌شده:</span>
              <span class="val text-xs font-semibold text-rose-500">
                {{ isCancelled ? 'لغو شده (انصراف کاربر)' : 'خطا در اتصال یا رد توسط بانک' }}
              </span>
            </div>
          </div>

          <div class="action-grid mt-6">
            <BaseButton variant="primary" size="md" class="w-full justify-center" @click="router.push('/subscription')">
              <RefreshCw :size="16" />
              <span>تلاش مجدد برای خرید اشتراک</span>
            </BaseButton>

            <BaseButton variant="secondary" size="md" class="w-full justify-center" @click="router.push('/')">
              <ArrowRight :size="16" />
              <span>بازگشت به صفحه اصلی</span>
            </BaseButton>
          </div>
        </template>
      </div>

      <!-- Footer Info -->
      <footer class="result-footer">
        <div class="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck :size="14" class="text-primary/70" />
          <span>پلتفرم هوش مصنوعی پروا — تضمین امنیت پرداخت و تراکنش‌ها</span>
        </div>
      </footer>
    </main>
  </div>
</template>

<style scoped>
.result-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: var(--background);
  color: var(--foreground);
  position: relative;
  overflow-x: hidden;
  transition: background-color 0.25s ease, color 0.25s ease;
}

/* Ambient Radial Glow */
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
    color-mix(in srgb, var(--primary) 3%, transparent) 45%,
    transparent 70%
  );
  pointer-events: none;
  z-index: 0;
}

/* Top Bar */
.result-top-bar {
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
  transition: opacity 0.15s ease;
}

.brand-link:hover {
  opacity: 0.85;
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
  letter-spacing: -0.02em;
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
  transition: all 0.15s ease;
  box-shadow: var(--shadow-sm);
}

.theme-toggle-btn:hover {
  background: var(--secondary);
  border-color: var(--primary);
}

/* Main Container */
.result-container {
  position: relative;
  z-index: 10;
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
  max-width: 480px;
  width: 100%;
  margin: 0 auto;
}

/* Result Card */
.result-card {
  width: 100%;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 24px;
  padding: 36px 30px;
  text-align: center;
  box-shadow: 0 12px 36px rgba(0, 0, 0, 0.06), 0 1px 3px rgba(0, 0, 0, 0.04);
  backdrop-filter: blur(12px);
  transition: all 0.25s ease;
}

/* Icon Wrappers */
.icon-wrap {
  width: 82px;
  height: 82px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 14px;
  transition: transform 0.3s ease;
}

.icon-wrap.loading {
  background: color-mix(in srgb, var(--primary) 12%, transparent);
  border: 2px solid color-mix(in srgb, var(--primary) 25%, transparent);
}

.icon-wrap.success {
  background: color-mix(in srgb, #10b981 12%, transparent);
  border: 2px solid color-mix(in srgb, #10b981 30%, transparent);
  box-shadow: 0 0 24px color-mix(in srgb, #10b981 18%, transparent);
}

.success-icon {
  color: #10b981;
}

.icon-wrap.failure {
  background: color-mix(in srgb, #ef4444 12%, transparent);
  border: 2px solid color-mix(in srgb, #ef4444 30%, transparent);
  box-shadow: 0 0 24px color-mix(in srgb, #ef4444 18%, transparent);
}

.failure-icon {
  color: #ef4444;
}

/* Status Badges */
.status-badge-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  border-radius: 9999px;
  font-size: 11.5px;
  font-weight: 600;
  margin-bottom: 12px;
}

.success-pill {
  background: color-mix(in srgb, #10b981 12%, transparent);
  color: #059669;
  border: 1px solid color-mix(in srgb, #10b981 25%, transparent);
}

:global(.dark) .success-pill {
  color: #34d399;
}

.failure-pill {
  background: color-mix(in srgb, #ef4444 12%, transparent);
  color: #dc2626;
  border: 1px solid color-mix(in srgb, #ef4444 25%, transparent);
}

:global(.dark) .failure-pill {
  color: #f87171;
}

.result-title {
  font-size: 21px;
  font-weight: 800;
  color: var(--foreground);
  margin: 0 0 8px;
  letter-spacing: -0.02em;
}

.result-desc {
  font-size: 13px;
  color: var(--muted-foreground);
  line-height: 1.65;
  margin: 0 0 22px;
}

/* Invoice Receipt Card */
.receipt-box {
  background: var(--surface-alt);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 16px 18px;
  margin-bottom: 16px;
  text-align: right;
  font-size: 13px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.02);
  transition: background-color 0.2s;
}

.receipt-box.failure-box {
  background: color-mix(in srgb, var(--destructive) 6%, var(--surface-alt));
  border-color: color-mix(in srgb, var(--destructive) 20%, var(--border));
}

.receipt-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.receipt-divider {
  height: 1px;
  background: var(--border);
  margin-bottom: 12px;
  border-bottom: 1px dashed var(--border);
}

.receipt-rows {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.receipt-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
}

.receipt-row .label {
  color: var(--muted-foreground);
  font-size: 12.5px;
}

.receipt-row .val {
  color: var(--foreground);
}

.copy-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 3px;
  border-radius: 6px;
  background: var(--card);
  border: 1px solid var(--border);
  color: var(--muted-foreground);
  cursor: pointer;
  transition: all 0.15s ease;
}

.copy-btn:hover {
  color: var(--foreground);
  border-color: var(--primary);
}

.loading-placeholder-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 24px 0;
}

.placeholder-line {
  height: 10px;
  border-radius: 6px;
  background: var(--border);
  animation: pulse 1.8s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.85; }
}

.action-grid {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.result-footer {
  margin-top: 18px;
  text-align: center;
}
</style>
