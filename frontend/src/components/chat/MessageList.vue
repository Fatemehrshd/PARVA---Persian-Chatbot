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
const contentRef = ref<HTMLElement | null>(null)
const shouldAutoScroll = ref(true)
const isUserScrolling = ref(false)
const streamingDirection = computed(() => getTextDirection(chatStore.currentStreamingText))

let scrollTimeout: ReturnType<typeof setTimeout> | undefined
let resizeObserver: ResizeObserver | null = null

const showScrollToBottom = computed(() => {
  return !shouldAutoScroll.value && (chatStore.messages.length > 0 || chatStore.isStreaming)
})

function isNearBottom(container: HTMLElement, threshold = 120): boolean {
  const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight
  return distanceFromBottom <= threshold
}

function handleUserInteraction() {
  // User initiated manual scroll (wheel / touch)
  isUserScrolling.value = true
}

function handleScroll() {
  const container = containerRef.value
  if (!container) return

  // Synchronously evaluate if user is near bottom
  const nearBottom = isNearBottom(container, 120)
  shouldAutoScroll.value = nearBottom

  if (scrollTimeout) {
    clearTimeout(scrollTimeout)
  }
  
  scrollTimeout = setTimeout(() => {
    isUserScrolling.value = false
    if (container) {
      shouldAutoScroll.value = isNearBottom(container, 120)
    }
  }, 80)
}

function scrollToBottom(force = false) {
  if (force) {
    shouldAutoScroll.value = true
    isUserScrolling.value = false
  }

  const performScroll = () => {
    const container = containerRef.value
    if (!container) return
    container.scrollTop = container.scrollHeight
  }

  // Pass 1: Next microtask (Vue DOM update)
  nextTick(() => {
    performScroll()

    // Pass 2: Layout & reflow animation frame
    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(() => {
        performScroll()
        // Pass 3: Micro-delays for markdown / syntax highlighting / KaTeX layout expansion
        setTimeout(() => {
          if (force || shouldAutoScroll.value) {
            performScroll()
          }
        }, 50)
        setTimeout(() => {
          if (force || shouldAutoScroll.value) {
            performScroll()
          }
        }, 150)
      })
    }
  })
}

function handleScrollToBottomClick() {
  shouldAutoScroll.value = true
  isUserScrolling.value = false
  const container = containerRef.value
  if (!container) return
  container.scrollTo({
    top: container.scrollHeight,
    behavior: 'smooth'
  })
  setTimeout(() => {
    scrollToBottom(true)
  }, 250)
}

watch(
  () => [
    chatStore.messages.length,
    chatStore.currentStreamingText,
    chatStore.isStreaming,
    chatStore.isThinking,
    chatStore.currentConversationId
  ],
  (currentState, previousState) => {
    const messagesChanged = currentState[0] !== previousState?.[0]
    const streamingTextChanged = currentState[1] !== previousState?.[1]
    const isCurrentlyStreaming = currentState[2]
    const isThinking = currentState[3]
    const convChanged = currentState[4] !== previousState?.[4]

    // 1. Conversation switched -> always jump to bottom
    if (convChanged) {
      scrollToBottom(true)
      return
    }

    // 2. New message added to conversation
    if (messagesChanged) {
      const lastMsg = chatStore.messages[chatStore.messages.length - 1]
      // If user sent a message or if auto-scroll was active, force jump to bottom
      if (lastMsg?.role === 'user' || shouldAutoScroll.value) {
        scrollToBottom(true)
      }
      return
    }

    // 2b. Streaming just started — reset auto-scroll so user sees the response
    const wasStreaming = previousState?.[2] === true
    if (isCurrentlyStreaming && !wasStreaming) {
      shouldAutoScroll.value = true
      isUserScrolling.value = false
    }

    // 3. During streaming / thinking
    if (isCurrentlyStreaming && (streamingTextChanged || isThinking)) {
      // اگر کاربر دستی اسکرول نکرده، همیشه follow کن
      if (!isUserScrolling.value) {
        if (!shouldAutoScroll.value) {
          // بررسی کن آیا واقعاً کاربر پایین است یا فقط flag اشتباه است
          const container = containerRef.value
          if (container && isNearBottom(container, 120)) {
            shouldAutoScroll.value = true
          }
        }
        if (shouldAutoScroll.value) {
          scrollToBottom(false)
        }
      }
    }
  },
  { flush: 'post' }
)

onMounted(() => {
  const container = containerRef.value
  if (container) {
    container.addEventListener('wheel', handleUserInteraction, { passive: true })
    container.addEventListener('touchstart', handleUserInteraction, { passive: true })
    container.addEventListener('scroll', handleScroll, { passive: true })
    scrollToBottom(true)
  }

  // Observe content wrapper resize to handle dynamic markdown and image loading
  if (typeof ResizeObserver !== 'undefined' && contentRef.value) {
    resizeObserver = new ResizeObserver(() => {
      if (shouldAutoScroll.value && !isUserScrolling.value) {
        const c = containerRef.value
        if (c) {
          c.scrollTop = c.scrollHeight
        }
      }
    })
    resizeObserver.observe(contentRef.value)
  }
})

onBeforeUnmount(() => {
  if (scrollTimeout) {
    clearTimeout(scrollTimeout)
  }
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
  const container = containerRef.value
  if (container) {
    container.removeEventListener('wheel', handleUserInteraction)
    container.removeEventListener('touchstart', handleUserInteraction)
    container.removeEventListener('scroll', handleScroll)
  }
})
</script>

<template>
  <div class="message-list-wrapper relative flex-1 flex flex-col min-h-0 overflow-hidden">
    <div ref="containerRef" class="message-list-viewport flex-1 overflow-y-auto overflow-x-hidden flex flex-col">
      <div ref="contentRef" class="chat-content-wrapper message-list-content flex flex-col">
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

    <!-- Floating Scroll To Bottom Button -->
    <Transition name="scroll-btn-fade">
      <button
        v-if="showScrollToBottom"
        type="button"
        class="scroll-to-bottom-btn"
        @click="handleScrollToBottomClick"
        title="رفتن به پایین‌ترین پیام"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
        <span v-if="chatStore.isStreaming" class="streaming-indicator-pulse"></span>
      </button>
    </Transition>
  </div>
</template>

<style scoped>
.message-list-wrapper {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.message-list-viewport {
  flex: 1;
  min-height: 0;
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
  padding-bottom: clamp(8rem, 16vh, 12rem);
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

.scroll-to-bottom-btn {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 25;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background-color: var(--card);
  border: 1px solid var(--border);
  color: var(--foreground);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(10px);
  transition: all 180ms ease;
}

.scroll-to-bottom-btn:hover {
  background-color: var(--secondary);
  border-color: var(--muted-foreground);
  transform: translateX(-50%) translateY(-2px);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4);
}

.scroll-to-bottom-btn:active {
  transform: translateX(-50%) translateY(0);
}

.streaming-indicator-pulse {
  position: absolute;
  top: 3px;
  right: 3px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: var(--primary);
  box-shadow: 0 0 6px var(--primary);
  animation: pulse-badge 1.5s infinite;
}

@keyframes pulse-badge {
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.3);
    opacity: 0.6;
  }
}

.scroll-btn-fade-enter-active,
.scroll-btn-fade-leave-active {
  transition: opacity 200ms ease, transform 200ms ease;
}

.scroll-btn-fade-enter-from,
.scroll-btn-fade-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(8px);
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
