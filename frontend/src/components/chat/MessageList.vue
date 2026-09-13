<script setup lang="ts">
import { ref, watch, nextTick, onMounted } from 'vue'
import { useChatStore } from '../../stores/chat'
import MessageBubble from './MessageBubble.vue'
import EmptyState from './EmptyState.vue'
import ThinkingIndicator from './ThinkingIndicator.vue'

const chatStore = useChatStore()
const containerRef = ref<HTMLElement | null>(null)

function scrollToBottom(smooth = true) {
  nextTick(() => {
    if (containerRef.value) {
      containerRef.value.scrollTo({
        top: containerRef.value.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto'
      })
    }
  })
}

// Watch for new messages or incoming stream tokens
watch(
  () => [chatStore.messages.length, chatStore.currentStreamingText],
  () => {
    scrollToBottom()
  },
  { deep: true }
)

onMounted(() => {
  scrollToBottom(false)
})
</script>

<template>
  <div ref="containerRef" class="message-list-viewport">
    <div class="message-list-content">
      <!-- Empty State -->
      <EmptyState v-if="chatStore.messages.length === 0 && !chatStore.isStreaming" />

      <!-- Render Existing Messages -->
      <template v-else>
        <MessageBubble
          v-for="msg in chatStore.messages"
          :key="msg.id"
          :message="msg"
        />

        <!-- Active Streaming Bubble -->
        <div v-if="chatStore.isStreaming" class="message-row row-assistant">
          <div class="avatar avatar-assistant">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2C6.477 2 2 6.477 2 12C2 17.523 6.477 22 12 22C17.523 22 22 17.523 22 12C22 6.477 17.523 2 12 2Z" stroke="var(--primary)" stroke-width="2"/>
              <circle cx="9" cy="11" r="1.5" fill="var(--primary)"/>
              <circle cx="15" cy="11" r="1.5" fill="var(--primary)"/>
              <path d="M9 16C9.8 17.2 11.2 17.5 12 17.5C12.8 17.5 14.2 17.2 15 16" stroke="var(--primary)" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </div>
          <div class="bubble-container">
            <div class="bubble bubble-assistant">
              <div v-if="chatStore.currentStreamingText" class="message-text">
                {{ chatStore.currentStreamingText }}
                <span class="streaming-cursor"></span>
              </div>
              <ThinkingIndicator v-else-if="chatStore.isThinking" />
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.message-list-viewport {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
  padding: 24px 0 16px;
  scroll-behavior: smooth;
}

.message-list-content {
  width: 100%;
  max-width: 672px;
  margin: 0 auto;
  padding: 0 16px;
  display: flex;
  flex-direction: column;
}

.message-row {
  display: flex;
  gap: 12px;
  margin-bottom: 24px;
  width: 100%;
}

.avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--card);
  border: 1px solid var(--border);
}

.bubble-container {
  display: flex;
  flex-direction: column;
  max-width: 82%;
  align-items: flex-start;
}

.bubble {
  padding: 12px 16px;
  font-size: 14px;
  line-height: 1.6;
  background-color: var(--card);
  color: var(--card-foreground);
  border: 1px solid var(--border);
  border-radius: 18px 18px 18px 4px;
  word-break: break-word;
  white-space: pre-wrap;
}

.streaming-cursor {
  display: inline-block;
  width: 6px;
  height: 14px;
  background-color: var(--primary);
  margin-inline-start: 2px;
  vertical-align: middle;
  animation: blink 0.8s infinite;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}
</style>
