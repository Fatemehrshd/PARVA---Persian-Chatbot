<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import { useChatStore } from '../../stores/chat'
import { useModelsStore } from '../../stores/models'
import { useUiStore } from '../../stores/ui'

const chatStore = useChatStore()
const modelsStore = useModelsStore()
const uiStore = useUiStore()

const inputContent = ref('')
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const isFocused = ref(false)

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

function handleStop() {
  chatStore.stopStreaming()
}
</script>

<template>
  <div class="composer-outer">
    <div class="composer-container">
      <div :class="['composer-card', { focused: isFocused }]">
        <textarea
          ref="textareaRef"
          v-model="inputContent"
          class="composer-textarea"
          :placeholder="uiStore.direction === 'rtl' ? 'پیام خود را بنویسید... (Enter برای ارسال)' : 'Type a message... (Enter to send)'"
          rows="1"
          @focus="isFocused = true"
          @blur="isFocused = false"
          @input="handleInput"
          @keydown="handleKeydown"
        ></textarea>

        <div class="composer-footer">
          <!-- Model Chip selector -->
          <div class="model-badge">
            <span class="model-dot"></span>
            <span class="model-name">{{ modelsStore.selectedModel.name }}</span>
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
          ? 'سامانه NeuralChat ممکن است خطا داشته باشد. اطلاعات مهم را ارزیابی کنید.'
          : 'NeuralChat can make mistakes. Verify important information.'
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
  width: 100%;
  max-width: 672px;
  margin: 0 auto;
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

.model-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  background-color: var(--secondary);
  border-radius: var(--radius-sm);
  font-size: 11px;
  font-family: var(--font-mono);
  color: var(--secondary-foreground);
}

.model-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: var(--primary);
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
  color: var(--foreground);
  display: flex;
  align-items: center;
  justify-content: center;
}

.stop-square {
  width: 10px;
  height: 10px;
  border-radius: 2px;
  background-color: var(--primary);
}

.disclaimer {
  font-size: 11px;
  color: var(--muted-foreground);
  margin-top: 8px;
  text-align: center;
}
</style>
