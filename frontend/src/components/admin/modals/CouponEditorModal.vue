<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import AdminModal from '../AdminModal.vue'
import BaseButton from '../../ui/BaseButton.vue'
import PersianDatePicker from '../../ui/PersianDatePicker.vue'
import type { Coupon, CreateCouponRequest, UpdateCouponRequest } from '../../../types'

const props = defineProps<{
  open: boolean
  coupon: Coupon | null
  isSaving?: boolean
}>()

const emit = defineEmits<{
  close: []
  save: [data: CreateCouponRequest | UpdateCouponRequest]
}>()

const form = ref<{
  code: string
  description: string
  discountType: 'PERCENTAGE' | 'FIXED'
  discountValue: number
  maxDiscountAmount: number | null
  minOrderAmount: number | null
  usageLimit: number | null
  perUserLimit: number
  expiresAt: string
  isActive: boolean
}>({
  code: '',
  description: '',
  discountType: 'PERCENTAGE',
  discountValue: 20,
  maxDiscountAmount: null,
  minOrderAmount: null,
  usageLimit: null,
  perUserLimit: 1,
  expiresAt: '',
  isActive: true,
})

const error = ref('')

watch(
  () => props.coupon,
  (c) => {
    error.value = ''
    if (c) {
      form.value = {
        code: c.code,
        description: c.description || '',
        discountType: c.discountType,
        discountValue: Number(c.discountValue),
        maxDiscountAmount: c.maxDiscountAmount ? Number(c.maxDiscountAmount) : null,
        minOrderAmount: c.minOrderAmount ? Number(c.minOrderAmount) : null,
        usageLimit: c.usageLimit ?? null,
        perUserLimit: c.perUserLimit ?? 1,
        expiresAt: c.expiresAt ? c.expiresAt.slice(0, 16) : '',
        isActive: c.isActive,
      }
    } else {
      form.value = {
        code: '',
        description: '',
        discountType: 'PERCENTAGE',
        discountValue: 20,
        maxDiscountAmount: null,
        minOrderAmount: null,
        usageLimit: null,
        perUserLimit: 1,
        expiresAt: '',
        isActive: true,
      }
    }
  },
  { immediate: true },
)

const isEdit = computed(() => !!props.coupon)

function handleSubmit() {
  error.value = ''
  const trimmedCode = form.value.code.trim().toUpperCase()
  if (!trimmedCode) {
    error.value = 'وارد کردن کد تخفیف الزامی است.'
    return
  }

  if (form.value.discountValue <= 0) {
    error.value = 'مقدار تخفیف باید بزرگتر از صفر باشد.'
    return
  }

  if (form.value.discountType === 'PERCENTAGE' && form.value.discountValue > 100) {
    error.value = 'درصد تخفیف نمی‌تواند بیشتر از ۱۰۰ باشد.'
    return
  }

  const payload: any = {
    code: trimmedCode,
    description: form.value.description.trim() || undefined,
    discountType: form.value.discountType,
    discountValue: Number(form.value.discountValue),
    maxDiscountAmount: form.value.maxDiscountAmount ? Number(form.value.maxDiscountAmount) : null,
    minOrderAmount: form.value.minOrderAmount ? Number(form.value.minOrderAmount) : null,
    usageLimit: form.value.usageLimit ? Number(form.value.usageLimit) : null,
    perUserLimit: Number(form.value.perUserLimit || 1),
    expiresAt: form.value.expiresAt ? new Date(form.value.expiresAt).toISOString() : null,
    isActive: form.value.isActive,
  }

  emit('save', payload)
}
</script>

<template>
  <AdminModal
    :open="open"
    :title="isEdit ? 'ویرایش کد تخفیف' : 'ایجاد کد تخفیف جدید'"
    max-width="max-w-xl"
    @close="emit('close')"
  >
    <form @submit.prevent="handleSubmit" class="space-y-4 text-right">
      <div v-if="error" class="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-xs">
        {{ error }}
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <!-- Coupon Code -->
        <div>
          <label class="block text-xs font-medium text-text-secondary mb-1">
            کد تخفیف <span class="text-red-400">*</span>
          </label>
          <input
            v-model="form.code"
            type="text"
            dir="ltr"
            placeholder="e.g. NOROOZ1403"
            class="w-full px-3 py-2 bg-surface-primary border border-border-default rounded-lg text-text-primary text-sm font-mono uppercase focus:border-brand-primary outline-none"
            :disabled="isSaving"
            required
          />
        </div>

        <!-- Description -->
        <div>
          <label class="block text-xs font-medium text-text-secondary mb-1">
            توضیحات (اختیاری)
          </label>
          <input
            v-model="form.description"
            type="text"
            placeholder="تخفیف ویژه جشنواره نوروزی"
            class="w-full px-3 py-2 bg-surface-primary border border-border-default rounded-lg text-text-primary text-sm focus:border-brand-primary outline-none"
            :disabled="isSaving"
          />
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <!-- Discount Type -->
        <div>
          <label class="block text-xs font-medium text-text-secondary mb-1">
            نوع تخفیف <span class="text-red-400">*</span>
          </label>
          <select
            v-model="form.discountType"
            class="w-full px-3 py-2 bg-surface-primary border border-border-default rounded-lg text-text-primary text-sm focus:border-brand-primary outline-none"
            :disabled="isSaving"
          >
            <option value="PERCENTAGE">درصدی (%)</option>
            <option value="FIXED">مبلغ ثابت (ریال)</option>
          </select>
        </div>

        <!-- Discount Value -->
        <div>
          <label class="block text-xs font-medium text-text-secondary mb-1">
            {{ form.discountType === 'PERCENTAGE' ? 'درصد تخفیف (۱ تا ۱۰۰)' : 'مبلغ تخفیف (ریال)' }}
            <span class="text-red-400">*</span>
          </label>
          <input
            v-model.number="form.discountValue"
            type="number"
            min="1"
            :max="form.discountType === 'PERCENTAGE' ? 100 : undefined"
            class="w-full px-3 py-2 bg-surface-primary border border-border-default rounded-lg text-text-primary text-sm focus:border-brand-primary outline-none"
            :disabled="isSaving"
            required
          />
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <!-- Max Discount Amount (for PERCENTAGE) -->
        <div v-if="form.discountType === 'PERCENTAGE'">
          <label class="block text-xs font-medium text-text-secondary mb-1">
            سقف تخفیف (ریال - اختیاری)
          </label>
          <input
            v-model.number="form.maxDiscountAmount"
            type="number"
            min="0"
            placeholder="مثلاً ۵۰۰,۰۰۰ (خالی = نامحدود)"
            class="w-full px-3 py-2 bg-surface-primary border border-border-default rounded-lg text-text-primary text-sm focus:border-brand-primary outline-none"
            :disabled="isSaving"
          />
        </div>

        <!-- Min Order Amount -->
        <div :class="form.discountType === 'PERCENTAGE' ? '' : 'md:col-span-2'">
          <label class="block text-xs font-medium text-text-secondary mb-1">
            حداقل مبلغ سفارش (ریال - اختیاری)
          </label>
          <input
            v-model.number="form.minOrderAmount"
            type="number"
            min="0"
            placeholder="مثلاً ۱,۰۰۰,۰۰۰ (خالی = بدون شرط)"
            class="w-full px-3 py-2 bg-surface-primary border border-border-default rounded-lg text-text-primary text-sm focus:border-brand-primary outline-none"
            :disabled="isSaving"
          />
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <!-- Usage Limit (Total) -->
        <div>
          <label class="block text-xs font-medium text-text-secondary mb-1">
            سقف کل استفاده (اختیاری)
          </label>
          <input
            v-model.number="form.usageLimit"
            type="number"
            min="1"
            placeholder="نامحدود"
            class="w-full px-3 py-2 bg-surface-primary border border-border-default rounded-lg text-text-primary text-sm focus:border-brand-primary outline-none"
            :disabled="isSaving"
          />
        </div>

        <!-- Per-User Limit -->
        <div>
          <label class="block text-xs font-medium text-text-secondary mb-1">
            سقف استفاده هر کاربر
          </label>
          <input
            v-model.number="form.perUserLimit"
            type="number"
            min="1"
            class="w-full px-3 py-2 bg-surface-primary border border-border-default rounded-lg text-text-primary text-sm focus:border-brand-primary outline-none"
            :disabled="isSaving"
            required
          />
        </div>

        <!-- Expiration Date -->
        <div>
          <label class="block text-xs font-medium text-text-secondary mb-1">
            تاریخ انقضا (اختیاری)
          </label>
          <PersianDatePicker
            v-model="form.expiresAt"
            :disabled="isSaving"
            placeholder="انتخاب تاریخ و ساعت انقضا..."
          />
        </div>
      </div>

      <!-- Is Active Toggle -->
      <div class="flex items-center gap-3 pt-2">
        <input
          id="coupon-is-active"
          v-model="form.isActive"
          type="checkbox"
          class="w-4 h-4 rounded text-brand-primary focus:ring-0 cursor-pointer"
          :disabled="isSaving"
        />
        <label for="coupon-is-active" class="text-xs text-text-primary font-medium cursor-pointer select-none">
          کد تخفیف فعال باشد و امکان استفاده داشته باشد
        </label>
      </div>

      <!-- Actions -->
      <div class="flex items-center justify-end gap-3 pt-4 border-t border-border-default">
        <BaseButton
          type="button"
          variant="secondary"
          size="sm"
          :disabled="isSaving"
          @click="emit('close')"
        >
          انصراف
        </BaseButton>
        <BaseButton
          type="submit"
          variant="primary"
          size="sm"
          :disabled="isSaving"
        >
          {{ isSaving ? 'در حال ذخیره...' : (isEdit ? 'بروزرسانی کد تخفیف' : 'ایجاد کد تخفیف') }}
        </BaseButton>
      </div>
    </form>
  </AdminModal>
</template>
