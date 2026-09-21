<script setup lang="ts">
import { ref, watch } from 'vue'
import AdminModal from '../AdminModal.vue'
import BaseButton from '../../ui/BaseButton.vue'
import type { Provider } from '../../../types'

const props = defineProps<{
  open: boolean
  provider?: Provider | null
  isSaving?: boolean
  labels?: Record<string, string>
}>()

const emit = defineEmits<{
  close: []
  save: [data: { name: string; baseUrl: string; apiKey?: string }]
}>()

const form = ref({
  name: '',
  baseUrl: '',
  apiKey: '',
})

watch(
  () => props.provider,
  (p) => {
    if (p) {
      form.value = {
        name: p.name,
        baseUrl: p.baseUrl || '',
        apiKey: '',
      }
    } else {
      form.value = {
        name: '',
        baseUrl: '',
        apiKey: '',
      }
    }
  },
  { immediate: true }
)

function handleSubmit() {
  if (!form.value.name.trim()) return
  emit('save', {
    name: form.value.name.trim(),
    baseUrl: form.value.baseUrl.trim(),
    apiKey: form.value.apiKey ? form.value.apiKey.trim() : undefined,
  })
}
</script>

<template>
  <AdminModal
    v-if="open"
    :eyebrow="provider ? 'ویرایش' : 'ثبت'"
    :title="provider ? 'ویرایش ارائه‌دهنده سرویس' : 'افزودن ارائه‌دهنده جدید'"
    @close="$emit('close')"
  >
    <form class="admin-form" @submit.prevent="handleSubmit">
      <div class="form-grid">
        <label class="col-span-full">
          <span class="field-label">{{ labels?.name || 'نام ارائه‌دهنده' }} <span class="req">*</span></span>
          <input v-model="form.name" required :disabled="isSaving" placeholder="مثال: OpenAI یا Anthropic یا OpenRouter" />
        </label>
        <label class="col-span-full">
          <span class="field-label">{{ labels?.baseUrl || 'آدرس پایه API (Base URL)' }}</span>
          <input v-model="form.baseUrl" class="mono" :disabled="isSaving" placeholder="مثال: https://api.openai.com/v1" />
        </label>
        <label class="col-span-full">
          <span class="field-label">{{ labels?.apiKey || 'کلید دسترسی (API Key)' }}</span>
          <input
            v-model="form.apiKey"
            type="password"
            class="mono"
            :placeholder="provider ? 'در صورت عدم تغییر، خالی بگذارید' : 'sk-...'"
            :disabled="isSaving"
          />
        </label>
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
  grid-template-columns: 1fr;
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
</style>
