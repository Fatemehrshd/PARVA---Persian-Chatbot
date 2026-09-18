<script setup lang="ts">
import { ref, watch } from 'vue'
import AdminModal from '../AdminModal.vue'
import BaseButton from '../../ui/BaseButton.vue'
import type { AdminUser } from '../../../types'
import { numericInputValue } from '../../../utils/numberInput'

const props = defineProps<{
  open: boolean
  user: AdminUser | null
  tokenRatePer1000: number
  isSaving?: boolean
  labels?: Record<string, string>
}>()

const emit = defineEmits<{
  close: []
  save: [data: { displayName?: string; email?: string; role?: 'user' | 'admin'; tokenLimit?: number | null; messageLimit?: number | null }]
}>()

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

watch(
  () => props.user,
  (u) => {
    if (u) {
      const limit = u.tokenLimit !== null && u.tokenLimit !== undefined ? Number(u.tokenLimit) : null
      form.value = {
        displayName: u.displayName || '',
        email: u.email,
        role: u.role === 'admin' ? 'admin' : 'user',
        usedTokens: Number(u.usedTokens || 0),
        tokenLimit: limit,
        messageLimit: u.messageLimit ?? null,
      }
      creditDollarInput.value = limit !== null && limit > 0 ? tokensToDollars(limit) : null
    }
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
  if (num === null || num < 0) {
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
  if (num === null || num < 0) {
    form.value.tokenLimit = null
    creditDollarInput.value = null
  } else {
    form.value.tokenLimit = Math.round(num)
    creditDollarInput.value = tokensToDollars(Math.round(num))
  }
}

function onMessageLimitInput(val: string) {
  form.value.messageLimit = numericInputValue(val)
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
    tokenLimit: form.value.tokenLimit,
    messageLimit: form.value.messageLimit,
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
          <span class="field-label">حداکثر پیام در دوره</span>
          <input :value="form.messageLimit ?? ''" type="text" inputmode="numeric" min="0" placeholder="خالی = سهمیه نقش" :disabled="isSaving" @input="onMessageLimitInput(($event.target as HTMLInputElement).value)" />
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
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-foreground">شارژ و سقف اعتبار کاربر:</span>
            <span class="text-[11px] text-muted-foreground mono font-medium">نرخ فعال: هر ۱۰۰۰ توکن = ${{ tokenRatePer1000 }}</span>
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
                :value="creditDollarInput"
                type="text"
                inputmode="decimal"
                step="any"
                min="0"
                placeholder="مثال: 50"
                :disabled="isSaving"
                @input="onCreditDollarInput(($event.target as HTMLInputElement).value)"
              />
            </label>
            <label>
              <span class="field-label">معادل سقف توکن</span>
              <input
                :value="form.tokenLimit"
                type="text"
                inputmode="numeric"
                min="0"
                placeholder="خالی = سقف نقش یا سراسری سامانه"
                :disabled="isSaving"
                @input="onTokenLimitInput(($event.target as HTMLInputElement).value)"
              />
            </label>
          </div>
          <small class="text-[11px] text-muted-foreground block leading-relaxed">
            با تغییر هر یک از فیلدهای بالا (دلار یا توکن)، فیلد دیگر به صورت خودکار با نرخ برابری روزانه همگام می‌شود. برای حذف سقف اختصاصی، کادر را خالی بگذارید.
          </small>
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
