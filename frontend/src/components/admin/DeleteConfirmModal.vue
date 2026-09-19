<script setup lang="ts">
import { computed } from 'vue'
import AdminModal from './AdminModal.vue'
import BaseButton from '../ui/BaseButton.vue'

const props = withDefaults(
  defineProps<{
    open: boolean
    title?: string
    message?: string
    description?: string
    itemName?: string
    loading?: boolean
    isLoading?: boolean
    confirmText?: string
    cancelText?: string
    eyebrow?: string
  }>(),
  {
    title: 'تایید عملیات حذف',
    message: '',
    description: '',
    itemName: '',
    loading: false,
    isLoading: false,
    confirmText: 'تایید و حذف',
    cancelText: 'انصراف',
    eyebrow: 'هشدار',
  }
)

defineEmits<{
  confirm: []
  close: []
}>()

const computedMessage = computed(() => {
  return props.message || props.description || 'آیا از انجام این عملیات اطمینان دارید؟ این عمل غیرقابل بازگشت است.'
})

const computedLoading = computed(() => {
  return props.loading || props.isLoading
})
</script>

<template>
  <AdminModal v-if="open" :eyebrow="eyebrow" :title="title" @close="$emit('close')">
    <div class="delete-modal-content" dir="rtl">
      <div class="delete-icon-wrap">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          <line x1="10" y1="11" x2="10" y2="17" />
          <line x1="14" y1="11" x2="14" y2="17" />
        </svg>
      </div>

      <div class="delete-text">
        <p class="delete-message">{{ computedMessage }}</p>
        <p v-if="itemName" class="delete-item-name">«{{ itemName }}»</p>
      </div>

      <div class="delete-actions">
        <BaseButton variant="ghost" size="md" :disabled="computedLoading" type="button" @click="$emit('close')">
          {{ cancelText }}
        </BaseButton>
        <BaseButton variant="danger" size="md" :loading="computedLoading" :disabled="computedLoading" type="button" @click="$emit('confirm')">
          {{ confirmText }}
        </BaseButton>
      </div>
    </div>
  </AdminModal>
</template>

<style scoped>
.delete-modal-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 18px;
  padding: 8px 4px 4px;
}

.delete-icon-wrap {
  width: 54px;
  height: 54px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: color-mix(in srgb, var(--destructive) 15%, transparent);
  color: var(--destructive);
}

.delete-text {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.delete-message {
  margin: 0;
  font-size: 14.5px;
  color: var(--muted-foreground);
  line-height: 1.6;
}

.delete-item-name {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--foreground);
}

.delete-actions {
  display: flex;
  width: 100%;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 8px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
}

@media (max-width: 480px) {
  .delete-actions {
    flex-direction: column-reverse;
  }

  .delete-actions :deep(.base-button),
  .delete-actions > * {
    width: 100%;
  }
}
</style>
