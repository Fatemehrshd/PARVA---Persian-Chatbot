<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import type { FileAttachmentItem } from '../../types'
import { buildUrl } from '../../services/api'

const props = defineProps<{
  file: FileAttachmentItem
  readOnly?: boolean
  compact?: boolean
}>()

const emit = defineEmits<{
  (e: 'remove', file: FileAttachmentItem): void
  (e: 'retry', file: FileAttachmentItem): void
}>()

const isPreviewModalOpen = ref(false)
const imageLoadFailed = ref(false)

watch(() => props.file.id, () => {
  imageLoadFailed.value = false
})

const imageSource = computed(() => {
  if (imageLoadFailed.value) return ''
  if (props.file.previewUrl) return props.file.previewUrl
  if (props.file.metadata?.dataUrl) return props.file.metadata.dataUrl
  if (props.file.id && !props.file.id.startsWith('temp-')) {
    const token = localStorage.getItem('token')
    const qs = token ? `?token=${encodeURIComponent(token)}` : ''
    return buildUrl(`/files/${props.file.id}/content${qs}`)
  }
  return ''
})

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
const isMarkdown = computed(() => {
  const name = props.file.originalName?.toLowerCase() || ''
  return name.endsWith('.md') || name.endsWith('.markdown')
})

const progress = computed(() => Math.min(100, Math.max(0, props.file.progress || 0)))

// 2 * PI * r (r = 18) => ~113
const strokeDashoffset = computed(() => {
  const circumference = 2 * Math.PI * 18
  return circumference - (circumference * progress.value) / 100
})

function openPreviewModal() {
  if (imageSource.value) {
    isPreviewModalOpen.value = true
  }
}

function closePreviewModal() {
  isPreviewModalOpen.value = false
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && isPreviewModalOpen.value) {
    closePreviewModal()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
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
    <div
      class="card-media"
      :class="{ 'cursor-zoom': file.fileType === 'image' && imageSource && !isUploading }"
      @click="file.fileType === 'image' && imageSource && !isUploading ? openPreviewModal() : undefined"
      :title="file.fileType === 'image' && imageSource && !isUploading ? 'کلیک برای بزرگ‌نمایی تصویر' : file.originalName"
    >
      <!-- Image Thumbnail -->
      <template v-if="file.fileType === 'image'">
        <img
          v-if="imageSource && !imageLoadFailed"
          :src="imageSource"
          alt=""
          class="image-thumb"
          @error="imageLoadFailed = true"
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

      <!-- Text / Markdown Icon -->
      <template v-else-if="file.fileType === 'text'">
        <div class="media-icon text-icon">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
            <polyline points="10 9 9 9 8 9"/>
          </svg>
          <span class="type-badge">{{ isMarkdown ? 'MD' : 'TXT' }}</span>
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

      <!-- Processing Spinner Overlay -->
      <div v-if="isProcessing" class="processing-overlay">
        <svg class="spinner-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="3">
          <circle cx="12" cy="12" r="9" stroke="rgba(59, 130, 246, 0.25)" />
          <path d="M12 3a9 9 0 0 1 9 9" stroke-linecap="round" />
        </svg>
      </div>

      <!-- Ready Check Badge -->
      <div v-if="isReady && !compact" class="ready-badge" title="آماده ارسال">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      </div>

      <!-- Error Exclamation Badge -->
      <div v-if="isError && !compact" class="error-badge" :title="file.errorMessage || 'خطا در پردازش'">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
      </div>
    </div>

    <!-- Info Area (Name & Size) -->
    <div class="card-info" v-if="!compact">
      <span class="file-name" :title="file.originalName">{{ file.originalName }}</span>
      <div class="file-meta">
        <template v-if="isError">
          <span class="status-tag error" :title="file.errorMessage || 'خطا در پردازش'">خطا در پردازش</span>
          <button
            v-if="!readOnly || $attrs.onRetry"
            type="button"
            class="btn-retry-file"
            @click.stop="handleRetryClick"
            title="تلاش مجدد پردازش"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline points="23 4 23 10 17 10"/>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
            </svg>
            <span>تلاش مجدد</span>
          </button>
        </template>
        <template v-else>
          <span class="file-size">{{ formattedSize }}</span>
          <span v-if="isProcessing" class="status-tag processing">در حال پردازش...</span>
        </template>
      </div>
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

  <!-- Minimal & Smooth Image Preview Lightbox -->
  <Teleport to="body">
    <Transition name="fade-lightbox">
      <div
        v-if="isPreviewModalOpen"
        class="image-lightbox-overlay"
        @click.self="closePreviewModal"
      >
        <div class="lightbox-dialog" @click.stop>
          <!-- Top bar -->
          <div class="lightbox-topbar">
            <div class="lightbox-info">
              <span class="lightbox-title">{{ file.originalName }}</span>
              <span class="lightbox-size">{{ formattedSize }}</span>
            </div>
            <div class="lightbox-actions">
              <a
                v-if="imageSource"
                :href="imageSource"
                :download="file.originalName"
                class="lightbox-btn"
                title="دانلود تصویر"
                @click.stop
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
              </a>
              <button
                type="button"
                class="lightbox-btn close-btn"
                @click="closePreviewModal"
                title="بستن (ESC)"
              >
                ✕
              </button>
            </div>
          </div>

          <!-- Image Frame -->
          <div class="lightbox-body" @click="closePreviewModal">
            <img
              :src="imageSource"
              :alt="file.originalName"
              class="lightbox-image"
              @click.stop
            />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
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
  max-width: 240px;
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
  border-color: rgba(239, 68, 68, 0.45);
  background-color: rgba(239, 68, 68, 0.08);
  min-width: 180px;
}

.file-preview-card.error .file-name {
  color: #fca5a5;
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

.text-icon {
  color: #3b82f6;
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

.processing-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(1px);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
}

.spinner-icon {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.ready-badge {
  position: absolute;
  bottom: 2px;
  inset-inline-end: 2px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: rgba(34, 197, 94, 0.2);
  border: 1px solid rgba(34, 197, 94, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
}

.card-info {
  display: flex;
  flex-direction: column;
  justify-content: center;
  overflow: hidden;
  flex: 1;
  min-width: 0;
  gap: 2px;
}

.file-name {
  font-size: 12px;
  font-weight: 500;
  color: var(--foreground, #f8fafc);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.3;
}

.file-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
  color: var(--muted-foreground, #94a3b8);
  min-width: 0;
  line-height: 1.2;
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
  background-color: rgba(239, 68, 68, 0.12);
  padding: 1px 5px;
  border-radius: 4px;
  font-weight: 500;
  white-space: nowrap;
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

.btn-retry-file {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 9px;
  font-weight: 500;
  background-color: rgba(239, 68, 68, 0.18);
  color: #f87171;
  border: 1px solid rgba(239, 68, 68, 0.45);
  border-radius: 4px;
  padding: 1px 6px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s ease;
  line-height: 1.3;
}

.btn-retry-file:hover {
  background-color: rgba(239, 68, 68, 0.3);
  border-color: rgba(239, 68, 68, 0.7);
  color: #ffffff;
}

.error-badge {
  position: absolute;
  bottom: 2px;
  inset-inline-end: 2px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: rgba(239, 68, 68, 0.2);
  border: 1px solid rgba(239, 68, 68, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
}

.cursor-zoom {
  cursor: zoom-in;
  transition: transform 0.15s ease;
}

.cursor-zoom:hover {
  filter: brightness(1.05);
}

/* =======================================================
   IMAGE LIGHTBOX MODAL (Teleported to Body)
   ======================================================= */
.image-lightbox-overlay {
  position: fixed;
  inset: 0;
  z-index: 99999;
  background-color: rgba(0, 0, 0, 0.78);
  backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  cursor: zoom-out;
}

.lightbox-dialog {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  max-width: 92vw;
  max-height: 92vh;
  cursor: default;
}

.lightbox-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 6px 14px;
  background-color: rgba(23, 23, 23, 0.75);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  direction: rtl;
}

.lightbox-info {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #f8fafc;
  font-size: 13px;
  font-weight: 500;
  overflow: hidden;
}

.lightbox-title {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 320px;
}

.lightbox-size {
  font-size: 11px;
  color: #94a3b8;
  direction: ltr;
}

.lightbox-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.lightbox-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #e2e8f0;
  cursor: pointer;
  text-decoration: none;
  transition: all 0.15s ease;
}

.lightbox-btn:hover {
  background: rgba(255, 255, 255, 0.18);
  color: #fff;
  transform: scale(1.05);
}

.lightbox-btn.close-btn {
  font-size: 14px;
}

.lightbox-btn.close-btn:hover {
  background: rgba(239, 68, 68, 0.35);
  color: #f87171;
  border-color: rgba(239, 68, 68, 0.5);
}

.lightbox-body {
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  max-width: 100%;
  max-height: calc(90vh - 60px);
}

.lightbox-image {
  max-width: 90vw;
  max-height: calc(88vh - 60px);
  object-fit: contain;
  border-radius: 12px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.08);
  user-select: none;
}

/* Transitions */
.fade-lightbox-enter-active,
.fade-lightbox-leave-active {
  transition: all 0.22s cubic-bezier(0.16, 1, 0.3, 1);
}

.fade-lightbox-enter-from,
.fade-lightbox-leave-to {
  opacity: 0;
}

.fade-lightbox-enter-from .lightbox-dialog,
.fade-lightbox-leave-to .lightbox-dialog {
  transform: scale(0.94);
}

.fade-lightbox-enter-to .lightbox-dialog,
.fade-lightbox-leave-from .lightbox-dialog {
  transform: scale(1);
  transition: transform 0.22s cubic-bezier(0.16, 1, 0.3, 1);
}
</style>
