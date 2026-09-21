<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import {
  CreditCard,
  Tag,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Zap,
  X,
  Check,
} from '@lucide/vue'
import BaseButton from '../ui/BaseButton.vue'
import { paymentService } from '../../services/payment.service'
import type { SubscriptionPlan, ValidateCouponResponse } from '../../types'

const props = defineProps<{
  open: boolean
  plan: SubscriptionPlan | null
  isCheckingOut?: boolean
}>()

const emit = defineEmits<{
  close: []
  checkout: [payload: { planId: string; gateway: string; couponCode?: string }]
}>()

const couponCodeInput = ref('')
const isValidatingCoupon = ref(false)
const appliedCoupon = ref<ValidateCouponResponse | null>(null)
const couponError = ref('')
const selectedGateway = ref<'zarinpal' | 'sandbox'>('zarinpal')
const isSubmitting = ref(false)

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      couponCodeInput.value = ''
      appliedCoupon.value = null
      couponError.value = ''
      selectedGateway.value = 'zarinpal'
      isSubmitting.value = false
    }
  },
)

const originalPriceRials = computed(() => Number(props.plan?.price || 0))
const originalPriceTomans = computed(() => Math.floor(originalPriceRials.value / 10))

const discountAmountRials = computed(() => (appliedCoupon.value ? appliedCoupon.value.discountAmount : 0))
const discountAmountTomans = computed(() => Math.floor(discountAmountRials.value / 10))

const finalPriceRials = computed(() => Math.max(0, originalPriceRials.value - discountAmountRials.value))
const finalPriceTomans = computed(() => Math.floor(finalPriceRials.value / 10))

const isFree = computed(() => finalPriceRials.value === 0)

async function handleApplyCoupon() {
  if (!props.plan || !couponCodeInput.value.trim()) return

  isValidatingCoupon.value = true
  couponError.value = ''
  try {
    const res = await paymentService.validateCoupon({
      code: couponCodeInput.value.trim(),
      planId: props.plan.id,
    })
    appliedCoupon.value = res
  } catch (err: any) {
    appliedCoupon.value = null
    couponError.value = err.message || 'کد تخفیف نامعتبر است.'
  } finally {
    isValidatingCoupon.value = false
  }
}

function handleRemoveCoupon() {
  appliedCoupon.value = null
  couponCodeInput.value = ''
  couponError.value = ''
}

function handleConfirm() {
  if (!props.plan || props.isCheckingOut || isSubmitting.value) return
  isSubmitting.value = true
  setTimeout(() => {
    isSubmitting.value = false
  }, 3000)

  emit('checkout', {
    planId: props.plan.id,
    gateway: selectedGateway.value,
    couponCode: appliedCoupon.value?.code,
  })
}
</script>

<template>
  <div
    v-if="open && plan"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
    @click.self="emit('close')"
  >
    <div
      class="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col text-right animate-in fade-in zoom-in-95 duration-200"
      dir="rtl"
    >
      <!-- Modal Header -->
      <div class="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/20">
        <div class="flex items-center gap-2">
          <CreditCard :size="20" class="text-primary" />
          <h2 class="text-base font-bold text-foreground">تکمیل سفارش و درگاه پرداخت</h2>
        </div>
        <button
          class="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          @click="emit('close')"
        >
          <X :size="18" />
        </button>
      </div>

      <!-- Modal Body -->
      <div class="p-6 space-y-5 overflow-y-auto max-h-[80vh]">
        <!-- Plan Summary Banner -->
        <div class="p-4 rounded-xl border border-primary/20 bg-primary/5 flex items-center justify-between">
          <div>
            <div class="text-xs text-muted-foreground">طرح انتخابی شما:</div>
            <div class="text-base font-bold text-foreground mt-0.5">{{ plan.name }}</div>
            <div class="text-xs text-muted-foreground mt-0.5">مدت اعتبار: {{ plan.durationDays }} روز</div>
          </div>
          <div class="text-left">
            <div class="text-base font-bold font-mono text-primary">
              {{ originalPriceTomans.toLocaleString('fa-IR') }} <span class="text-xs font-sans">تومان</span>
            </div>
            <div class="text-[11px] text-muted-foreground font-mono">
              {{ originalPriceRials.toLocaleString('fa-IR') }} ریال
            </div>
          </div>
        </div>

        <!-- Discount Code Section -->
        <div class="space-y-2">
          <label class="block text-xs font-medium text-foreground flex items-center gap-1.5">
            <Tag :size="14" class="text-primary" />
            <span>کد تخفیف دارید؟</span>
          </label>

          <div v-if="!appliedCoupon" class="flex gap-2">
            <input
              v-model="couponCodeInput"
              type="text"
              dir="ltr"
              placeholder="مثلاً NOROOZ1403"
              class="flex-1 px-3 py-2 bg-background border border-border rounded-xl text-foreground text-sm font-mono uppercase focus:border-primary outline-none"
              :disabled="isValidatingCoupon || isCheckingOut"
              @keyup.enter="handleApplyCoupon"
            />
            <BaseButton
              variant="secondary"
              size="sm"
              class="px-4 shrink-0"
              :is-loading="isValidatingCoupon"
              :disabled="!couponCodeInput.trim() || isCheckingOut"
              @click="handleApplyCoupon"
            >
              اعمال کد
            </BaseButton>
          </div>

          <!-- Applied Coupon Banner -->
          <div
            v-else
            class="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 flex items-center justify-between"
          >
            <div class="flex items-center gap-2">
              <CheckCircle2 :size="16" class="text-emerald-500 shrink-0" />
              <div>
                <span class="text-xs font-bold font-mono text-emerald-400 uppercase tracking-wider">
                  {{ appliedCoupon.code }}
                </span>
                <span class="text-xs text-emerald-300 mr-2">
                  ({{ appliedCoupon.discountType === 'PERCENTAGE' ? `${Number(appliedCoupon.discountValue).toLocaleString('fa-IR')}٪ تخفیف` : 'تخفیف ثابت' }})
                </span>
              </div>
            </div>
            <button
              class="text-xs text-rose-400 hover:text-rose-300 font-medium px-2 py-1 rounded hover:bg-rose-500/10 transition-colors"
              :disabled="isCheckingOut"
              @click="handleRemoveCoupon"
            >
              حذف کد
            </button>
          </div>

          <!-- Coupon Error -->
          <div v-if="couponError" class="text-xs text-rose-400 flex items-center gap-1 mt-1">
            <AlertCircle :size="13" />
            <span>{{ couponError }}</span>
          </div>
        </div>

        <!-- Gateway Selector (Only visible if price > 0) -->
        <div v-if="!isFree" class="space-y-2.5 pt-2 border-t border-border">
          <label class="block text-xs font-medium text-foreground">
            انتخاب درگاه پرداخت:
          </label>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <!-- Zarinpal Sandbox Option -->
            <label
              class="relative flex flex-col p-3.5 rounded-xl border cursor-pointer transition-all select-none"
              :class="
                selectedGateway === 'zarinpal'
                  ? 'border-primary bg-primary/5 ring-1 ring-primary'
                  : 'border-border bg-card hover:bg-muted/40'
              "
            >
              <input
                type="radio"
                name="gateway"
                value="zarinpal"
                v-model="selectedGateway"
                class="sr-only"
              />
              <div class="flex items-center justify-between">
                <span class="font-bold text-xs text-foreground flex items-center gap-1.5">
                  <ShieldCheck :size="16" class="text-amber-500" />
                  درگاه زرین‌پال (سندباکس)
                </span>
                <div
                  class="w-4 h-4 rounded-full border flex items-center justify-center"
                  :class="selectedGateway === 'zarinpal' ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground'"
                >
                  <Check v-if="selectedGateway === 'zarinpal'" :size="10" />
                </div>
              </div>
              <p class="text-[11px] text-muted-foreground mt-1.5 leading-relaxed">
                سندباکس رسمی زرین‌پال ایران جهت تست فرآیند واقعی پرداخت و ریدایرکت
              </p>
            </label>

            <!-- Simulator Sandbox Option -->
            <label
              class="relative flex flex-col p-3.5 rounded-xl border cursor-pointer transition-all select-none"
              :class="
                selectedGateway === 'sandbox'
                  ? 'border-primary bg-primary/5 ring-1 ring-primary'
                  : 'border-border bg-card hover:bg-muted/40'
              "
            >
              <input
                type="radio"
                name="gateway"
                value="sandbox"
                v-model="selectedGateway"
                class="sr-only"
              />
              <div class="flex items-center justify-between">
                <span class="font-bold text-xs text-foreground flex items-center gap-1.5">
                  <Zap :size="16" class="text-primary" />
                  شبیه‌ساز پرداخت سریع
                </span>
                <div
                  class="w-4 h-4 rounded-full border flex items-center justify-center"
                  :class="selectedGateway === 'sandbox' ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground'"
                >
                  <Check v-if="selectedGateway === 'sandbox'" :size="10" />
                </div>
              </div>
              <p class="text-[11px] text-muted-foreground mt-1.5 leading-relaxed">
                شبیه‌ساز داخلی سیستم بدون نیاز به اینترنت جهت تست سریع و آنی
              </p>
            </label>
          </div>
        </div>

        <!-- Price Breakdown -->
        <div class="p-4 rounded-xl bg-muted/40 border border-border space-y-2 text-xs">
          <div class="flex justify-between text-muted-foreground">
            <span>مبلغ پایه پلن:</span>
            <span class="font-mono">{{ originalPriceTomans.toLocaleString('fa-IR') }} تومان</span>
          </div>

          <div v-if="discountAmountRials > 0" class="flex justify-between text-emerald-500 font-medium">
            <span>تخفیف اعمال‌شده:</span>
            <span class="font-mono">- {{ discountAmountTomans.toLocaleString('fa-IR') }} تومان</span>
          </div>

          <div class="pt-2 border-t border-border/60 flex justify-between items-center">
            <span class="font-bold text-foreground">مبلغ نهایی قابل پرداخت:</span>
            <div class="text-left">
              <span v-if="isFree" class="text-emerald-400 font-bold text-sm">
                رایگان (۱۰۰٪ تخفیف)
              </span>
              <span v-else class="text-primary font-bold font-mono text-base">
                {{ finalPriceTomans.toLocaleString('fa-IR') }} تومان
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Modal Footer -->
      <div class="px-6 py-4 border-t border-border flex items-center justify-end gap-3 bg-muted/10">
        <BaseButton
          variant="secondary"
          size="sm"
          :disabled="isCheckingOut || isSubmitting"
          @click="emit('close')"
        >
          انصراف
        </BaseButton>

        <BaseButton
          variant="primary"
          size="sm"
          class="min-w-[150px] justify-center"
          :is-loading="isCheckingOut || isSubmitting"
          :disabled="isCheckingOut || isSubmitting"
          @click="handleConfirm"
        >
          <template v-if="isFree">
            فعال‌سازی رایگان اشتراک
          </template>
          <template v-else>
            انتقال به درگاه پرداخت
          </template>
        </BaseButton>
      </div>
    </div>
  </div>
</template>
