<script setup lang="ts">
import { ref, watch } from 'vue'
import AdminModal from '../AdminModal.vue'
import BaseButton from '../../ui/BaseButton.vue'
import BaseToggle from '../../ui/BaseToggle.vue'
import type { Model, Provider } from '../../../types'

import { modelsService } from '../../../services/models.service'

const props = defineProps<{
  open: boolean
  model?: Model | null
  providers: Provider[]
  isSaving?: boolean
  labels?: Record<string, string>
}>()

const emit = defineEmits<{
  close: []
  save: [data: {
    name: string
    provider: string
    providerId?: string
    apiIdentifier: string
    isActive: boolean
    supportsThinking?: boolean
    supportsVision?: boolean
    supportsDocument?: boolean
    thinkingBudgetTokens?: number
  }]
}>()

const form = ref({
  name: '',
  provider: '',
  providerId: '',
  apiIdentifier: '',
  isActive: true,
  supportsThinking: true,
  supportsVision: false,
  supportsDocument: false,
  thinkingBudgetTokens: 4096,
})

const isTesting = ref(false)
const testResult = ref<{ success: boolean; latencyMs: number; reply?: string; error?: string } | null>(null)

watch(
  () => props.model,
  (m) => {
    testResult.value = null
    if (m) {
      form.value = {
        name: m.name,
        provider: m.provider,
        providerId: m.providerId || '',
        apiIdentifier: m.apiIdentifier,
        isActive: m.isActive,
        supportsThinking: m.supportsThinking ?? true,
        supportsVision: m.supportsVision ?? false,
        supportsDocument: m.supportsDocument ?? false,
        thinkingBudgetTokens: m.thinkingBudgetTokens ?? 4096,
      }
    } else {
      form.value = {
        name: '',
        provider: props.providers[0]?.name || '',
        providerId: props.providers[0]?.id || '',
        apiIdentifier: '',
        isActive: true,
        supportsThinking: true,
        supportsVision: false,
        supportsDocument: false,
        thinkingBudgetTokens: 4096,
      }
    }
  },
  { immediate: true }
)

async function handleTestModel() {
  if (!form.value.apiIdentifier.trim()) {
    testResult.value = {
      success: false,
      latencyMs: 0,
      error: 'لطفاً ابتدا شناسه فنی مدل (API Identifier) را وارد کنید.',
    }
    return
  }
  isTesting.value = true
  testResult.value = null
  try {
    const res = await modelsService.testModel({
      modelId: props.model?.id,
      apiIdentifier: form.value.apiIdentifier.trim(),
      providerId: form.value.providerId || undefined,
      provider: form.value.provider || undefined,
    })
    testResult.value = res
  } catch (err: any) {
    testResult.value = {
      success: false,
      latencyMs: 0,
      error: err?.message || 'خطا در آزمون اتصال به مدل',
    }
  } finally {
    isTesting.value = false
  }
}

function handleSubmit() {
  if (!form.value.name.trim() || !form.value.apiIdentifier.trim()) return
  const provider =
    props.providers.find((item) => item.id === form.value.providerId) ||
    props.providers.find((item) => item.name === form.value.provider)

  emit('save', {
    name: form.value.name.trim(),
    provider: provider?.name || form.value.provider.trim(),
    providerId: provider?.id || undefined,
    apiIdentifier: form.value.apiIdentifier.trim(),
    isActive: form.value.isActive,
    supportsThinking: form.value.supportsThinking,
    supportsVision: form.value.supportsVision,
    supportsDocument: form.value.supportsDocument,
    thinkingBudgetTokens: form.value.supportsThinking ? Number(form.value.thinkingBudgetTokens) || undefined : undefined,
  })
}
</script>

<template>
  <AdminModal
    v-if="open"
    :eyebrow="model ? 'ویرایش' : 'ثبت'"
    :title="model ? 'ویرایش مدل هوش مصنوعی' : 'افزودن مدل جدید'"
    @close="$emit('close')"
  >
    <form class="admin-form" @submit.prevent="handleSubmit">
      <div class="form-grid">
        <label>
          <span class="field-label">{{ labels?.modelName || 'نام مدل' }} <span class="req">*</span></span>
          <input id="modelName" v-model="form.name" required :disabled="isSaving" placeholder="مثال: GPT-4o یا Claude 3.5 Sonnet" />
        </label>
        <label>
          <span class="field-label">{{ labels?.provider || 'ارائه‌دهنده' }}</span>
          <select v-model="form.providerId" :disabled="isSaving">
            <option v-for="provider in providers" :key="provider.id" :value="provider.id">
              {{ provider.name }}
            </option>
          </select>
        </label>
        <label class="col-span-full">
          <span class="field-label">{{ labels?.apiId || 'شناسه فنی مدل (API Identifier)' }} <span class="req">*</span></span>
          <input id="apiIdentifier" v-model="form.apiIdentifier" class="mono" required :disabled="isSaving" placeholder="مثال: gpt-4o یا claude-3-5-sonnet-20241022" />
        </label>
        <div class="toggle-label col-span-full flex items-center gap-2 cursor-pointer select-none" @click="form.isActive = !form.isActive">
          <BaseToggle :model-value="form.isActive" :disabled="isSaving" @click.stop @update:model-value="form.isActive = $event" />
          <span>مدل در پلتفرم فعال باشد</span>
        </div>

        <!-- Capabilities Section -->
        <div class="col-span-full border-t border-border pt-3 mt-1 flex flex-col gap-2.5">
          <span class="field-label font-semibold">قابلیت‌های مدل:</span>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div
              class="toggle-label border border-border/80 rounded-lg p-2 bg-secondary/20 hover:bg-secondary/40 transition-colors cursor-pointer select-none flex items-center gap-2"
              @click="form.supportsThinking = !form.supportsThinking"
            >
              <BaseToggle :model-value="form.supportsThinking" :disabled="isSaving" @click.stop @update:model-value="form.supportsThinking = $event" />
              <span class="text-xs">تفکر عمیق (Thinking)</span>
            </div>
            <div
              class="toggle-label border border-border/80 rounded-lg p-2 bg-secondary/20 hover:bg-secondary/40 transition-colors cursor-pointer select-none flex items-center gap-2"
              @click="form.supportsVision = !form.supportsVision"
            >
              <BaseToggle :model-value="form.supportsVision" :disabled="isSaving" @click.stop @update:model-value="form.supportsVision = $event" />
              <span class="text-xs">بینایی / عکس (Vision)</span>
            </div>
            <div
              class="toggle-label border border-border/80 rounded-lg p-2 bg-secondary/20 hover:bg-secondary/40 transition-colors cursor-pointer select-none flex items-center gap-2"
              @click="form.supportsDocument = !form.supportsDocument"
            >
              <BaseToggle :model-value="form.supportsDocument" :disabled="isSaving" @click.stop @update:model-value="form.supportsDocument = $event" />
              <span class="text-xs">تحلیل اسناد (Document)</span>
            </div>
          </div>

          <!-- Thinking Budget Tokens (shown if supportsThinking) -->
          <label v-if="form.supportsThinking" class="mt-1">
            <span class="field-label text-xs">سقف توکن تفکر (Thinking Budget Tokens):</span>
            <input
              id="thinkingBudgetTokens"
              v-model.number="form.thinkingBudgetTokens"
              type="number"
              min="512"
              max="65536"
              step="512"
              :disabled="isSaving"
              placeholder="مثال: 4096"
            />
          </label>
        </div>
      </div>

      <!-- Test Model Box -->
      <div class="test-model-box p-3 rounded-lg border border-border/80 bg-secondary/40 flex flex-col gap-2">
        <div class="flex items-center justify-between">
          <span class="text-xs text-muted-foreground font-medium">ارزیابی اتصال و عملکرد مدل:</span>
          <button
            type="button"
            class="test-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-background hover:bg-secondary text-foreground border border-border transition-all cursor-pointer disabled:opacity-50"
            :disabled="isTesting || isSaving || !form.apiIdentifier.trim()"
            @click="handleTestModel"
          >
            <svg v-if="isTesting" class="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            </svg>
            <svg v-else class="w-3.5 h-3.5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
            <span>{{ isTesting ? 'در حال ارسال تست...' : 'تست اتصال مدل' }}</span>
          </button>
        </div>

        <!-- Minimal Result Display -->
        <div
          v-if="testResult"
          class="test-result-inline text-xs p-2.5 rounded-md flex flex-col gap-1 border"
          :class="testResult.success ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25' : 'bg-destructive/10 text-destructive border-destructive/25'"
        >
          <div class="flex items-center gap-1.5 font-semibold">
            <span v-if="testResult.success">✓ اتصال و پاسخگویی موفق (تاخیر: {{ testResult.latencyMs }} میلی‌ثانیه)</span>
            <span v-else>✕ خطا در اتصال: {{ testResult.error }}</span>
          </div>
          <p v-if="testResult.reply" class="text-[11px] text-muted-foreground font-mono truncate" :title="testResult.reply">
            پاسخ مدل: «{{ testResult.reply }}»
          </p>
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
.toggle-label {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  font-size: 13px;
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
