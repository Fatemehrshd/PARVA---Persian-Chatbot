<script setup lang="ts">
import { computed } from 'vue'
import type { FileAttachmentItem } from '../../types'

const props = defineProps<{
  file: FileAttachmentItem
  readOnly?: boolean
  compact?: boolean
}>()

const emit = defineEmits<{
  (e: 'remove', file: FileAttachmentItem): void
  (e: 'retry', file: FileAttachmentItem): void
}>()

const formattedSize = computed(() => {
  const bytes = props.file.fileSize || 0
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
})

const isUploading = computed(() => props.file.status === 'uploading')
const isProcessing = computed(() => props.file.status === 'processing')
const isError = computed(() => props.file.status === 'error')
const isReady = computed(() => props.file.status === 'ready')

const progress = computed(() => Math.min(100, Math.max(0, props.file.progress || 0)))

// 2 * PI * r (r = 18) => ~113
const strokeDashoffset = computed(() => {
  const circumference = 2 * Math.PI * 18
  return circumference - (circumference * progress.value) / 100
})

function handleRemoveClick(e: MouseEvent) {
  e.stopPropagation()
  emit('remove', props.file)
}

function handleRetryClick(e: MouseEvent) {
  e.stopPropagation()
  emit('retry', props.file)
}
</script>

<template>
  <div
    :class="[
      'file-preview-card',
      file.fileType,
      {
        uploading: isUploading,
        processing: isProcessing,
        error: isError,
        ready: isReady,
        compact: compact,
      },
    ]"
    :title="file.originalName"
  >
    <!-- Thumbnail / Icon Area -->
    <div class="card-media">
      <!-- Image Thumbnail -->
      <template v-if="file.fileType === 'image'">
        <img
          v-if="file.previewUrl"
          :src="file.previewUrl"
          :alt="file.originalName"
          class="image-thumb"
        />
        <div v-else class="media-icon image-icon">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
        </div>
      </template>

      <!-- PDF Icon -->
      <template v-else-if="file.fileType === 'pdf'">
        <div class="media-icon pdf-icon">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
            <polyline points="10 9 9 9 8 9"/>
          </svg>
          <span class="type-badge">PDF</span>
        </div>
      </template>

      <!-- Excel Icon -->
      <template v-else-if="file.fileType === 'excel'">
        <div class="media-icon excel-icon">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <path d="M8 13l4 4m0-4l-4 4"/>
          </svg>
          <span class="type-badge">XLS</span>
        </div>
      </template>

      <!-- Skeleton Shimmer when uploading -->
      <div v-if="isUploading" class="upload-skeleton"></div>

      <!-- Circular Progress with '×' inside during upload -->
      <div v-if="isUploading" class="circular-progress-overlay">
        <svg class="progress-ring" width="44" height="44" viewBox="0 0 44 44">
          <circle
            class="progress-ring-bg"
            stroke="rgba(255, 255, 255, 0.2)"
            stroke-width="3"
            fill="transparent"
            r="18"
            cx="22"
            cy="22"
          />
          <circle
            class="progress-ring-circle"
            stroke="#3b82f6"
            stroke-width="3"
            stroke-linecap="round"
            fill="transparent"
            r="18"
            cx="22"
            cy="22"
            :style="{ strokeDasharray: `${2 * Math.PI * 18}`, strokeDashoffset: `${strokeDashoffset}` }"
          />
        </svg>
        <button
          type="button"
          class="btn-cancel-circle"
          @click="handleRemoveClick"
          title="لغو آپلود"
        >
          ✕
        </button>
      </div>
    </div>

    <!-- Info Area (Name & Size) -->
    <div class="card-info" v-if="!compact">
      <span class="file-name" :title="file.originalName">{{ file.originalName }}</span>
      <div class="file-meta">
        <span class="file-size">{{ formattedSize }}</span>
        <span v-if="isProcessing" class="status-tag processing">در حال پردازش...</span>
        <span v-else-if="isError" class="status-tag error">خطا در پردازش</span>
      </div>
    </div>

    <!-- Error State Overlay / Actions -->
    <div v-if="isError && !readOnly" class="error-action-row">
      <button
        type="button"
        class="btn-retry-file"
        @click="handleRetryClick"
        title="تلاش مجدد پردازش"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="23 4 23 10 17 10"/>
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
        </svg>
        تلاش مجدد
      </button>
    </div>

    <!-- Remove '×' Button (visible when not uploading and not readOnly) -->
    <button
      v-if="!isUploading && !readOnly"
      type="button"
      class="btn-remove-corner"
      @click="handleRemoveClick"
      title="حذف فایل"
    >
      ✕
    </button>
  </div>
</template>

<style scoped>
.file-preview-card {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background-color: var(--card, #1e293b);
  border: 1px solid var(--border, rgba(255, 255, 255, 0.1));
  border-radius: 10px;
  min-width: 140px;
  max-width: 220px;
  height: 52px;
  user-select: none;
  direction: rtl;
  transition: all 0.2s ease;
  overflow: hidden;
}

.file-preview-card.uploading {
  opacity: 0.82;
}

.file-preview-card.error {
  border-color: rgba(239, 68, 68, 0.5);
  background-color: rgba(239, 68, 68, 0.08);
}

.file-preview-card.compact {
  min-width: 48px;
  max-width: 48px;
  height: 48px;
  padding: 0;
  justify-content: center;
}

.card-media {
  position: relative;
  width: 38px;
  height: 38px;
  border-radius: 6px;
  background-color: rgba(255, 255, 255, 0.05);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
}

.image-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 6px;
}

.media-icon {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
}

.pdf-icon {
  color: #ef4444;
}

.excel-icon {
  color: #10b981;
}

.type-badge {
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  margin-top: -2px;
}

.upload-skeleton {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0) 0%,
    rgba(255, 255, 255, 0.15) 50%,
    rgba(255, 255, 255, 0) 100%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

@keyframes shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

.circular-progress-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(1px);
  display: flex;
  align-items: center;
  justify-content: center;
}

.progress-ring {
  transform: rotate(-90deg);
}

.progress-ring-circle {
  transition: stroke-dashoffset 0.25s ease;
}

.btn-cancel-circle {
  position: absolute;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: transparent;
  color: #fff;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  cursor: pointer;
  transition: transform 0.15s ease;
}

.btn-cancel-circle:hover {
  transform: scale(1.15);
}

.card-info {
  display: flex;
  flex-direction: column;
  justify-content: center;
  overflow: hidden;
  flex: 1;
  min-width: 0;
}

.file-name {
  font-size: 12px;
  font-weight: 500;
  color: var(--foreground, #f8fafc);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.file-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
  color: var(--muted-foreground, #94a3b8);
}

.status-tag {
  font-size: 9px;
  border-radius: 3px;
  padding: 1px 4px;
}

.status-tag.processing {
  color: #3b82f6;
}

.status-tag.error {
  color: #ef4444;
}

.btn-remove-corner {
  position: absolute;
  top: 4px;
  inset-inline-start: 4px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background-color: rgba(0, 0, 0, 0.4);
  color: #cbd5e1;
  border: none;
  font-size: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  opacity: 0.7;
  transition: all 0.15s ease;
}

.btn-remove-corner:hover {
  opacity: 1;
  background-color: #ef4444;
  color: white;
}

.error-action-row {
  position: absolute;
  bottom: 4px;
  inset-inline-end: 4px;
}

.btn-retry-file {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 9px;
  background-color: rgba(239, 68, 68, 0.2);
  color: #f87171;
  border: 1px solid rgba(239, 68, 68, 0.4);
  border-radius: 4px;
  padding: 1px 5px;
  cursor: pointer;
}

.btn-retry-file:hover {
  background-color: rgba(239, 68, 68, 0.35);
}
</style>
