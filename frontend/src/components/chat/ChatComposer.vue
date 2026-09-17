<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useChatStore } from '../../stores/chat'
import { useModelsStore } from '../../stores/models'
import { useUiStore } from '../../stores/ui'
import { getActiveTypingDirection } from '../../utils/textDirection'

const chatStore = useChatStore()
const modelsStore = useModelsStore()
const uiStore = useUiStore()

const inputContent = ref('')
const inputDirection = ref<'rtl' | 'ltr'>('rtl')
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const isFocused = ref(false)
const modelMenuOpen = ref(false)
const modelPickerRef = ref<HTMLElement | null>(null)

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
    handleSubmit()
  }
}

function handleSubmit() {
  if (!canSend.value) return
  const text = inputContent.value
  inputContent.value = ''
  inputDirection.value = 'rtl'
  if (textareaRef.value) {
    textareaRef.value.style.height = 'auto'
  }
  chatStore.sendMessage(text)
}

const selectableModels = computed(() => {
  return modelsStore.activeModels.length > 0 ? modelsStore.activeModels : modelsStore.models
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

      <div :class="['composer-card', { focused: isFocused }]">
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
        ></textarea>

        <div class="composer-footer">
          <!-- Model Picker Dropdown inside Chat Form -->
          <div class="model-picker-container" ref="modelPickerRef" @click.stop>
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
                    <span class="model-option-name">{{ model.name }}</span>
                    <span class="model-option-meta font-mono">{{ model.provider }} • {{ model.apiIdentifier }}</span>
                  </div>
                  <span v-if="model.id === modelsStore.selectedModelId" class="check-mark">✓</span>
                </button>
              </div>
            </div>
          </div>

          <!-- Action Button: Stop or Send -->
          <div class="action-buttons">
            <button
              v-if="chatStore.isStreaming"
              class="btn-stop"
              @click="handleStop"
              title="توقف پاسخ"
            >
              <span class="stop-square"></span>
            </button>
            <button
              v-else
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
  padding: 0 0 16px;
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
