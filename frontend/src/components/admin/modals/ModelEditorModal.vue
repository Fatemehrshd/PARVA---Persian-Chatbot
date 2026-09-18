<script setup lang="ts">
import { ref, watch } from 'vue'
import AdminModal from '../AdminModal.vue'
import BaseButton from '../../ui/BaseButton.vue'
import BaseToggle from '../../ui/BaseToggle.vue'
import type { Model, Provider } from '../../../types'

const props = defineProps<{
  open: boolean
  model?: Model | null
  providers: Provider[]
  isSaving?: boolean
  labels?: Record<string, string>
}>()

const emit = defineEmits<{
  close: []
  save: [data: { name: string; provider: string; providerId?: string; apiIdentifier: string; isActive: boolean }]
}>()

const form = ref({
  name: '',
  provider: '',
  providerId: '',
  apiIdentifier: '',
  isActive: true,
})

watch(
  () => props.model,
  (m) => {
    if (m) {
      form.value = {
        name: m.name,
        provider: m.provider,
        providerId: m.providerId || '',
        apiIdentifier: m.apiIdentifier,
        isActive: m.isActive,
      }
    } else {
      form.value = {
        name: '',
        provider: props.providers[0]?.name || '',
        providerId: props.providers[0]?.id || '',
        apiIdentifier: '',
        isActive: true,
      }
    }
  },
  { immediate: true }
)

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
        <label class="toggle-label col-span-full">
          <BaseToggle v-model="form.isActive" :disabled="isSaving" />
          <span>مدل در پلتفرم فعال باشد</span>
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
