<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue'
import { useChatStore } from '../../stores/chat'
import { useModelsStore } from '../../stores/models'
import { useUiStore } from '../../stores/ui'
import { getTextDirection } from '../../utils/textDirection'

const chatStore = useChatStore()
const modelsStore = useModelsStore()
const uiStore = useUiStore()

const inputContent = ref('')
const inputDirection = computed(() => getTextDirection(inputContent.value, uiStore.direction))
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const isFocused = ref(false)
const modelMenuOpen = ref(false)
const modelPickerRef = ref<HTMLElement | null>(null)

const canSend = computed(() => {
  return inputContent.value.trim().length > 0 && !chatStore.isStreaming
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
  adjustHeight()
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
      err?.message || (uiStore.direction === 'rtl' ? 'خطا در تغییر مدل گفتگو' : 'Failed to switch model'),
      'error'
    )
  }
}

function handleClickOutside(event: MouseEvent) {
  if (modelPickerRef.value && !modelPickerRef.value.contains(event.target as Node)) {
    modelMenuOpen.value = false
  }
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
      <div :class="['composer-card', { focused: isFocused }]">
        <textarea
          ref="textareaRef"
          v-model="inputContent"
          :class="['composer-textarea', inputDirection]"
          :dir="inputDirection"
          :placeholder="uiStore.direction === 'rtl' ? 'پیام خود را بنویسید... (Enter برای ارسال)' : 'Type a message... (Enter to send)'"
          rows="1"
          @focus="isFocused = true"
          @blur="isFocused = false"
          @input="handleInput"
          @keydown="handleKeydown"
        ></textarea>

        <div class="composer-footer">
          <!-- Model Picker Dropdown inside Chat Form -->
          <div class="model-picker-container" ref="modelPickerRef" @click.stop>
            <button
              type="button"
              class="model-badge-btn"
              @click="toggleModelMenu"
              :title="uiStore.direction === 'rtl' ? 'تغییر مدل هوش مصنوعی' : 'Change AI Model'"
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
                {{ uiStore.direction === 'rtl' ? 'انتخاب مدل هوش مصنوعی' : 'SELECT AI MODEL' }}
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
              title="Stop generation"
            >
              <span class="stop-square"></span>
            </button>
            <button
              v-else
              class="btn-send"
              :disabled="!canSend"
              @click="handleSubmit"
              title="Send message"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 19V5M12 5L5 12M12 5L19 12" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      <p class="disclaimer">
        {{ uiStore.direction === 'rtl'
          ? 'سامانه پروا ممکن است خطا داشته باشد. اطلاعات مهم را ارزیابی کنید.'
          : 'Parva can make mistakes. Verify important information.'
        }}
      </p>
    </div>
  </div>
</template>

<style scoped>
.composer-outer {
  width: 100%;
  padding: 0 16px 16px;
  background: linear-gradient(180deg, transparent 0%, var(--background) 25%);
}

.composer-container {
  display: flex;
  flex-direction: column;
  align-items: center;
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
