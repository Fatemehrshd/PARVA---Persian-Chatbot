<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import AdminModal from '../AdminModal.vue'
import BaseButton from '../../ui/BaseButton.vue'
import { modelsService } from '../../../services/models.service'
import type { SubscriptionPlan, Model as AiModel } from '../../../types'

const props = defineProps<{
  open: boolean
  plan: SubscriptionPlan | null
  isSaving?: boolean
}>()

const emit = defineEmits<{
  close: []
  save: [data: Partial<SubscriptionPlan> & { modelIds?: string[] }]
}>()

const availableModels = ref<AiModel[]>([])

const form = ref<{
  name: string
  slug: string
  description: string
  price: number
  durationDays: number
  tokenQuota: number
  messageQuota: number | null
  resetHours: number
  isActive: boolean
  isDefault: boolean
  modelIds: string[]
}>({
  name: '',
  slug: '',
  description: '',
  price: 0,
  durationDays: 30,
  tokenQuota: 0,
  messageQuota: null,
  resetHours: 6,
  isActive: true,
  isDefault: false,
  modelIds: [],
})

onMounted(async () => {
  try {
    const list = await modelsService.listModels()
    if (Array.isArray(list)) {
      availableModels.value = list
    } else if (list && 'items' in list) {
      availableModels.value = list.items
    } else {
      availableModels.value = []
    }
  } catch {
    // fallback
  }
})

const modelsByProvider = computed(() => {
  const map: Record<string, AiModel[]> = {}
  for (const m of availableModels.value) {
    const prov = m.provider || 'سایر ارائه‌دهندگان'
    if (!map[prov]) map[prov] = []
    map[prov].push(m)
  }
  return map
})

function isProviderAllSelected(prov: string): boolean {
  const models = modelsByProvider.value[prov] || []
  return models.length > 0 && models.every((m) => form.value.modelIds.includes(m.id))
}

function isProviderPartiallySelected(prov: string): boolean {
  const models = modelsByProvider.value[prov] || []
  const count = models.filter((m) => form.value.modelIds.includes(m.id)).length
  return count > 0 && count < models.length
}

function toggleProvider(prov: string) {
  const models = modelsByProvider.value[prov] || []
  if (isProviderAllSelected(prov)) {
    const idsToRemove = new Set(models.map((m) => m.id))
    form.value.modelIds = form.value.modelIds.filter((id) => !idsToRemove.has(id))
  } else {
    const current = new Set(form.value.modelIds)
    for (const m of models) {
      current.add(m.id)
    }
    form.value.modelIds = Array.from(current)
  }
}

watch(
  () => props.plan,
  (p) => {
    if (p) {
      const selectedModelIds = p.planModels ? p.planModels.map((pm) => pm.modelId) : []
      form.value = {
        name: p.name || '',
        slug: p.slug || '',
        description: p.description || '',
        price: Number(p.price || 0),
        durationDays: p.durationDays ?? 30,
        tokenQuota: p.tokenQuota ?? 0,
        messageQuota: p.messageQuota ?? null,
        resetHours: p.resetHours ?? 6,
        isActive: p.isActive ?? true,
        isDefault: p.isDefault ?? false,
        modelIds: selectedModelIds,
      }
    } else {
      form.value = {
        name: '',
        slug: '',
        description: '',
        price: 0,
        durationDays: 30,
        tokenQuota: 0,
        messageQuota: null,
        resetHours: 6,
        isActive: true,
        isDefault: false,
        modelIds: [],
      }
    }
  },
  { immediate: true },
)

function toggleModel(modelId: string) {
  const idx = form.value.modelIds.indexOf(modelId)
  if (idx >= 0) {
    form.value.modelIds.splice(idx, 1)
  } else {
    form.value.modelIds.push(modelId)
  }
}

function handleSave() {
  const payload: any = {
    name: form.value.name,
    description: form.value.description,
    price: form.value.price,
    durationDays: form.value.durationDays,
    tokenQuota: form.value.tokenQuota,
    messageQuota: form.value.messageQuota,
    resetHours: form.value.resetHours,
    isActive: form.value.isActive,
    isDefault: form.value.isDefault,
    modelIds: form.value.modelIds,
  }
  if (!props.plan) {
    payload.slug = form.value.slug
  }
  emit('save', payload)
}
</script>

<template>
  <AdminModal
    v-if="open"
    eyebrow="طرح‌های اشتراک"
    :title="plan ? 'ویرایش طرح اشتراک' : 'افزودن طرح اشتراک جدید'"
    @close="emit('close')"
  >
    <form class="plan-form space-y-4 text-sm" dir="rtl" @submit.prevent="handleSave">
      <!-- Name & Slug -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label class="block text-xs font-semibold mb-1 text-muted-foreground">نام طرح (فارسی) <span class="text-destructive">*</span></label>
          <input
            v-model="form.name"
            type="text"
            class="form-input"
            placeholder="مثال: طرح حرفه‌ای (Pro)"
            required
          />
        </div>
        <div>
          <label class="block text-xs font-semibold mb-1 text-muted-foreground">شناسه سیستمی (Slug انگلیسی) <span class="text-destructive">*</span></label>
          <input
            v-model="form.slug"
            type="text"
            class="form-input font-mono"
            dir="ltr"
            placeholder="مثال: pro"
            :disabled="!!plan"
            required
          />
        </div>
      </div>

      <!-- Description -->
      <div>
        <label class="block text-xs font-semibold mb-1 text-muted-foreground">توضیحات طرح</label>
        <textarea
          v-model="form.description"
          rows="2"
          class="form-input"
          placeholder="توضیح کوتاه درباره ویژگی‌های طرح..."
        ></textarea>
      </div>

      <!-- Pricing & Duration -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label class="block text-xs font-semibold mb-1 text-muted-foreground">قیمت (ریال - ۰ برای رایگان)</label>
          <input
            v-model.number="form.price"
            type="number"
            min="0"
            step="10000"
            class="form-input font-mono"
          />
        </div>
        <div>
          <label class="block text-xs font-semibold mb-1 text-muted-foreground">مدت اعتبار (روز - ۰ برای دائمی)</label>
          <input
            v-model.number="form.durationDays"
            type="number"
            min="0"
            class="form-input font-mono"
          />
        </div>
      </div>

      <!-- Quotas -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label class="block text-xs font-semibold mb-1 text-muted-foreground">سقف توکن دوره</label>
          <input
            v-model.number="form.tokenQuota"
            type="number"
            min="0"
            step="10000"
            class="form-input font-mono"
            placeholder="0 = ارث‌بری سراسری"
          />
        </div>
        <div>
          <label class="block text-xs font-semibold mb-1 text-muted-foreground">سقف پیام دوره</label>
          <input
            v-model.number="form.messageQuota"
            type="number"
            min="0"
            class="form-input font-mono"
            placeholder="خالی = نامحدود"
          />
        </div>
        <div>
          <label class="block text-xs font-semibold mb-1 text-muted-foreground">دوره ریست (ساعت)</label>
          <input
            v-model.number="form.resetHours"
            type="number"
            min="1"
            class="form-input font-mono"
          />
        </div>
      </div>

      <!-- Providers & Allowed Models Selection -->
      <div v-if="availableModels.length > 0" class="border border-border rounded-xl p-3.5 bg-accent/30 space-y-3">
        <div class="flex items-center justify-between">
          <span class="block text-xs font-bold text-foreground">ارائه‌دهندگان و مدل‌های هوش مصنوعی مجاز</span>
          <span class="text-[11px] text-muted-foreground font-mono">
            {{ form.modelIds.length }} از {{ availableModels.length }} مدل انتخاب شده
          </span>
        </div>

        <div class="space-y-3 max-h-56 overflow-y-auto pl-1">
          <div
            v-for="(models, prov) in modelsByProvider"
            :key="prov"
            class="p-2.5 rounded-lg border border-border/60 bg-card space-y-2"
          >
            <!-- Provider header with select-all toggle -->
            <div class="flex items-center justify-between border-b border-border/40 pb-1.5">
              <label class="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  class="checkbox"
                  :checked="isProviderAllSelected(prov)"
                  :indeterminate.prop="isProviderPartiallySelected(prov)"
                  @change="toggleProvider(prov)"
                />
                <span class="text-xs font-bold text-primary">{{ prov }}</span>
              </label>
              <span class="text-[10px] text-muted-foreground font-mono">
                {{ models.filter((m) => form.modelIds.includes(m.id)).length }} / {{ models.length }} مدل
              </span>
            </div>

            <!-- Provider models list -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-0.5">
              <div
                v-for="model in models"
                :key="model.id"
                class="flex items-center justify-between p-1.5 px-2 rounded-md border border-border/40 bg-accent/20 hover:bg-accent/50 cursor-pointer text-xs transition-colors"
                @click="toggleModel(model.id)"
              >
                <span class="font-medium truncate text-[11.5px]">{{ model.name }}</span>
                <input
                  type="checkbox"
                  :checked="form.modelIds.includes(model.id)"
                  class="checkbox"
                  @click.stop="toggleModel(model.id)"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Status & Default -->
      <div class="flex flex-wrap items-center justify-between gap-4 pt-2">
        <label class="flex items-center gap-2 cursor-pointer">
          <input v-model="form.isActive" type="checkbox" class="checkbox" />
          <span class="text-xs font-semibold">طرح فعال و قابل خرید باشد</span>
        </label>

        <label class="flex items-center gap-2 cursor-pointer">
          <input v-model="form.isDefault" type="checkbox" class="checkbox" />
          <span class="text-xs font-semibold text-amber-500">طرح پیش‌فرض سیستم برای کاربران عادی</span>
        </label>
      </div>

    </form>

    <template #footer>
      <div class="flex items-center justify-end gap-2.5 w-full">
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
          type="button"
          :loading="isSaving"
          :disabled="isSaving || !form.name || !form.slug"
          @click="handleSave"
        >
          {{ plan ? 'ذخیره تغییرات طرح' : 'ثبت طرح اشتراک' }}
        </BaseButton>
      </div>
    </template>
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
  transition: border-color 0.15s ease;
}

.form-input:focus {
  outline: none;
  border-color: var(--primary);
}

.checkbox {
  width: 16px;
  height: 16px;
  accent-color: var(--primary);
  cursor: pointer;
}
</style>
