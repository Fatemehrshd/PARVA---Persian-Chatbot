<script setup lang="ts">
import { ref, watch } from 'vue'
import AdminModal from '../AdminModal.vue'
import BaseButton from '../../ui/BaseButton.vue'
import { numericInputValue } from '../../../utils/numberInput'

const props = defineProps<{
  open: boolean
  role: string
  roleLabel: string
  currentLimit: number | null
  currentMessageLimit?: number | null
  currentResetHours?: number | null
  tokenRatePer1000: number
  isSaving?: boolean
}>()

const emit = defineEmits<{
  close: []
  save: [data: { role: string; quota: { tokenLimit: number | null; messageLimit: number | null; resetHours: number | null } }]
}>()

const form = ref<{ tokenLimit: number | null; messageLimit: number | null; resetHours: number | null }>({ tokenLimit: null, messageLimit: null, resetHours: 6 })
const creditDollarInput = ref<number | null>(null)

function tokensToDollars(tokens: number): number {
  return Number(((tokens / 1000) * props.tokenRatePer1000).toFixed(2))
}

function dollarsToTokens(dollars: number): number {
  return Math.round((dollars / props.tokenRatePer1000) * 1000)
}

watch(
  () => props.open,
  (open) => {
    if (open) {
      const limit = props.currentLimit !== null && props.currentLimit !== undefined ? Number(props.currentLimit) : null
      form.value = { tokenLimit: limit, messageLimit: props.currentMessageLimit ?? null, resetHours: props.currentResetHours ?? 6 }
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

function onResetHoursInput(val: string) {
  const value = numericInputValue(val)
  form.value.resetHours = value === null ? null : Math.round(value)
}

function handleSubmit() {
  if (props.currentMessageLimit === undefined && props.currentResetHours === undefined) {
    emit('save', { role: props.role, tokenLimit: form.value.tokenLimit } as any)
    return
  }
  emit('save', { role: props.role, quota: { ...form.value } })
}
</script>

<template>
  <AdminModal
    v-if="open"
    eyebrow="سقف توکن نقش‌ها"
    :title="`ویرایش سقف توکن نقش «${roleLabel}»`"
    @close="$emit('close')"
  >
    <form class="admin-form" @submit.prevent="handleSubmit">
      <div class="role-summary p-3 rounded-lg bg-muted/40 border border-border flex items-center justify-between">
        <span class="field-label text-xs font-semibold text-muted-foreground">نقش انتخاب‌شده:</span>
        <span class="text-sm font-bold text-foreground">{{ roleLabel }}</span>
      </div>

      <!-- فیلد تخصیص اعتبار دلاری و سهمیه معادل -->
      <div class="p-3.5 rounded-xl bg-secondary/70 border border-border space-y-3">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold text-foreground">سقف اعتبار این نقش:</span>
          <span class="text-[11px] text-muted-foreground mono font-medium">نرخ فعال: هر ۱۰۰۰ توکن = ${{ tokenRatePer1000 }}</span>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label>
            <span class="field-label">سقف دلاری ($ USD)</span>
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
              placeholder="خالی = سقف سراسری سامانه"
              :disabled="isSaving"
              @input="onTokenLimitInput(($event.target as HTMLInputElement).value)"
            />
          </label>
        </div>
        <small class="text-[11px] text-muted-foreground block leading-relaxed">
          با تغییر هر یک از فیلدهای بالا (دلار یا توکن)، فیلد دیگر به صورت خودکار همگام می‌شود. برای حذف سقف این نقش و اعمال سقف سراسری سامانه، کادر را خالی بگذارید. کاربرانی که سقف اختصاصی داشته باشند، همیشه از سقف اختصاصی خود پیروی می‌کنند.
        </small>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label>
          <span class="field-label">حداکثر پیام در دوره</span>
          <input :value="form.messageLimit ?? ''" type="text" inputmode="numeric" min="0" placeholder="خالی = نامحدود" :disabled="isSaving" @input="onMessageLimitInput(($event.target as HTMLInputElement).value)" />
        </label>
        <label>
          <span class="field-label">ریست دوره (ساعت)</span>
          <input :value="form.resetHours ?? ''" type="text" inputmode="numeric" min="0" step="1" :disabled="isSaving" @input="onResetHoursInput(($event.target as HTMLInputElement).value)" />
        </label>
      </div>

      <div class="modal-actions">
        <BaseButton variant="ghost" size="md" :disabled="isSaving" type="button" @click="$emit('close')">
          انصراف
        </BaseButton>
        <BaseButton variant="primary" size="md" type="submit" :loading="isSaving" :disabled="isSaving">
          ذخیره
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
.field-label {
  display: block;
  margin-bottom: 6px;
  font-size: 12.5px;
  font-weight: 500;
  color: var(--foreground);
}
input {
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
input:focus {
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
  .admin-form .grid {
    grid-template-columns: 1fr;
  }
}
</style>
