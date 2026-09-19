<script setup lang="ts">
import { ref, watch } from 'vue'
import AdminModal from '../AdminModal.vue'
import BaseButton from '../../ui/BaseButton.vue'
import { subscriptionService } from '../../../services/subscription.service'
import { adminService } from '../../../services/admin.service'
import type { SubscriptionPlan, AdminUser } from '../../../types'

const props = defineProps<{
  open: boolean
  isSaving?: boolean
  initialUserId?: string
  initialPlanId?: string
  userName?: string
}>()

const emit = defineEmits<{
  close: []
  save: [data: { userId: string; planId: string; durationDays?: number }]
}>()

const users = ref<AdminUser[]>([])
const plans = ref<SubscriptionPlan[]>([])
const isLoadingData = ref(false)

const form = ref<{
  userId: string
  planId: string
  durationDays: number | null
}>({
  userId: '',
  planId: '',
  durationDays: null,
})

async function loadOptions() {
  isLoadingData.value = true
  try {
    const [uRes, pList] = await Promise.all([
      adminService.listUsers({ limit: 100 }),
      subscriptionService.getAllPlans(),
    ])
    if (uRes && 'items' in uRes) {
      users.value = uRes.items || []
    } else if (Array.isArray(uRes)) {
      users.value = uRes
    }
    plans.value = pList || []
    if (plans.value.length > 0 && !form.value.planId) {
      form.value.planId = props.initialPlanId || plans.value[0].id
    }
    if (props.initialUserId) {
      form.value.userId = props.initialUserId
    }
  } catch {
    // fallback
  } finally {
    isLoadingData.value = false
  }
}

watch(
  () => props.open,
  (val) => {
    if (val) {
      form.value = {
        userId: props.initialUserId || '',
        planId: props.initialPlanId || plans.value[0]?.id || '',
        durationDays: null,
      }
      loadOptions()
    }
  },
  { immediate: true },
)

watch(
  () => form.value.planId,
  (pid) => {
    const p = plans.value.find((item) => item.id === pid)
    if (p && p.durationDays > 0) {
      form.value.durationDays = p.durationDays
    } else {
      form.value.durationDays = null
    }
  },
)

async function handleSubmit() {
  if (!form.value.userId || !form.value.planId) return
  emit('save', {
    userId: form.value.userId,
    planId: form.value.planId,
    durationDays: form.value.durationDays !== null && form.value.durationDays > 0 ? form.value.durationDays : undefined,
  })
}
</script>

<template>
  <AdminModal
    v-if="open"
    eyebrow="مدیریت اشتراک‌ها"
    title="تخصیص دستی اشتراک به کاربر"
    @close="emit('close')"
  >
    <form class="space-y-4 text-sm" dir="rtl" @submit.prevent="handleSubmit">
      <!-- انتخاب کاربر -->
      <div>
        <label class="block text-xs font-semibold mb-1 text-muted-foreground">
          انتخاب کاربر <span class="text-destructive">*</span>
        </label>
        <div v-if="initialUserId" class="p-2.5 rounded-lg bg-secondary/50 border border-border text-xs flex items-center justify-between">
          <span class="font-bold text-foreground">{{ userName || form.userId }}</span>
          <span class="text-[11px] text-muted-foreground font-mono" dir="ltr">{{ initialUserId }}</span>
        </div>
        <select
          v-else
          v-model="form.userId"
          class="form-input"
          required
          :disabled="isSaving || isLoadingData"
        >
          <option value="" disabled>-- یک کاربر را انتخاب کنید --</option>
          <option v-for="u in users" :key="u.id" :value="u.id">
            {{ u.displayName ? `${u.displayName} (${u.email})` : u.email }}
          </option>
        </select>
      </div>

      <!-- انتخاب طرح -->
      <div>
        <label class="block text-xs font-semibold mb-1 text-muted-foreground">
          طرح اشتراک <span class="text-destructive">*</span>
        </label>
        <select
          v-model="form.planId"
          class="form-input"
          required
          :disabled="isSaving || isLoadingData"
        >
          <option value="" disabled>-- انتخاب طرح --</option>
          <option v-for="p in plans" :key="p.id" :value="p.id">
            {{ p.name }} - {{ Number(p.price) === 0 ? 'رایگان' : `${Number(p.price).toLocaleString('fa-IR')} ریال` }}
          </option>
        </select>
      </div>

      <!-- مدت اعتبار -->
      <div>
        <label class="block text-xs font-semibold mb-1 text-muted-foreground">
          مدت اعتبار (روز - خالی یا ۰ برای دائمی)
        </label>
        <input
          v-model.number="form.durationDays"
          type="number"
          min="0"
          placeholder="پیش‌فرض طرح اعمال می‌شود"
          class="form-input font-mono"
          :disabled="isSaving"
        />
      </div>

      <!-- Actions -->
      <div class="modal-actions pt-4 border-t border-border flex items-center justify-end gap-2.5">
        <BaseButton
          variant="ghost"
          type="button"
          :disabled="isSaving"
          @click="emit('close')"
        >
          انصراف
        </BaseButton>
        <BaseButton
          variant="primary"
          type="submit"
          :loading="isSaving"
          :disabled="isSaving || !form.userId || !form.planId"
        >
          ثبت و تخصیص اشتراک
        </BaseButton>
      </div>
    </form>
  </AdminModal>
</template>

<style scoped>
.form-input {
  width: 100%;
  padding: 8px 12px;
  border-radius: 9px;
  border: 1px solid var(--border);
  background-color: var(--card);
  color: var(--foreground);
  font-size: 13px;
  outline: none;
  transition: border-color 0.15s ease;
}

.form-input:focus {
  border-color: var(--primary);
}
</style>
