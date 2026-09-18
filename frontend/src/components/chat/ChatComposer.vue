<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useChatStore } from '../../stores/chat'
import { useModelsStore } from '../../stores/models'
import { useUiStore } from '../../stores/ui'
import { getActiveTypingDirection } from '../../utils/textDirection'
import { useFileUpload } from '../../composables/useFileUpload'
import FilePreviewCard from './FilePreviewCard.vue'
import BaseToggle from '../ui/BaseToggle.vue'

const chatStore = useChatStore()
const modelsStore = useModelsStore()
const uiStore = useUiStore()

const inputContent = ref('')
const inputDirection = ref<'rtl' | 'ltr'>('rtl')
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const isFocused = ref(false)
const modelMenuOpen = ref(false)
const modelPickerRef = ref<HTMLElement | null>(null)

// ─── File Upload Composable ──────────────────────────────────────────────────
const {
  attachedFiles,
  limits,
  isDraggingOver,
  hasUploadingFiles,
  hasErrorFiles,
  waitForUploads,
  addFiles,
  removeFile,
  retryFile,
  clearAttachedFiles,
  handleDragOver,
  handleDragLeave,
  handleDrop,
} = useFileUpload(() => chatStore.currentConversationId)

if (typeof window !== 'undefined') {
  ;(window as any).__ATTACHED_FILES__ = attachedFiles
}

const attachmentMenuOpen = ref(false)
const attachmentMenuRef = ref<HTMLElement | null>(null)
const imageInputRef = ref<HTMLInputElement | null>(null)
const docInputRef = ref<HTMLInputElement | null>(null)

const isGenerating = computed(() => chatStore.isStreaming || chatStore.isThinking)

function toggleAttachmentMenu() {
  if (isGenerating.value) {
    uiStore.showToast('در حال دریافت پاسخ، امکان پیوست فایل وجود ندارد', 'warning')
    return
  }
  if (attachedFiles.value.length >= limits.value.maxFileCount) {
    uiStore.showToast(`حداکثر ${limits.value.maxFileCount} فایل می‌توانید انتخاب کنید`, 'error')
    return
  }
  attachmentMenuOpen.value = !attachmentMenuOpen.value
}

function pickImages() {
  if (isGenerating.value) {
    uiStore.showToast('در حال دریافت پاسخ، امکان پیوست فایل وجود ندارد', 'warning')
    return
  }
  attachmentMenuOpen.value = false
  imageInputRef.value?.click()
}

function pickDocuments() {
  if (isGenerating.value) {
    uiStore.showToast('در حال دریافت پاسخ، امکان پیوست فایل وجود ندارد', 'warning')
    return
  }
  attachmentMenuOpen.value = false
  docInputRef.value?.click()
}

// ─── Per-conversation feature flags (web search / thinking) ────────────────
const activeConvId = computed(() => chatStore.currentConversationId ?? '__new__')

function toggleWebSearch() {
  const cur = chatStore.getConvFlag(activeConvId.value).web
  chatStore.setConvFlag(activeConvId.value, { web: !cur })
  attachmentMenuOpen.value = false
}

function handleImageChange(e: Event) {
  const target = e.target as HTMLInputElement
  if (isGenerating.value) {
    uiStore.showToast('در حال دریافت پاسخ، امکان پیوست فایل وجود ندارد', 'warning')
    target.value = ''
    return
  }
  if (target.files && target.files.length > 0) {
    const files = Array.from(target.files)
    const nonImages = files.filter((f) => {
      const name = f.name.toLowerCase()
      const isImg = f.type.startsWith('image/') || /\.(jpg|jpeg|jfif|png|webp|gif|svg)$/i.test(name)
      return !isImg
    })

    if (nonImages.length > 0) {
      uiStore.showToast(
        `فایل «${nonImages[0].name}» تصویر نیست. در این بخش فقط فایل‌های عکس (PNG, JPG, JPEG, JFIF, WEBP, GIF, SVG) مجاز هستند.`,
        'error',
      )
      target.value = ''
      return
    }

    addFiles(files)
    target.value = ''
  }
}

function handleDocChange(e: Event) {
  const target = e.target as HTMLInputElement
  if (isGenerating.value) {
    uiStore.showToast('در حال دریافت پاسخ، امکان پیوست فایل وجود ندارد', 'warning')
    target.value = ''
    return
  }
  if (target.files && target.files.length > 0) {
    const files = Array.from(target.files)
    const nonDocs = files.filter((f) => {
      const name = f.name.toLowerCase()
      const isDoc =
        /\.(pdf|xlsx|xls|csv|txt|md|text|markdown)$/i.test(name) ||
        f.type === 'application/pdf' ||
        f.type.includes('spreadsheet') ||
        f.type.includes('excel') ||
        f.type.includes('csv') ||
        f.type.startsWith('text/')
      return !isDoc
    })

    if (nonDocs.length > 0) {
      uiStore.showToast(
        `فایل «${nonDocs[0].name}» سند مجاز نیست. تنها اسناد متنی (TXT, MD)، اسناد PDF و اکسل (XLSX, XLS, CSV) مجاز هستند.`,
        'error',
      )
      target.value = ''
      return
    }

    addFiles(files)
    target.value = ''
  }
}

function handlePaste(e: ClipboardEvent) {
  if (e.clipboardData && e.clipboardData.files && e.clipboardData.files.length > 0) {
    if (isGenerating.value) {
      e.preventDefault()
      uiStore.showToast('در حال دریافت پاسخ، امکان پیوست فایل وجود ندارد', 'warning')
      return
    }
    const files = Array.from(e.clipboardData.files)
    addFiles(files)
  }
}

function onDragOver(e: DragEvent) {
  if (isGenerating.value) return
  handleDragOver(e)
}

function onDrop(e: DragEvent) {
  if (isGenerating.value) {
    e.preventDefault()
    uiStore.showToast('در حال دریافت پاسخ، امکان پیوست فایل وجود ندارد', 'warning')
    return
  }
  handleDrop(e)
}

function updateDirection() {
  inputDirection.value = getActiveTypingDirection(
    inputContent.value,
    textareaRef.value ? textareaRef.value.selectionStart : null,
    'rtl'
  )
}

watch(inputContent, (newVal) => {
  if (!newVal || !newVal.trim()) {
    inputDirection.value = 'rtl'
  } else {
    updateDirection()
  }
})

// پاک کردن input هنگام سوئیچ conversation
watch(
  () => chatStore.currentConversationId,
  () => {
    inputContent.value = ''
    inputDirection.value = 'rtl'
    if (textareaRef.value) {
      textareaRef.value.style.height = 'auto'
    }
  }
)

const canSend = computed(() => {
  return inputContent.value.trim().length > 0 && !chatStore.isStreaming && !chatStore.isTokenLimitExceeded
})

function adjustHeight() {
  nextTick(() => {
    if (textareaRef.value) {
      textareaRef.value.style.height = 'auto'
      const newHeight = Math.min(Math.max(textareaRef.value.scrollHeight, 24), 180)
      textareaRef.value.style.height = `${newHeight}px`
    }
  })
}

function handleInput() {
  updateDirection()
  adjustHeight()
}

function handleCursorMove() {
  updateDirection()
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    if (isGenerating.value) return
    handleSubmit()
  }
}

async function handleSubmit() {
  if (!canSend.value || isGenerating.value) return

  // If in-flight file byte uploads are active, wait for completion
  if (hasUploadingFiles.value) {
    const finished = await waitForUploads()
    if (!finished || hasErrorFiles.value) {
      uiStore.showToast('لطفاً تا اتمام آپلود فایل‌ها منتظر بمانید', 'warning')
      return
    }
  }

  const text = inputContent.value
  const files = [...attachedFiles.value]
  inputContent.value = ''
  inputDirection.value = 'rtl'
  clearAttachedFiles()
  if (textareaRef.value) {
    textareaRef.value.style.height = 'auto'
  }
  chatStore.sendMessage(text, files, { useWebSearch: chatStore.getConvFlag(activeConvId.value).web })
}

const selectableModels = computed(() => {
  const list = modelsStore.activeModels.length > 0 ? modelsStore.activeModels : modelsStore.models
  // Platform default always on top; the rest keeps its order (stable sort).
  return [...list].sort((a, b) => Number(b.isDefault ?? false) - Number(a.isDefault ?? false))
})

function handleStop() {
  chatStore.stopStreaming()
}

function toggleModelMenu() {
  modelMenuOpen.value = !modelMenuOpen.value
}

async function selectModel(id: string) {
  modelMenuOpen.value = false
  try {
    await chatStore.switchConversationModel(id)
  } catch (err: any) {
    uiStore.showToast(
      err?.message || 'خطا در تغییر مدل گفتگو',
      'error'
    )
  }
}

function handleClickOutside(event: MouseEvent) {
  if (modelPickerRef.value && !modelPickerRef.value.contains(event.target as Node)) {
    modelMenuOpen.value = false
  }
  if (attachmentMenuRef.value && !attachmentMenuRef.value.contains(event.target as Node)) {
    attachmentMenuOpen.value = false
  }
}

async function handleRetry() {
  await chatStore.retryLastMessage()
}

onMounted(() => {
  window.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  window.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <div class="composer-outer">
    <div class="chat-content-wrapper composer-container">
      <!-- Token Limit Banner -->
      <div
        v-if="chatStore.isTokenLimitExceeded"
        class="stream-error-banner stream-error-banner--limit"
        role="alert"
      >
        <div class="stream-error-content">
          <svg class="stream-error-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <span class="stream-error-text">سقف مجاز مصرف توکن به پایان رسیده است. امکان ارسال پیام جدید وجود ندارد. لطفاً با مدیر سامانه تماس بگیرید.</span>
        </div>
        <div class="stream-error-actions">
          <button
            type="button"
            class="stream-error-dismiss-btn"
            @click.stop.prevent="chatStore.clearStreamError"
            title="بستن"
          >
            ✕
          </button>
        </div>
      </div>

      <!-- Transient Stream Error Alert (clears on refresh, new conversation or retry) -->
      <div
        v-else-if="chatStore.streamError && !chatStore.isStreaming"
        class="stream-error-banner"
      >
        <div class="stream-error-content">
          <svg class="stream-error-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <span class="stream-error-text">{{ chatStore.streamError }}</span>
        </div>
        <div class="stream-error-actions">
          <button
            type="button"
            class="stream-error-retry-btn"
            @click.stop.prevent="handleRetry"
          >
            تلاش مجدد
          </button>
          <button
            type="button"
            class="stream-error-dismiss-btn"
            @click.stop.prevent="chatStore.clearStreamError"
            title="بستن"
          >
            ✕
          </button>
        </div>
      </div>

      <!-- Hidden file inputs -->
      <input
        ref="imageInputRef"
        type="file"
        accept="image/png,image/jpeg,image/pjpeg,image/webp,image/gif,image/svg+xml,.png,.jpg,.jpeg,.jfif,.webp,.gif,.svg"
        multiple
        style="display: none"
        @change="handleImageChange"
      />
      <input
        ref="docInputRef"
        type="file"
        accept=".pdf,.xlsx,.xls,.csv,.txt,.md,.text,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,text/plain,text/markdown"
        multiple
        style="display: none"
        @change="handleDocChange"
      />

      <div
        :class="['composer-card', { focused: isFocused, 'drag-over': isDraggingOver && !isGenerating }]"
        @dragover="onDragOver"
        @dragleave="handleDragLeave"
        @drop="onDrop"
      >
        <!-- Drag & Drop Overlay -->
        <div v-if="isDraggingOver && !isGenerating" class="dropzone-overlay">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          <span>فایل‌ها را اینجا رها کنید (عکس، PDF، اکسل، متن و Markdown)</span>
        </div>

        <!-- Attached Files Preview Row -->
        <div v-if="attachedFiles.length > 0" class="composer-attachments">
          <FilePreviewCard
            v-for="file in attachedFiles"
            :key="file.id"
            :file="file"
            @remove="removeFile(file)"
            @retry="retryFile(file)"
          />
        </div>

        <textarea
          ref="textareaRef"
          v-model="inputContent"
          :class="['composer-textarea', inputDirection]"
          :dir="inputDirection"
          :placeholder="chatStore.isTokenLimitExceeded ? 'سقف مجاز مصرف توکن شما به پایان رسیده است' : 'پیام خود را بنویسید... (Enter برای ارسال)'"
          :disabled="chatStore.isTokenLimitExceeded"
          rows="1"
          @focus="isFocused = true; updateDirection()"
          @blur="isFocused = false"
          @input="handleInput"
          @keydown="handleKeydown"
          @keyup="handleCursorMove"
          @click="handleCursorMove"
          @select="handleCursorMove"
          @paste="handlePaste"
        ></textarea>

        <div class="composer-footer">
          <div class="composer-footer-start">
            <!-- Plus Attachment Button with Menu -->
            <div class="attachment-picker-container" ref="attachmentMenuRef" @click.stop>
              <button
                type="button"
                class="attachment-btn"
                @click="toggleAttachmentMenu"
                title="پیوست فایل"
                :disabled="isGenerating || attachedFiles.length >= limits.maxFileCount"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
              </button>

              <!-- Attachment Dropdown Popover -->
              <div v-if="attachmentMenuOpen" class="attachment-dropdown">
                <button type="button" class="attachment-menu-item" @click="pickImages">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <polyline points="21 15 16 10 5 21"/>
                  </svg>
                  <span>عکس</span>
                </button>
                <button type="button" class="attachment-menu-item" @click="pickDocuments">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                  </svg>
                  <span>اسناد</span>
                </button>
                <button
                  type="button"
                  class="attachment-menu-item"
                  data-testid="toggle-web-search"
                  :class="chatStore.getConvFlag(activeConvId).web ? 'bg-primary/10 text-primary' : ''"
                  @click="toggleWebSearch"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="2" y1="12" x2="22" y2="12"/>
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                  </svg>
                  <span>جستجوی وب</span>
                  <BaseToggle
                    size="sm"
                    :modelValue="chatStore.getConvFlag(activeConvId).web"
                    @click.stop
                    @update:modelValue="toggleWebSearch"
                  />
                </button>
              </div>
            </div>

            <!-- Model Picker Dropdown inside Chat Form -->
            <div class="model-picker-container flex items-center gap-1.5" ref="modelPickerRef" @click.stop>
              <button
                type="button"
                class="model-badge-btn"
                @click="toggleModelMenu"
                title="تغییر مدل هوش مصنوعی"
              >
                <span class="model-dot"></span>
                <span class="model-name">{{ modelsStore.selectedModel.name }}</span>
                <svg class="chevron-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline :points="modelMenuOpen ? '6 15 12 9 18 15' : '18 15 12 9 6 15'"></polyline>
                </svg>
              </button>
              <button
                type="button"
                data-testid="modelbar-search-toggle"
                class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors"
                :class="chatStore.getConvFlag(activeConvId).web ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'"
                :title="chatStore.getConvFlag(activeConvId).web ? 'جستجوی وب فعال است — کلیک برای غیرفعال‌سازی' : 'فعال‌سازی جستجوی وب'"
                @click="toggleWebSearch"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="2" y1="12" x2="22" y2="12"/>
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                </svg>
              </button>

              <!-- Dropdown Popover opening upward -->
              <div v-if="modelMenuOpen" class="composer-model-dropdown">
                <div class="dropdown-header font-mono">
                  انتخاب مدل هوش مصنوعی
                </div>
                <div class="model-options-list">
                  <button
                    v-for="model in selectableModels"
                    :key="model.id"
                    type="button"
                    :class="['model-option-btn', { active: model.id === modelsStore.selectedModelId }]"
                    @click="selectModel(model.id)"
                  >
                    <div class="model-option-info">
                      <span class="flex items-center gap-1.5">
                        <span class="model-option-name">{{ model.name }}</span>
                        <span
                          v-if="model.isDefault"
                          class="rounded-md border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary"
                        >پیش‌فرض</span>
                      </span>
                      <span class="model-option-meta font-mono">{{ model.provider }} • {{ model.apiIdentifier }}</span>
                    </div>
                    <span v-if="model.id === modelsStore.selectedModelId" class="check-mark">✓</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Action Button: Stop or Send (Queueing disabled while streaming) -->
          <div class="action-buttons">
            <button
              v-if="isGenerating"
              type="button"
              class="btn-stop"
              @click="handleStop"
              title="توقف پاسخ"
            >
              <span class="stop-square"></span>
            </button>
            <button
              v-else
              type="button"
              class="btn-send"
              :disabled="!canSend"
              @click="handleSubmit"
              title="ارسال پیام"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 19V5M12 5L5 12M12 5L19 12" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      <p class="disclaimer">
        سامانه پروا ممکن است خطا داشته باشد. اطلاعات مهم را ارزیابی کنید.
      </p>
    </div>
  </div>
</template>

<style scoped>
.composer-outer {
  width: 100%;
  /* Guaranteed visual gap between the transcript (meta-bar / streaming line)
     and the input box, regardless of scroll position. */
  padding: 14px 0 16px;
  background: linear-gradient(180deg, transparent 0%, var(--background) 25%);
}

.composer-container {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stream-error-banner {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 14px;
  margin-bottom: 8px;
  background-color: rgba(239, 68, 68, 0.12);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: var(--radius-md, 10px);
  color: #ef4444;
  font-size: 12px;
  animation: fadeIn 200ms ease-out;
}

.stream-error-banner--limit {
  background-color: rgba(245, 158, 11, 0.12);
  border-color: rgba(245, 158, 11, 0.35);
  color: #d97706;
}

:global(.dark) .stream-error-banner--limit {
  background-color: rgba(245, 158, 11, 0.16);
  border-color: rgba(245, 158, 11, 0.4);
  color: #fbbf24;
}

.stream-error-content {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.stream-error-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.stream-error-text {
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.stream-error-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.stream-error-retry-btn {
  background-color: #ef4444;
  color: #ffffff;
  border: none;
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 150ms;
}

.stream-error-retry-btn:hover {
  opacity: 0.9;
}

.stream-error-dismiss-btn {
  background: transparent;
  border: none;
  color: #ef4444;
  padding: 4px 6px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  line-height: 1;
  transition: background-color 150ms;
}

.stream-error-dismiss-btn:hover {
  background-color: rgba(239, 68, 68, 0.2);
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.composer-card {
  width: 100%;
  background-color: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 12px 14px 10px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
  transition: border-color 150ms ease, box-shadow 150ms ease;
  position: relative;
}

.composer-card.drag-over {
  border-color: var(--primary);
  border-style: dashed;
  background-color: rgba(124, 106, 247, 0.05);
}

.dropzone-overlay {
  position: absolute;
  inset: 0;
  border-radius: var(--radius-lg);
  background: var(--card);
  opacity: 0.95;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--primary);
  font-weight: 500;
  font-size: 13px;
  z-index: 50;
  pointer-events: none;
}

.composer-attachments {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;
  max-height: 180px;
  overflow-y: auto;
  padding: 2px;
}

.composer-footer-start {
  display: flex;
  align-items: center;
  gap: 6px;
}

.attachment-picker-container {
  position: relative;
}

.attachment-btn {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background-color: var(--secondary);
  border: 1px solid var(--border);
  color: var(--secondary-foreground);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 150ms ease;
}

.attachment-btn:hover:not(:disabled) {
  background-color: var(--card);
  color: var(--foreground);
  border-color: var(--muted-foreground);
}

.attachment-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.attachment-dropdown {
  position: absolute;
  bottom: calc(100% + 8px);
  inset-inline-start: 0;
  width: 170px;
  background-color: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
  padding: 4px;
  z-index: 100;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.attachment-menu-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  border: none;
  background: transparent;
  color: var(--foreground);
  font-size: 12px;
  cursor: pointer;
  transition: background-color 150ms ease;
  text-align: inherit;
}

.attachment-menu-item:hover {
  background-color: var(--secondary);
}

.composer-card.focused {
  border-color: var(--ring);
  box-shadow: 0 0 0 1px var(--ring), 0 4px 20px rgba(124, 106, 247, 0.15);
}

.composer-textarea {
  width: 100%;
  border: none;
  background: transparent;
  color: var(--foreground);
  font-size: 14px;
  line-height: 1.5;
  resize: none;
  outline: none;
  min-height: 24px;
  max-height: 180px;
  padding: 0;
  transition: text-align 100ms ease;
}

.composer-textarea.rtl,
.composer-textarea[dir="rtl"] {
  direction: rtl;
  text-align: right;
}

.composer-textarea.ltr,
.composer-textarea[dir="ltr"] {
  direction: ltr;
  text-align: left;
}

.composer-textarea::placeholder {
  color: var(--muted-foreground);
}

.composer-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
  padding-top: 4px;
}

.model-picker-container {
  position: relative;
}

.model-badge-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  background-color: var(--secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: 11px;
  font-family: var(--font-mono);
  color: var(--secondary-foreground);
  cursor: pointer;
  transition: all 150ms ease;
}

.model-badge-btn:hover {
  background-color: var(--card);
  color: var(--foreground);
  border-color: var(--muted-foreground);
}

.model-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: var(--primary);
  flex-shrink: 0;
}

.chevron-icon {
  color: var(--muted-foreground);
}

.composer-model-dropdown {
  position: absolute;
  bottom: calc(100% + 8px);
  inset-inline-start: 0;
  width: 260px;
  background-color: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
  padding: 6px;
  z-index: 100;
}

.dropdown-header {
  font-size: 10px;
  color: var(--muted-foreground);
  padding: 6px 10px 4px;
}

.model-options-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 220px;
  overflow-y: auto;
}

.model-option-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  text-align: inherit;
  cursor: pointer;
  border: none;
  background: transparent;
  transition: background-color 150ms ease;
}

.model-option-btn:hover,
.model-option-btn.active {
  background-color: var(--secondary);
}

.model-option-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  text-align: inherit;
}

.model-option-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--foreground);
}

.model-option-meta {
  font-size: 11px;
  color: var(--muted-foreground);
}

.check-mark {
  color: var(--primary);
  font-weight: bold;
}

.action-buttons {
  display: flex;
  align-items: center;
}

.btn-send {
  width: 32px;
  height: 32px;
  border-radius: 10px;
  background-color: var(--primary);
  color: var(--primary-foreground);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 150ms ease;
}

.btn-send:disabled {
  background-color: var(--secondary);
  color: var(--muted-foreground);
  cursor: not-allowed;
  opacity: 0.6;
}

.btn-stop {
  width: 32px;
  height: 32px;
  border-radius: 10px;
  background-color: var(--secondary);
  border: 1px solid var(--border);
  border: none;
  color: var(--foreground);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 150ms ease;
}

.btn-stop:hover {
  background-color: rgba(239, 68, 68, 0.15);
}

.btn-stop:hover .stop-square {
  background-color: #ef4444;
}

.stop-square {
  width: 10px;
  height: 10px;
  border-radius: 2px;
  background-color: var(--primary);
  transition: background-color 150ms ease;
}

.disclaimer {
  font-size: 11px;
  color: var(--muted-foreground);
  margin-top: 8px;
  text-align: center;
}
</style>
