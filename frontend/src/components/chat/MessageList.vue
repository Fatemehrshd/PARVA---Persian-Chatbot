<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { useChatStore } from '../../stores/chat'
import { getTextDirection } from '../../utils/textDirection'
import MessageBubble from './MessageBubble.vue'
import MarkdownContent from './MarkdownContent.vue'
import EmptyState from './EmptyState.vue'
import ThinkingIndicator from './ThinkingIndicator.vue'

const chatStore = useChatStore()
const containerRef = ref<HTMLElement | null>(null)
const streamingDirection = computed(() => getTextDirection(chatStore.currentStreamingText))

function scrollToBottom(smooth = true) {
  nextTick(() => {
    if (containerRef.value) {
      if (!smooth) {
        containerRef.value.scrollTop = containerRef.value.scrollHeight
        return
      }

      containerRef.value.scrollTo({
        top: containerRef.value.scrollHeight,
        behavior: 'smooth'
      })
    }
  })
}

watch(
  () => [chatStore.messages.length, chatStore.isStreaming],
  () => scrollToBottom(false),
  { flush: 'post' }
)

onMounted(() => {
  scrollToBottom(false)
})
</script>

<template>
  <div ref="containerRef" class="message-list-viewport flex-1 overflow-y-auto overflow-x-hidden flex flex-col py-6 scroll-smooth">
    <div class="message-list-content w-full max-w-3xl lg:max-w-4xl mx-auto px-4 sm:px-6 md:px-8 flex flex-col">
      <!-- Empty State -->
      <EmptyState v-if="chatStore.messages.length === 0 && !chatStore.isStreaming" />

      <!-- Render Existing Messages -->
      <template v-else>
        <MessageBubble
          v-for="(msg, index) in chatStore.messages"
          :key="msg.id"
          :message="msg"
          :is-last="index === chatStore.messages.length - 1"
        />

        <!-- Active Streaming Bubble (Positioned directly under user's prompt) -->
        <div
          v-if="chatStore.isStreaming"
          :class="[
            'message-row',
            'row-assistant',
            'streaming-row',
            { 'streaming-row-thinking': chatStore.isThinking }
          ]"
        >
          <!-- Assistant Avatar -->
          <div class="avatar avatar-assistant w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center font-bold text-xs shadow-sm select-none mt-0.5">
            <svg class="w-4 h-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2C6.477 2 2 6.477 2 12C2 17.523 6.477 22 12 22C17.523 22 22 17.523 22 12C22 6.477 17.523 2 12 2Z"/>
              <circle cx="9" cy="11" r="1.5" fill="currentColor"/>
              <circle cx="15" cy="11" r="1.5" fill="currentColor"/>
              <path d="M9 16C9.8 17.2 11.2 17.5 12 17.5C12.8 17.5 14.2 17.2 15 16" stroke-linecap="round"/>
            </svg>
          </div>

          <!-- Streaming Bubble Container -->
          <div class="bubble-container flex flex-col flex-1 min-w-0">
            <div 
              :class="['bubble', 'bubble-assistant', streamingDirection, 'transition-colors w-full p-1']"
              :dir="streamingDirection"
            >
              <div v-if="chatStore.currentStreamingText" class="message-text relative">
                <MarkdownContent :content="chatStore.currentStreamingText" :streaming="true" />
                <span class="streaming-cursor"></span>
              </div>
              <ThinkingIndicator v-else />
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
  scroll-behavior: auto;
}

.message-list-content {
  width: 100%;
  margin: 0 auto;
  min-height: 100%;
  padding-bottom: 48px;
}

.streaming-row {
  display: flex;
  width: 100%;
  gap: 14px;
  margin-bottom: 24px;
  animation: stream-enter 200ms ease-out;
}

.streaming-row-thinking {
  margin-top: auto;
}

@media (max-width: 767px) {
  .message-list-content {
    padding-top: 58px; /* Clearance for floating mobile hamburger button */
  }
}

.avatar-assistant {
  background-color: var(--card);
  border: 1px solid var(--border);
}

.bubble-assistant {
  background-color: transparent !important;
  background: transparent !important;
  color: var(--foreground) !important;
  border: none !important;
  box-shadow: none !important;
  padding: 4px 0 !important;
  border-radius: 0 !important;
  word-break: break-word;
}

.streaming-cursor {
  display: inline-block;
  width: 7px;
  height: 15px;
  background-color: var(--primary);
  margin-inline-start: 4px;
  vertical-align: text-bottom;
  animation: blink 0.8s infinite;
  border-radius: 2px;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

@keyframes stream-enter {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .streaming-row {
    animation: none;
  }
}
</style>
