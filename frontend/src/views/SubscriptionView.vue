<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import {
  Check,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Zap,
  Globe,
  Brain,
  FileText,
  Loader2,
} from '@lucide/vue'
import { subscriptionService } from '../services/subscription.service'
import { paymentService } from '../services/payment.service'
import { useAuthStore } from '../stores/auth'
import { useUiStore } from '../stores/ui'
import BaseButton from '../components/ui/BaseButton.vue'
import CheckoutModal from '../components/subscription/CheckoutModal.vue'
import type { SubscriptionPlan, Subscription, UserEntitlements } from '../types'

let router: any = null
try {
  router = useRouter()
} catch {
  router = null
}
const authStore = useAuthStore()
const uiStore = useUiStore()

const isLoading = ref(true)
const isCheckingOut = ref<string | null>(null)
const plans = ref<SubscriptionPlan[]>([])
const activeSubscription = ref<Subscription | null>(null)
const entitlements = ref<UserEntitlements | null>(null)
const isCheckoutModalOpen = ref(false)
const selectedPlanForCheckout = ref<SubscriptionPlan | null>(null)

async function loadData() {
  isLoading.value = true
  try {
    const [fetchedPlans, subData] = await Promise.all([
      subscriptionService.getPublicPlans(),
      authStore.isAuthenticated
        ? subscriptionService.getCurrentSubscription().catch(() => null)
        : Promise.resolve(null),
    ])

    plans.value = fetchedPlans || []
    if (subData) {
      activeSubscription.value = subData.activeSubscription
      entitlements.value = subData.entitlements
    }

    if (activeSubscription.value && activeSubscription.value.status === 'ACTIVE') {
      const currentPlan =
        (fetchedPlans || []).find((p: any) => p.id === activeSubscription.value?.planId) ||
        activeSubscription.value.plan
      if (currentPlan && !currentPlan.isDefault && Number(currentPlan.price) > 0 && !entitlements.value?.isAdmin) {
        uiStore.showToast('شما دارای اشتراک فعال هستید و امکان تغییر یا خرید مجدد اشتراک وجود ندارد.', 'info')
        router?.push?.('/')
        return
      }
    }
  } catch (err: any) {
    uiStore.showToast(err.message || 'خطا در بارگذاری اطلاعات پلن‌ها', 'error')
  } finally {
    isLoading.value = false
  }
}

onMounted(loadData)

const hasActivePurchasedPlan = computed(() => {
  if (entitlements.value?.isAdmin) return false
  if (!activeSubscription.value || activeSubscription.value.status !== 'ACTIVE') return false
  const currentPlan =
    plans.value.find((p) => p.id === activeSubscription.value?.planId) || activeSubscription.value.plan
  if (!currentPlan) return false
  return !currentPlan.isDefault && Number(currentPlan.price) > 0
})

const activePurchasedPlanName = computed(() => {
  if (!hasActivePurchasedPlan.value || !activeSubscription.value) return ''
  const currentPlan =
    plans.value.find((p) => p.id === activeSubscription.value?.planId) || activeSubscription.value?.plan
  return currentPlan?.name || 'اشتراک ویژه'
})

function isCurrentPlan(plan: SubscriptionPlan): boolean {
  if (entitlements.value?.isAdmin) return false
  if (activeSubscription.value) {
    return activeSubscription.value.planId === plan.id
  }
  return plan.isDefault
}

function handleSelectPlan(plan: SubscriptionPlan) {
  if (!authStore.isAuthenticated) {
    router?.push?.({ path: '/login', query: { redirect: '/subscription' } })
    return
  }

  if (hasActivePurchasedPlan.value) {
    uiStore.showToast('شما در حال حاضر دارای اشتراک فعال هستید و امکان تغییر اشتراک وجود ندارد.', 'warning')
    return
  }

  if (Number(plan.price) === 0) {
    executeCheckout({ planId: plan.id, gateway: 'free' })
  } else {
    selectedPlanForCheckout.value = plan
    isCheckoutModalOpen.value = true
  }
}

async function executeCheckout(payload: { planId: string; gateway: string; couponCode?: string }) {
  isCheckingOut.value = payload.planId
  try {
    const res = await paymentService.checkout({
      planId: payload.planId,
      gateway: payload.gateway,
      couponCode: payload.couponCode,
      callbackUrl: `${window.location.origin}/payment-result`,
    })

    if (res.status === 'SUCCESS') {
      uiStore.showToast(res.message || 'پلن با موفقیت فعال شد.', 'success')
      isCheckoutModalOpen.value = false
      await loadData()
      await authStore.refreshQuota()
    } else if (res.paymentUrl) {
      if (res.paymentUrl.startsWith('http')) {
        window.location.href = res.paymentUrl
      } else {
        router?.push?.(res.paymentUrl)
      }
    }
  } catch (err: any) {
    uiStore.showToast(err.message || 'خطا در ایجاد سفارش پرداخت', 'error')
  } finally {
    isCheckingOut.value = null
  }
}
</script>

<template>
  <div class="subscription-page" dir="rtl">
    <!-- Header -->
    <header class="page-header">
      <button class="back-btn" @click="router.push('/')" title="بازگشت به گفتگوها">
        <ArrowRight :size="18" />
        <span>بازگشت به چت</span>
      </button>

      <div class="header-titles">
        <div class="title-badge">
          <Sparkles :size="15" class="text-primary" />
          <span>اشتراک و ارتقای حساب</span>
        </div>
        <h1 class="page-title">طرح متناسب با نیاز خود را انتخاب کنید</h1>
        <p class="page-subtitle">
          دسترسی به قدرتمندترین مدل‌های هوش مصنوعی، ظرفیت توکن اختصاصی و ابزارهای جستجو و پردازش
        </p>
      </div>
    </header>

    <!-- Loading -->
    <div v-if="isLoading" class="loading-wrap">
      <Loader2 :size="32" class="animate-spin text-primary" />
      <p>در حال بارگذاری طرح‌های اشتراک...</p>
    </div>

    <!-- Plans Grid -->
    <div v-else class="plans-container">
      <div v-if="entitlements?.isAdmin" class="admin-notice">
        <ShieldCheck :size="20" class="text-amber-500" />
        <div>
          <strong>شما با نقش مدیر (Admin) وارد شده‌اید.</strong>
          <p>تمام مدل‌ها، قابلیت‌های جستجو، تفکر عمیق و مصرف نامحدود توکن برای شما فعال است.</p>
        </div>
      </div>

      <div v-else-if="entitlements?.subscriptionExpired" class="active-subscription-notice">
        <ShieldCheck :size="20" class="text-amber-500" />
        <div>
          <strong>اشتراک «{{ entitlements.expiredPlanName || 'ویژه' }}» شما به پایان رسیده است.</strong>
          <p>حساب شما به طرح رایگان برگشته است. امکانات اشتراک قبلی تا زمان خرید مجدد در دسترس نیست.</p>
        </div>
      </div>

      <div v-else-if="hasActivePurchasedPlan" class="active-subscription-notice">
        <ShieldCheck :size="20" class="text-emerald-500" />
        <div>
          <strong>شما دارای اشتراک فعال «{{ activePurchasedPlanName }}» هستید.</strong>
          <p>امکان تغییر یا خرید مجدد اشتراک وجود ندارد مگر اینکه اشتراک فعلی توسط مدیر سیستم لغو شود.</p>
        </div>
      </div>

      <div class="plans-grid">
        <div
          v-for="plan in plans"
          :key="plan.id"
          class="plan-card"
          :class="{
            'is-current': isCurrentPlan(plan),
            'is-featured': !plan.isDefault && Number(plan.price) > 0,
          }"
        >
          <!-- Current Plan Badge -->
          <div v-if="isCurrentPlan(plan)" class="current-badge">
            <Check :size="13" />
            <span>طرح فعال شما</span>
          </div>

          <!-- Card Header -->
          <div class="plan-head">
            <h3 class="plan-name">{{ plan.name }}</h3>
            <p class="plan-desc">{{ plan.description || 'دسترسی مناسب به سرویس‌های هوش مصنوعی' }}</p>
            <div class="plan-price-wrap">
              <template v-if="Number(plan.price) === 0">
                <span class="price-val">رایگان</span>
              </template>
              <template v-else>
                <span class="price-val">{{ Number(plan.price).toLocaleString('fa-IR') }}</span>
                <span class="price-unit">ریال / {{ plan.durationDays }} روزه</span>
              </template>
            </div>
          </div>

          <div class="divider"></div>

          <!-- Features List -->
          <ul class="features-list">
            <li class="feature-item">
              <Zap :size="16" class="feature-icon text-primary" />
              <span>
                <strong>سقف توکن:</strong>
                {{ plan.tokenQuota > 0 ? `${Number(plan.tokenQuota).toLocaleString('fa-IR')} توکن در هر دوره` : 'ارث‌بری از سقف پایه' }}
              </span>
            </li>

            <li v-if="plan.messageQuota" class="feature-item">
              <Check :size="16" class="feature-icon text-emerald-500" />
              <span>حداکثر {{ Number(plan.messageQuota).toLocaleString('fa-IR') }} پیام در هر دوره</span>
            </li>

            <li class="feature-item">
              <Globe :size="16" :class="plan.features?.webSearch ? 'text-primary' : 'text-muted-foreground opacity-40'" />
              <span :class="{ 'text-muted-foreground line-through opacity-60': !plan.features?.webSearch }">
                جستجوی وب و اطلاعات زنده
              </span>
            </li>

            <li class="feature-item">
              <Brain :size="16" :class="plan.features?.thinking ? 'text-primary' : 'text-muted-foreground opacity-40'" />
              <span :class="{ 'text-muted-foreground line-through opacity-60': !plan.features?.thinking }">
                قابلیت تفکر عمیق (Reasoning / Thinking)
              </span>
            </li>

            <li class="feature-item">
              <FileText :size="16" :class="plan.features?.document ? 'text-primary' : 'text-muted-foreground opacity-40'" />
              <span :class="{ 'text-muted-foreground line-through opacity-60': !plan.features?.document }">
                تحلیل اسناد و فایل‌های ضمیمه
              </span>
            </li>
          </ul>

          <!-- CTA Action Button -->
          <div class="plan-action">
            <BaseButton
              v-if="isCurrentPlan(plan)"
              variant="secondary"
              class="w-full justify-center"
              disabled
            >
              طرح کنونی شما
            </BaseButton>

            <BaseButton
              v-else-if="hasActivePurchasedPlan"
              variant="secondary"
              class="w-full justify-center opacity-50 cursor-not-allowed"
              disabled
            >
              غیرقابل تغییر
            </BaseButton>

            <BaseButton
              v-else
              :variant="Number(plan.price) > 0 ? 'primary' : 'secondary'"
              class="w-full justify-center"
              :is-loading="isCheckingOut === plan.id"
              @click="handleSelectPlan(plan)"
            >
              <template v-if="Number(plan.price) === 0">فعال‌سازی طرح رایگان</template>
              <template v-else>ارتقا به {{ plan.name }}</template>
            </BaseButton>
          </div>
        </div>
      </div>
    </div>

    <!-- Checkout & Coupon Modal -->
    <CheckoutModal
      :open="isCheckoutModalOpen"
      :plan="selectedPlanForCheckout"
      :is-checking-out="isCheckingOut === selectedPlanForCheckout?.id"
      @close="isCheckoutModalOpen = false"
      @checkout="executeCheckout"
    />
  </div>
</template>

<style scoped>
.subscription-page {
  min-height: 100vh;
  background-color: var(--background);
  color: var(--foreground);
  padding: 32px 24px 64px;
  font-family: inherit;
}

.page-header {
  max-width: 1000px;
  margin: 0 auto 40px;
}

.back-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: none;
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 8px 14px;
  color: var(--foreground);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s ease;
  margin-bottom: 24px;
}

.back-btn:hover {
  background-color: var(--accent);
}

.header-titles {
  text-align: center;
}

.title-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  background-color: var(--card);
  border: 1px solid var(--border);
  border-radius: 20px;
  font-size: 13px;
  margin-bottom: 14px;
}

.page-title {
  font-size: 28px;
  font-weight: 800;
  margin: 0 0 10px;
  letter-spacing: -0.5px;
}

.page-subtitle {
  font-size: 15px;
  color: var(--muted-foreground);
  max-width: 600px;
  margin: 0 auto;
  line-height: 1.6;
}

.loading-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  gap: 16px;
  color: var(--muted-foreground);
}

.plans-container {
  max-width: 1060px;
  margin: 0 auto;
}

.admin-notice {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 18px;
  background-color: rgba(245, 158, 11, 0.08);
  border: 1px solid rgba(245, 158, 11, 0.25);
  border-radius: 12px;
  margin-bottom: 30px;
  font-size: 14px;
}

.admin-notice strong {
  display: block;
  margin-bottom: 2px;
}

.admin-notice p {
  margin: 0;
  color: var(--muted-foreground);
  font-size: 13px;
}

.active-subscription-notice {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 18px;
  background-color: rgba(16, 185, 129, 0.08);
  border: 1px solid rgba(16, 185, 129, 0.25);
  border-radius: 12px;
  margin-bottom: 30px;
  font-size: 14px;
}

.active-subscription-notice strong {
  display: block;
  margin-bottom: 2px;
  color: #10b981;
}

.active-subscription-notice p {
  margin: 0;
  color: var(--muted-foreground);
  font-size: 13px;
}

.plans-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 24px;
  align-items: stretch;
}

.plan-card {
  position: relative;
  display: flex;
  flex-direction: column;
  background-color: var(--card);
  border: 1px solid var(--border);
  border-radius: 18px;
  padding: 28px 24px;
  transition: all 0.2s ease;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.03);
}

.plan-card:hover {
  border-color: rgba(99, 102, 241, 0.4);
  transform: translateY(-2px);
}

.plan-card.is-featured {
  border-color: rgba(99, 102, 241, 0.5);
  box-shadow: 0 8px 30px rgba(99, 102, 241, 0.08);
}

.plan-card.is-current {
  border-color: rgba(16, 185, 129, 0.5);
  background-color: rgba(16, 185, 129, 0.02);
}

.current-badge {
  position: absolute;
  top: -12px;
  inset-inline-start: 24px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background-color: #10b981;
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 12px;
  box-shadow: 0 2px 6px rgba(16, 185, 129, 0.3);
}

.plan-head {
  margin-bottom: 18px;
}

.plan-name {
  font-size: 20px;
  font-weight: 700;
  margin: 0 0 6px;
}

.plan-desc {
  font-size: 13px;
  color: var(--muted-foreground);
  margin: 0 0 16px;
  min-height: 38px;
  line-height: 1.5;
}

.plan-price-wrap {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.price-val {
  font-size: 32px;
  font-weight: 800;
  letter-spacing: -0.5px;
}

.price-unit {
  font-size: 13px;
  color: var(--muted-foreground);
}

.divider {
  height: 1px;
  background-color: var(--border);
  margin: 0 0 20px;
}

.features-list {
  list-style: none;
  padding: 0;
  margin: 0 0 24px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex: 1;
}

.feature-item {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13.5px;
  line-height: 1.4;
}

.feature-icon {
  flex-shrink: 0;
}

.plan-action {
  margin-top: auto;
}
</style>
