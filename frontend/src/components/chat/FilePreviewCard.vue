<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { Eye, Download, ExternalLink, Copy, Check, X, Loader2 } from '@lucide/vue'
import type { FileAttachmentItem } from '../../types'
import { buildUrl } from '../../services/api'
import { fixUtf8MangledString } from '../../lib/filename'
import MarkdownContent from './MarkdownContent.vue'

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
const activeTab = ref<'preview' | 'extracted' | 'raw'>('preview')
const fetchedText = ref<string | null>(null)
const isFetchingText = ref(false)
const fetchError = ref<string | null>(null)
const isCopied = ref(false)
const pdfBlobUrl = ref<string | null>(null)

watch(
  () => props.file.id,
  () => {
    imageLoadFailed.value = false
    fetchedText.value = null
    fetchError.value = null
  },
)

watch(
  () => props.file.rawFile,
  (raw) => {
    if (raw && props.file.fileType === 'pdf') {
      if (pdfBlobUrl.value) URL.revokeObjectURL(pdfBlobUrl.value)
      pdfBlobUrl.value = URL.createObjectURL(raw)
    }
  },
  { immediate: true },
)

const fileDownloadUrl = computed(() => {
  if (props.file.id && !props.file.id.startsWith('temp-')) {
    const token = localStorage.getItem('token')
    const qs = token ? `?token=${encodeURIComponent(token)}` : ''
    return buildUrl(`/files/${props.file.id}/content${qs}`)
  }
  if (props.file.previewUrl) return props.file.previewUrl
  if (props.file.metadata?.dataUrl) return props.file.metadata.dataUrl
  return ''
})

const imageSource = computed(() => {
  if (imageLoadFailed.value) return ''
  if (props.file.previewUrl) return props.file.previewUrl
  if (props.file.metadata?.dataUrl) return props.file.metadata.dataUrl
  if (props.file.id && !props.file.id.startsWith('temp-')) {
    return fileDownloadUrl.value
  }
  return ''
})

const effectivePdfUrl = computed(() => {
  return pdfBlobUrl.value || fileDownloadUrl.value || ''
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
const displayName = computed(() => fixUtf8MangledString(props.file.originalName))
const isMarkdown = computed(() => {
  const name = displayName.value.toLowerCase()
  return name.endsWith('.md') || name.endsWith('.markdown')
})

const progress = computed(() => Math.min(100, Math.max(0, props.file.progress || 0)))

// 2 * PI * r (r = 18) => ~113
const strokeDashoffset = computed(() => {
  const circumference = 2 * Math.PI * 18
  return circumference - (circumference * progress.value) / 100
})

const hasExtractedText = computed(() => {
  return Boolean(props.file.extractedText && props.file.extractedText.trim().length > 0)
})

const displayText = computed(() => {
  return props.file.extractedText || fetchedText.value || ''
})

const isViewable = computed(() => {
  if (isUploading.value) return false
  if (props.file.fileType === 'image') {
    return Boolean(imageSource.value)
  }
  return Boolean(
    props.readOnly ||
      isReady.value ||
      hasExtractedText.value ||
      props.file.rawFile ||
      fileDownloadUrl.value,
  )
})

async function loadTextContent() {
  if (props.file.rawFile) {
    try {
      fetchedText.value = await props.file.rawFile.text()
    } catch {
      fetchError.value = 'خطا در خواندن فایل متنی محلی'
    }
    return
  }

  if (fileDownloadUrl.value && !fetchedText.value) {
    try {
      isFetchingText.value = true
      fetchError.value = null
      const res = await fetch(fileDownloadUrl.value)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      fetchedText.value = await res.text()
    } catch {
      fetchError.value = 'امکان بارگذاری مستقیم متن وجود ندارد'
    } finally {
      isFetchingText.value = false
    }
  }
}

async function openPreviewModal() {
  if (!isViewable.value) return

  if (props.file.fileType === 'pdf') {
    activeTab.value = 'preview'
  } else if (props.file.fileType === 'text') {
    activeTab.value = isMarkdown.value ? 'preview' : 'raw'
    if (!props.file.extractedText && !fetchedText.value) {
      await loadTextContent()
    }
  } else if (props.file.fileType === 'excel') {
    activeTab.value = 'extracted'
  } else {
    activeTab.value = 'preview'
  }

  isPreviewModalOpen.value = true
}

function closePreviewModal() {
  isPreviewModalOpen.value = false
  fetchError.value = null
}

async function handleCopyText() {
  if (!displayText.value) return
  try {
    await navigator.clipboard.writeText(displayText.value)
    isCopied.value = true
    setTimeout(() => {
      isCopied.value = false
    }, 2000)
  } catch (err) {
    console.error('Failed to copy text', err)
  }
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
  if (pdfBlobUrl.value) {
    URL.revokeObjectURL(pdfBlobUrl.value)
  }
})

function handleCardClick() {
  if (isViewable.value) {
    openPreviewModal()
  }
}

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
        'is-viewable': isViewable,
      },
    ]"
    :title="isViewable ? `مشاهده محتوا: ${displayName}` : displayName"
    @click="handleCardClick"
  >
    <!-- Thumbnail / Icon Area -->
    <div
      class="card-media"
      :class="{ 'cursor-zoom': isViewable }"
      :title="isViewable ? 'کلیک برای باز کردن و مشاهده فایل' : displayName"
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
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
        </div>
      </template>

      <!-- PDF Icon -->
      <template v-else-if="file.fileType === 'pdf'">
        <div class="media-icon pdf-icon">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
          <span class="type-badge">PDF</span>
        </div>
      </template>

      <!-- Excel Icon -->
      <template v-else-if="file.fileType === 'excel'">
        <div class="media-icon excel-icon">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <path d="M8 13l4 4m0-4l-4 4" />
          </svg>
          <span class="type-badge">XLS</span>
        </div>
      </template>

      <!-- Text / Markdown Icon -->
      <template v-else-if="file.fileType === 'text'">
        <div class="media-icon text-icon">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
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
          title="لغو آپلود"
          @click="handleRemoveClick"
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
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
    </div>

    <!-- Info Area (Name & Size) -->
    <div v-if="!compact" class="card-info">
      <div class="name-row">
        <span class="file-name" :title="displayName">{{ displayName }}</span>
        <span v-if="isViewable" class="view-indicator" title="مشاهده فایل">
          <Eye :size="12" />
        </span>
      </div>
      <div class="file-meta">
        <template v-if="isError">
          <span class="status-tag error" :title="file.errorMessage || 'خطا در پردازش'">خطا در پردازش</span>
          <button
            v-if="!readOnly || $attrs.onRetry"
            type="button"
            class="btn-retry-file"
            title="تلاش مجدد پردازش"
            @click.stop="handleRetryClick"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
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
      title="حذف فایل"
      @click="handleRemoveClick"
    >
      ✕
    </button>
  </div>

  <!-- Unified Lightbox / File Content Viewer Modal -->
  <Teleport to="body">
    <Transition name="fade-lightbox">
      <div
        v-if="isPreviewModalOpen"
        class="file-modal-overlay"
        @click.self="closePreviewModal"
      >
        <div
          class="file-modal-dialog"
          :class="{
            'image-mode': file.fileType === 'image',
            'doc-mode': file.fileType !== 'image',
          }"
          @click.stop
        >
          <!-- Topbar -->
          <div class="file-modal-topbar">
            <div class="topbar-info">
              <span class="file-type-badge" :class="file.fileType">
                {{ file.fileType.toUpperCase() }}
              </span>
              <span class="file-modal-title" :title="displayName">{{ displayName }}</span>
              <span class="file-modal-size">{{ formattedSize }}</span>
            </div>

            <!-- Center Tabs (for PDF with extracted text or Markdown) -->
            <div v-if="file.fileType === 'pdf' && hasExtractedText" class="modal-tabs">
              <button
                type="button"
                class="tab-btn"
                :class="{ active: activeTab === 'preview' }"
                @click="activeTab = 'preview'"
              >
                نمایش سند (PDF)
              </button>
              <button
                type="button"
                class="tab-btn"
                :class="{ active: activeTab === 'extracted' }"
                @click="activeTab = 'extracted'"
              >
                متن استخراج‌شده
              </button>
            </div>

            <div v-else-if="file.fileType === 'text' && isMarkdown" class="modal-tabs">
              <button
                type="button"
                class="tab-btn"
                :class="{ active: activeTab === 'preview' }"
                @click="activeTab = 'preview'"
              >
                پیش‌نمایش مارک‌داون
              </button>
              <button
                type="button"
                class="tab-btn"
                :class="{ active: activeTab === 'raw' }"
                @click="activeTab = 'raw'"
              >
                متن خام
              </button>
            </div>

            <!-- Right Actions: Copy / External / Download / Close -->
            <div class="topbar-actions">
              <!-- Copy Text Button (for text files or PDF extracted text) -->
              <button
                v-if="(file.fileType === 'text' && displayText) || (file.fileType === 'pdf' && activeTab === 'extracted' && props.file.extractedText)"
                type="button"
                class="modal-btn copy-btn copy-action-btn"
                :title="isCopied ? 'کپی شد!' : 'کپی متن'"
                @click="handleCopyText"
              >
                <component :is="isCopied ? Check : Copy" :size="14" :class="{ 'text-emerald-500': isCopied }" />
                <span class="action-label">{{ isCopied ? 'کپی شد' : 'کپی متن' }}</span>
              </button>

              <!-- Open in New Tab (PDF / Image) -->
              <a
                v-if="effectivePdfUrl && (file.fileType === 'pdf' || file.fileType === 'image')"
                :href="effectivePdfUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="modal-btn"
                title="باز کردن در تب جدید"
                @click.stop
              >
                <ExternalLink :size="14" />
                <span class="action-label hidden sm:inline">تب جدید</span>
              </a>

              <!-- Download Button -->
              <a
                v-if="fileDownloadUrl"
                :href="fileDownloadUrl"
                :download="displayName"
                class="modal-btn"
                title="دانلود فایل"
                @click.stop
              >
                <Download :size="14" />
                <span class="action-label hidden sm:inline">دانلود</span>
              </a>

              <!-- Close Button -->
              <button
                type="button"
                class="modal-btn close-btn"
                title="بستن (ESC)"
                @click="closePreviewModal"
              >
                <X :size="15" />
              </button>
            </div>
          </div>

          <!-- Modal Body -->
          <div class="file-modal-body">
            <!-- 1. IMAGE -->
            <template v-if="file.fileType === 'image'">
              <div class="image-viewer-container" @click="closePreviewModal">
                <img
                  :src="imageSource"
                  :alt="displayName"
                  class="lightbox-image"
                  @click.stop
                />
              </div>
            </template>

            <!-- 2. PDF -->
            <template v-else-if="file.fileType === 'pdf'">
              <!-- PDF Iframe Preview -->
              <div v-if="activeTab === 'preview'" class="pdf-container">
                <iframe
                  v-if="effectivePdfUrl"
                  :src="effectivePdfUrl"
                  class="pdf-iframe"
                  title="پیش‌نمایش PDF"
                />
                <div v-else class="empty-state">
                  <p>امکان پیش‌نمایش مستقیم این فایل PDF وجود ندارد.</p>
                  <a
                    v-if="fileDownloadUrl"
                    :href="fileDownloadUrl"
                    :download="displayName"
                    class="download-btn-primary mt-3"
                  >
                    <Download :size="14" />
                    <span>دانلود فایل PDF</span>
                  </a>
                </div>
              </div>

              <!-- Extracted Text View -->
              <div v-else-if="activeTab === 'extracted'" class="text-container">
                <div class="extracted-badge-bar">
                  <span>متن استخراج‌شده توسط هوش مصنوعی:</span>
                  <span v-if="props.file.extractedText" class="char-count">
                    {{ props.file.extractedText.length.toLocaleString('fa-IR') }} کاراکتر
                  </span>
                </div>
                <pre class="extracted-text-pre">{{ props.file.extractedText }}</pre>
              </div>
            </template>

            <!-- 3. TEXT / MARKDOWN -->
            <template v-else-if="file.fileType === 'text'">
              <!-- Loading state -->
              <div v-if="isFetchingText" class="loading-state">
                <Loader2 :size="24" class="animate-spin text-primary" />
                <span>در حال دریافت محتوای فایل متنی...</span>
              </div>

              <!-- Error state -->
              <div v-else-if="fetchError" class="error-state">
                <p>{{ fetchError }}</p>
                <a
                  v-if="fileDownloadUrl"
                  :href="fileDownloadUrl"
                  :download="displayName"
                  class="download-btn-primary mt-3"
                >
                  <Download :size="14" />
                  <span>دانلود فایل جهت مشاهده مستقیم</span>
                </a>
              </div>

              <!-- Markdown Rendered Preview -->
              <div v-else-if="isMarkdown && activeTab === 'preview'" class="markdown-container">
                <MarkdownContent :content="displayText" />
              </div>

              <!-- Plain Text / Raw View -->
              <div v-else class="text-container">
                <pre class="raw-text-pre">{{ displayText || 'فایل متنی فاقد محتوا می‌باشد.' }}</pre>
              </div>
            </template>

            <!-- 4. EXCEL -->
            <template v-else-if="file.fileType === 'excel'">
              <div class="excel-container">
                <div class="excel-info-banner">
                  <div class="excel-banner-text">
                    <strong>فایل اکسل ({{ displayName }})</strong>
                    <p>فایل شامل اطلاعات ساخت‌یافته و داده‌های جدولی است. می‌توانید داده‌های استخراج‌شده را در زیر مطالعه کرده یا فایل کامل را دانلود فرمایید.</p>
                  </div>
                  <a
                    v-if="fileDownloadUrl"
                    :href="fileDownloadUrl"
                    :download="displayName"
                    class="download-btn-primary"
                  >
                    <Download :size="14" />
                    <span>دانلود فایل اکسل</span>
                  </a>
                </div>

                <div v-if="displayText" class="excel-extracted-view">
                  <div class="extracted-badge-bar">
                    <span>خلاصه و محتوای کاربرگ‌های استخراج‌شده:</span>
                    <span class="char-count">{{ displayText.length.toLocaleString('fa-IR') }} کاراکتر</span>
                  </div>
                  <pre class="extracted-text-pre">{{ displayText }}</pre>
                </div>
                <div v-else class="empty-state">
                  <p>داده‌های متنی استخراج‌شده برای این فایل ثبت نشده است.</p>
                </div>
              </div>
            </template>
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

.file-preview-card.is-viewable {
  cursor: pointer;
}

.file-preview-card.is-viewable:hover {
  border-color: rgba(59, 130, 246, 0.45);
  background-color: var(--card-hover, rgba(30, 41, 59, 0.95));
  box-shadow: 0 4px 12px -2px rgba(0, 0, 0, 0.25);
  transform: translateY(-1px);
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

.name-row {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}

.file-name {
  font-size: 12px;
  font-weight: 500;
  color: var(--foreground, #f8fafc);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.3;
  flex: 1;
}

.view-indicator {
  display: inline-flex;
  align-items: center;
  color: var(--muted-foreground, #94a3b8);
  opacity: 0.6;
  transition: opacity 0.15s ease;
}

.file-preview-card:hover .view-indicator {
  opacity: 1;
  color: #3b82f6;
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
  cursor: pointer;
  transition: transform 0.15s ease;
}

.cursor-zoom:hover {
  filter: brightness(1.08);
}

/* =======================================================
   UNIFIED FILE PREVIEW MODAL (Teleported to Body)
   ======================================================= */
.file-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 99999;
  background-color: rgba(0, 0, 0, 0.82);
  backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  direction: rtl;
}

.file-modal-dialog {
  display: flex;
  flex-direction: column;
  background-color: var(--card, #1e293b);
  border: 1px solid var(--border, rgba(255, 255, 255, 0.12));
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
  cursor: default;
}

.file-modal-dialog.image-mode {
  background: transparent;
  border: none;
  box-shadow: none;
  max-width: 94vw;
  max-height: 94vh;
  gap: 12px;
}

.file-modal-dialog.doc-mode {
  width: 100%;
  max-width: 960px;
  height: 86vh;
  max-height: 860px;
}

.file-modal-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  background-color: var(--card, #1e293b);
  border-bottom: 1px solid var(--border, rgba(255, 255, 255, 0.1));
  gap: 12px;
  flex-wrap: wrap;
}

.file-modal-dialog.image-mode .file-modal-topbar {
  background-color: rgba(23, 23, 23, 0.85);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 12px;
  width: 100%;
}

.topbar-info {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  flex: 1;
}

.file-type-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 5px;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

.file-type-badge.pdf {
  background: rgba(239, 68, 68, 0.18);
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.35);
}

.file-type-badge.excel {
  background: rgba(34, 197, 94, 0.18);
  color: #22c55e;
  border: 1px solid rgba(34, 197, 94, 0.35);
}

.file-type-badge.text {
  background: rgba(59, 130, 246, 0.18);
  color: #3b82f6;
  border: 1px solid rgba(59, 130, 246, 0.35);
}

.file-type-badge.image {
  background: rgba(168, 85, 247, 0.18);
  color: #a855f7;
  border: 1px solid rgba(168, 85, 247, 0.35);
}

.file-modal-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--foreground, #f8fafc);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 280px;
}

.file-modal-size {
  font-size: 11px;
  color: var(--muted-foreground, #94a3b8);
  direction: ltr;
}

.modal-tabs {
  display: flex;
  align-items: center;
  gap: 4px;
  background: rgba(0, 0, 0, 0.25);
  padding: 3px;
  border-radius: 8px;
  border: 1px solid var(--border, rgba(255, 255, 255, 0.08));
}

.tab-btn {
  font-size: 11px;
  font-weight: 500;
  padding: 4px 10px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--muted-foreground, #94a3b8);
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.tab-btn:hover {
  color: var(--foreground, #f8fafc);
}

.tab-btn.active {
  background: var(--primary, #3b82f6);
  color: #ffffff;
  font-weight: 600;
}

.topbar-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.modal-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  height: 30px;
  padding: 0 9px;
  border-radius: 7px;
  background: rgba(255, 255, 255, 0.07);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: var(--foreground, #e2e8f0);
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  text-decoration: none;
  transition: all 0.15s ease;
}

.modal-btn:hover {
  background: rgba(255, 255, 255, 0.16);
  color: #ffffff;
}

.modal-btn.copied {
  background: rgba(34, 197, 94, 0.18);
  border-color: rgba(34, 197, 94, 0.4);
  color: #4ade80;
}

.modal-btn.close-btn {
  padding: 0;
  width: 30px;
  justify-content: center;
}

.modal-btn.close-btn:hover {
  background: rgba(239, 68, 68, 0.35);
  color: #f87171;
  border-color: rgba(239, 68, 68, 0.5);
}

.action-label {
  line-height: 1;
}

.file-modal-body {
  flex: 1;
  min-height: 0;
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.image-viewer-container {
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

.pdf-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: #323639;
}

.pdf-iframe {
  width: 100%;
  height: 100%;
  border: none;
  background-color: #525659;
}

.text-container,
.markdown-container,
.excel-container {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 20px;
  background-color: var(--card, #1e293b);
}

.raw-text-pre,
.extracted-text-pre {
  margin: 0;
  font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace);
  font-size: 13px;
  line-height: 1.7;
  color: var(--foreground, #f1f5f9);
  white-space: pre-wrap;
  word-break: break-word;
  direction: auto;
  text-align: start;
}

.extracted-badge-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 12px;
  margin-bottom: 14px;
  border-bottom: 1px solid var(--border, rgba(255, 255, 255, 0.08));
  font-size: 12px;
  font-weight: 500;
  color: var(--muted-foreground, #94a3b8);
}

.char-count {
  font-size: 11px;
  color: var(--muted-foreground, #94a3b8);
  direction: ltr;
}

.excel-info-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 18px;
  border-radius: 12px;
  background: rgba(34, 197, 94, 0.08);
  border: 1px solid rgba(34, 197, 94, 0.22);
  margin-bottom: 16px;
}

.excel-banner-text strong {
  display: block;
  font-size: 13px;
  color: #34d399;
  margin-bottom: 3px;
}

.excel-banner-text p {
  font-size: 11px;
  color: var(--muted-foreground, #94a3b8);
  margin: 0;
  line-height: 1.5;
}

.download-btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 8px;
  background-color: var(--primary, #3b82f6);
  color: #ffffff;
  font-size: 12px;
  font-weight: 600;
  text-decoration: none;
  white-space: nowrap;
  transition: all 0.15s ease;
}

.download-btn-primary:hover {
  filter: brightness(1.1);
  transform: translateY(-1px);
}

.loading-state,
.error-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  text-align: center;
  gap: 12px;
  color: var(--muted-foreground, #94a3b8);
  font-size: 13px;
  height: 100%;
}

.error-state {
  color: #f87171;
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

.fade-lightbox-enter-from .file-modal-dialog,
.fade-lightbox-leave-to .file-modal-dialog {
  transform: scale(0.95);
}

.fade-lightbox-enter-to .file-modal-dialog,
.fade-lightbox-leave-from .file-modal-dialog {
  transform: scale(1);
  transition: transform 0.22s cubic-bezier(0.16, 1, 0.3, 1);
}
</style>
