<script setup lang="ts">
import { ref, watch } from 'vue'
import AdminModal from '../AdminModal.vue'
import BaseButton from '../../ui/BaseButton.vue'
import type { AdminUser, SubscriptionPlan } from '../../../types'
import { numericInputValue } from '../../../utils/numberInput'
import { subscriptionService } from '../../../services/subscription.service'

const props = defineProps<{
  open: boolean
  user: AdminUser | null
  tokenRatePer1000: number
  isSaving?: boolean
  labels?: Record<string, string>
  inheritedTokenLimit?: number | null
  inheritedMessageLimit?: number | null
}>()

const emit = defineEmits<{
  close: []
  save: [data: {
    displayName?: string
    email?: string
    role?: 'user' | 'admin'
    tokenLimit?: number | null
    messageLimit?: number | null
    newPlanId?: string
    durationDays?: number
  }]
}>()

const availablePlans = ref<SubscriptionPlan[]>([])
const selectedPlanId = ref<string>('')
const planDurationDays = ref<number | null>(null)

watch(
  () => props.open,
  async (isOpen) => {
    if (isOpen) {
      selectedPlanId.value = ''
      planDurationDays.value = null
      try {
        availablePlans.value = (await subscriptionService.getAllPlans()) || []
      } catch {
        availablePlans.value = []
      }
    }
  },
  { immediate: true },
)

watch(
  () => selectedPlanId.value,
  (newPid) => {
    if (newPid) {
      const p = availablePlans.value.find((item) => item.id === newPid)
      planDurationDays.value = p && p.durationDays > 0 ? p.durationDays : null
    } else {
      planDurationDays.value = null
    }
  },
)

const form = ref<{
  displayName: string
  email: string
  role: 'user' | 'admin'
  usedTokens: number
  tokenLimit: number | null
  messageLimit: number | null
}>({
  displayName: '',
  email: '',
  role: 'user',
  usedTokens: 0,
  tokenLimit: null,
  messageLimit: null,
})

const creditDollarInput = ref<number | null>(null)

function tokensToDollars(tokens: number): number {
  return Number(((tokens / 1000) * props.tokenRatePer1000).toFixed(2))
}

function dollarsToTokens(dollars: number): number {
  return Math.round((dollars / props.tokenRatePer1000) * 1000)
}

function populateForm(u: AdminUser) {
  const limit = u.tokenLimit !== null && u.tokenLimit !== undefined && Number(u.tokenLimit) > 0 ? Number(u.tokenLimit) : null
  const msgLimit = u.messageLimit !== null && u.messageLimit !== undefined && Number(u.messageLimit) > 0 ? Number(u.messageLimit) : null
  form.value = {
    displayName: u.displayName || '',
    email: u.email,
    role: u.role === 'admin' ? 'admin' : 'user',
    usedTokens: Number(u.usedTokens || 0),
    tokenLimit: limit,
    messageLimit: msgLimit,
  }
  creditDollarInput.value = limit !== null && limit > 0 ? tokensToDollars(limit) : null
}

// هم روی «open» و هم روی «user» نگاه می‌کنیم تا هر بار باز شدن مودال، فرم از
// داده فعلی همان کاربر بازپر شود (حتی اگر reference آبجکت عوض نشده باشد).
watch(
  [() => props.open, () => props.user],
  ([isOpen, u]) => {
    if (isOpen && u) populateForm(u)
  },
  { immediate: true }
)

function onCreditDollarInput(val: string | number | null) {
  if (val === '' || val === null || val === undefined) {
    creditDollarInput.value = null
    form.value.tokenLimit = null
    return
  }
  const num = typeof val === 'number' ? val : numericInputValue(val)
  if (num === null || num <= 0) {
    creditDollarInput.value = null
    form.value.tokenLimit = null
  } else {
    creditDollarInput.value = num
    form.value.tokenLimit = dollarsToTokens(num)
  }
}

function onTokenLimitInput(val: string | number | null) {
  if (val === '' || val === null || val === undefined) {
    form.value.tokenLimit = null
    creditDollarInput.value = null
    return
  }
  const num = typeof val === 'number' ? val : numericInputValue(val)
  if (num === null || num <= 0) {
    form.value.tokenLimit = null
    creditDollarInput.value = null
  } else {
    form.value.tokenLimit = Math.round(num)
    creditDollarInput.value = tokensToDollars(Math.round(num))
  }
}

function onMessageLimitInput(val: string) {
  const num = numericInputValue(val)
  form.value.messageLimit = num !== null && num > 0 ? num : null
}

function clearPersonalLimits() {
  form.value.tokenLimit = null
  creditDollarInput.value = null
  form.value.messageLimit = null
}

function quickRecharge(amountDollars: number) {
  const currentDollars = creditDollarInput.value ?? (form.value.tokenLimit ? tokensToDollars(form.value.tokenLimit) : 0)
  const newTotal = Number((currentDollars + amountDollars).toFixed(2))
  creditDollarInput.value = newTotal
  form.value.tokenLimit = dollarsToTokens(newTotal)
}

function handleSubmit() {
  emit('save', {
    displayName: form.value.displayName.trim() || undefined,
    email: form.value.email.trim(),
    role: form.value.role,
    tokenLimit: form.value.tokenLimit === null || form.value.tokenLimit === undefined ? null : Number(form.value.tokenLimit),
    messageLimit: form.value.messageLimit === null || form.value.messageLimit === undefined ? null : Number(form.value.messageLimit),
    newPlanId: selectedPlanId.value || undefined,
    durationDays: planDurationDays.value !== null && planDurationDays.value > 0 ? planDurationDays.value : undefined,
  })
}
</script>

<template>
  <AdminModal
    v-if="open"
    eyebrow="کاربران"
    title="ویرایش سهمیه و وضعیت کاربر"
    @close="$emit('close')"
  >
    <form class="admin-form" @submit.prevent="handleSubmit">
      <div class="form-grid">
        <label>
          <span class="field-label">نام کاربر</span>
          <input v-model="form.displayName" :disabled="isSaving" placeholder="نام و نام خانوادگی کاربر" />
        </label>
        <label>
          <div class="flex items-center justify-between mb-1">
            <span class="field-label">حداکثر پیام در دوره</span>
            <span v-if="form.messageLimit" class="text-[10px] text-blue-500 font-semibold">(اختصاصی کاربر)</span>
            <span v-else-if="inheritedMessageLimit" class="text-[10px] text-muted-foreground font-mono">سقف نقش: {{ Number(inheritedMessageLimit).toLocaleString('fa-IR') }}</span>
          </div>
          <input
            :value="form.messageLimit ?? ''"
            type="text"
            inputmode="numeric"
            min="0"
            :placeholder="inheritedMessageLimit ? `خالی = ارث‌بری (${Number(inheritedMessageLimit).toLocaleString('fa-IR')} پیام)` : 'خالی = سهمیه نقش یا نامحدود'"
            :disabled="isSaving"
            @input="onMessageLimitInput(($event.target as HTMLInputElement).value)"
          />
        </label>
        <label>
          <span class="field-label">ایمیل <span class="req">*</span></span>
          <input v-model="form.email" type="email" required :disabled="isSaving" />
        </label>
        <label>
          <span class="field-label">{{ labels?.role || 'نقش کاربری' }}</span>
          <select v-model="form.role" :disabled="isSaving">
            <option value="user">کاربر عادی</option>
            <option value="admin">مدیر سیستم</option>
          </select>
        </label>

        <!-- توکن مصرف‌شده (ثابت و غیرقابل دستکاری) -->
        <div class="user-consumed-box p-3 rounded-lg bg-muted/40 border border-border flex flex-col gap-1">
          <span class="field-label text-xs font-semibold text-muted-foreground">{{ labels?.usedTokens || 'توکن‌های مصرف‌شده' }} (ثابت):</span>
          <div class="flex items-center justify-between">
            <span class="font-mono text-sm font-bold text-foreground">
              {{ Number(form.usedTokens || 0).toLocaleString('fa-IR') }} توکن
            </span>
            <span class="font-mono text-xs text-muted-foreground">
              معادل ${{ tokensToDollars(form.usedTokens || 0) }} مصرف‌شده
            </span>
          </div>
        </div>

        <!-- فیلد تخصیص اعتبار دلاری و سهمیه معادل با دکمه‌های شارژ سریع -->
        <div class="col-span-full p-3.5 rounded-xl bg-secondary/70 border border-border space-y-3">
          <div class="flex items-center justify-between flex-wrap gap-2">
            <div class="flex items-center gap-2">
              <span class="text-xs font-bold text-foreground">شارژ و سقف اعتبار کاربر:</span>
              <span
                v-if="form.tokenLimit"
                class="text-[10px] px-2 py-0.5 rounded bg-blue-500/15 text-blue-500 border border-blue-500/25 font-bold"
              >
                سهمیه اختصاصی فعال است (اولویت بالاتر از سقف کلی)
              </span>
              <span
                v-else
                class="text-[10px] px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border"
              >
                ارث‌بری خودکار از سقف نقش یا سراسری
              </span>
            </div>
            <button
              v-if="form.tokenLimit || form.messageLimit"
              type="button"
              class="text-xs text-destructive hover:underline cursor-pointer flex items-center gap-1"
              @click="clearPersonalLimits"
            >
              حذف سقف اختصاصی (بازگشت به ارث‌بری)
            </button>
          </div>

          <!-- دکمه‌های شارژ سریع -->
          <div class="flex items-center gap-1.5 flex-wrap">
            <span class="text-xs text-muted-foreground">شارژ سریع:</span>
            <button
              type="button"
              class="quick-recharge-chip text-xs px-2.5 py-1 rounded-md bg-card hover:bg-muted border border-border transition-colors font-mono cursor-pointer"
              @click="quickRecharge(10)"
            >
              + ۱۰$
            </button>
            <button
              type="button"
              class="quick-recharge-chip text-xs px-2.5 py-1 rounded-md bg-card hover:bg-muted border border-border transition-colors font-mono cursor-pointer"
              @click="quickRecharge(25)"
            >
              + ۲۵$
            </button>
            <button
              type="button"
              class="quick-recharge-chip text-xs px-2.5 py-1 rounded-md bg-card hover:bg-muted border border-border transition-colors font-mono cursor-pointer"
              @click="quickRecharge(50)"
            >
              + ۵۰$
            </button>
            <button
              type="button"
              class="quick-recharge-chip text-xs px-2.5 py-1 rounded-md bg-card hover:bg-muted border border-border transition-colors font-mono cursor-pointer"
              @click="quickRecharge(100)"
            >
              + ۱۰۰$
            </button>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label>
              <span class="field-label">شارژ سقف دلاری ($ USD)</span>
              <input
                :value="creditDollarInput ?? ''"
                type="text"
                inputmode="decimal"
                step="any"
                min="0"
                :placeholder="inheritedTokenLimit ? `خالی = ارث‌بری ($${tokensToDollars(inheritedTokenLimit)})` : 'مثال: 50'"
                :disabled="isSaving"
                @input="onCreditDollarInput(($event.target as HTMLInputElement).value)"
              />
            </label>
            <label>
              <span class="field-label">معادل سقف توکن</span>
              <input
                :value="form.tokenLimit ?? ''"
                type="text"
                inputmode="numeric"
                min="0"
                :placeholder="inheritedTokenLimit ? `خالی = ارث‌بری (${Number(inheritedTokenLimit).toLocaleString('fa-IR')} توکن)` : 'خالی = سقف نقش یا سراسری سامانه'"
                :disabled="isSaving"
                @input="onTokenLimitInput(($event.target as HTMLInputElement).value)"
              />
            </label>
          </div>
          <small class="text-[11px] text-muted-foreground block leading-relaxed">
            با تغییر هر یک از فیلدهای بالا (دلار یا توکن)، فیلد دیگر به صورت خودکار با نرخ برابری روزانه همگام می‌شود. در صورت تعیین عدد، این سهمیه مستقیماً بر سقف کلی اولویت داشته و اعمال می‌شود. برای حذف سقف اختصاصی و ارث‌بری، کادر را خالی بگذارید.
          </small>
        </div>

        <!-- بخش طرح اشتراک کاربر -->
        <div class="col-span-full p-3.5 rounded-xl bg-purple-500/5 border border-purple-500/20 space-y-3">
          <div class="flex items-center justify-between flex-wrap gap-2">
            <span class="text-xs font-bold text-foreground">طرح اشتراک کاربر:</span>
            <span class="px-2 py-0.5 text-xs font-bold rounded-full bg-purple-500/15 text-purple-500 border border-purple-500/25">
              {{ user?.planName || 'طرح رایگان' }}
            </span>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            <label>
              <span class="field-label text-xs font-semibold text-muted-foreground block mb-1">تغییر طرح اشتراک:</span>
              <select v-model="selectedPlanId" :disabled="isSaving" class="w-full">
                <option value="">-- بدون تغییر --</option>
                <option v-for="p in availablePlans" :key="p.id" :value="p.id">
                  {{ p.name }} ({{ Number(p.price) === 0 ? 'رایگان' : `${Number(p.price).toLocaleString('fa-IR')} ریال` }})
                </option>
              </select>
            </label>

            <label v-if="selectedPlanId">
              <span class="field-label text-xs font-semibold text-muted-foreground block mb-1">مدت اعتبار (روز - خالی برای پیش‌فرض طرح):</span>
              <input v-model.number="planDurationDays" type="number" min="0" placeholder="پیش‌فرض طرح" :disabled="isSaving" />
            </label>
          </div>
        </div>
      </div>
      <div class="modal-actions">
        <BaseButton variant="ghost" size="md" :disabled="isSaving" type="button" @click="$emit('close')">
          {{ labels?.cancel || 'انصراف' }}
        </BaseButton>
        <BaseButton variant="primary" size="md" type="submit" :loading="isSaving" :disabled="isSaving">
          {{ labels?.save || 'ذخیره' }}
        </BaseButton>
      </div>
    </form>
  </AdminModal>
</template>

<style scoped>
.admin-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}
.col-span-full {
  grid-column: 1 / -1;
}
.field-label {
  display: block;
  margin-bottom: 6px;
  font-size: 12.5px;
  font-weight: 500;
  color: var(--foreground);
}
.req {
  color: var(--destructive, #ef4444);
}
input, select {
  width: 100%;
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--background);
  color: var(--foreground);
  font-size: 13px;
  font-family: inherit;
  outline: none;
}
input:focus, select:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 1px var(--primary);
}
.mono {
  font-family: var(--font-mono, monospace);
  direction: ltr;
}
.modal-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  padding-top: 14px;
  border-top: 1px solid var(--border);
}
@media (max-width: 600px) {
  .form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
