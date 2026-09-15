<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useChatStore } from '../../stores/chat'
import { getTextDirection } from '../../utils/textDirection'
import MessageBubble from './MessageBubble.vue'
import MarkdownContent from './MarkdownContent.vue'
import EmptyState from './EmptyState.vue'
import ThinkingIndicator from './ThinkingIndicator.vue'

const chatStore = useChatStore()
const containerRef = ref<HTMLElement | null>(null)
const shouldFollowStream = ref(true)
const streamingDirection = computed(() => getTextDirection(chatStore.currentStreamingText))

function handleScroll() {
  const container = containerRef.value
  if (!container) return

  // ~150px threshold: if user scrolls up by more than this, respect their
  // position and stop auto-following. Generous enough that a single drag
  // up clearly breaks the follow without being triggered by micro-scrolls.
  const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight
  shouldFollowStream.value = distanceFromBottom <= 150
}

function scrollToBottom(smooth = true) {
  nextTick(() => {
    if (containerRef.value) {
      if (!smooth || typeof containerRef.value.scrollTo !== 'function') {
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
  () => [chatStore.messages.length, chatStore.currentStreamingText, chatStore.isStreaming],
  (currentState, previousState) => {
    const streamEnded = previousState?.[2] === true && currentState[2] === false

    if (!streamEnded && (!chatStore.isStreaming || shouldFollowStream.value)) {
      // During streaming use *instant* scroll: smooth-scroll animations
      // arriving on every token fight the user's wheel/touch input and
      // effectively trap them at the bottom. Outside streaming (e.g. a
      // freshly sent user prompt) we keep the smooth animation for polish.
      scrollToBottom(!chatStore.isStreaming)
    }
  },
  { flush: 'post' }
)

onMounted(() => {
  containerRef.value?.addEventListener('scroll', handleScroll, { passive: true })
  scrollToBottom(false)
})

onBeforeUnmount(() => {
  containerRef.value?.removeEventListener('scroll', handleScroll)
})
</script>

<template>
  <div ref="containerRef" class="message-list-viewport flex-1 overflow-y-auto overflow-x-hidden flex flex-col scroll-smooth">
    <div class="chat-content-wrapper message-list-content flex flex-col">
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
          <div class="avatar avatar-assistant streaming-avatar flex-shrink-0 flex items-center justify-center font-bold text-xs shadow-sm select-none mt-0.5">
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
  padding-block: clamp(1rem, 3vw, 1.5rem) 1rem;
  scroll-behavior: auto;
}

.message-list-content {
  width: 100%;
  min-height: 100%;
  padding-bottom: clamp(4rem, 6vw, 5rem);
}

.streaming-row {
  display: flex;
  width: 100%;
  gap: clamp(0.625rem, 2vw, 0.875rem);
  margin-bottom: clamp(1rem, 3vw, 1.5rem);
  animation: stream-enter 200ms ease-out;
}

.streaming-row-thinking {
  margin-top: 0;
}

@media (max-width: 767px) {
  .message-list-content {
    padding-top: clamp(3.5rem, 12vw, 4.5rem); /* Keep messages below the hamburger */
  }
}

.avatar-assistant {
  width: 32px;
  height: 32px;
  flex: 0 0 32px;
  border-radius: 50%;
  overflow: hidden;
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
