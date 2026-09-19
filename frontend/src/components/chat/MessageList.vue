<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useChatStore } from '../../stores/chat'
import { getTextDirection } from '../../utils/textDirection'
import { useThemeLogo } from '../../composables/useThemeLogo'
import MessageBubble from './MessageBubble.vue'
import MarkdownContent from './MarkdownContent.vue'
import EmptyState from './EmptyState.vue'
import ThinkingIndicator from './ThinkingIndicator.vue'
import ThinkingBlock from './ThinkingBlock.vue'

const chatStore = useChatStore()
const { activeLogo } = useThemeLogo()

const containerRef = ref<HTMLElement | null>(null)
const contentRef = ref<HTMLElement | null>(null)
const shouldAutoScroll = ref(true)
const streamingDirection = computed(() => getTextDirection(chatStore.currentStreamingText))
const isSearching = computed(() => {
  const id = chatStore.currentConversationId
  if (!id) return false
  return chatStore.convStreamStates.get(id)?.isSearching ?? false
})
const currentConversationFlags = computed(() => {
  const id = chatStore.currentConversationId
  if (!id) return { web: false, thinking: false }
  return chatStore.getConvFlag(id)
})
const isThinkingActive = computed(() => {
  return Boolean(chatStore.isActivelyThinking || chatStore.isThinking || chatStore.currentReasoning)
})
const hasReasoningPanel = computed(() => {
  return Boolean(chatStore.currentReasoning || chatStore.isActivelyThinking)
})
const isThinkingOnly = computed(() => {
  return currentConversationFlags.value.thinking === true && currentConversationFlags.value.web !== true && isThinkingActive.value && !hasReasoningPanel.value
})
const isSearchOnly = computed(() => {
  return currentConversationFlags.value.web === true && currentConversationFlags.value.thinking !== true && isSearching.value
})
const isThinkingWithSearch = computed(() => {
  return currentConversationFlags.value.web === true &&
    currentConversationFlags.value.thinking === true &&
    isSearching.value &&
    !hasReasoningPanel.value
})

let scrollTimeout: ReturnType<typeof setTimeout> | undefined
let resizeObserver: ResizeObserver | null = null
// Last observed scrollTop — used to detect the scroll direction. Upward
// movement can only come from the user (programmatic scrolls only go down),
// so it disengages follow instantly; landing near the bottom re-engages it.
let lastScrollTop = 0

const showScrollToBottom = computed(() => {
  return !shouldAutoScroll.value && (chatStore.messages.length > 0 || chatStore.isStreaming)
})

function isNearBottom(container: HTMLElement, threshold = 120): boolean {
  const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight
  return distanceFromBottom <= threshold
}

function hasReasoningOverflow(container: HTMLElement | null): boolean {
  if (!container) return false
  if (!chatStore.isThinking || !chatStore.currentReasoning) return false
  return container.scrollHeight - container.clientHeight > 220
}

function handleScroll() {
  const container = containerRef.value
  if (!container) return

  // Any upward movement is user intent: drop follow immediately so even a
  // slow scroll inside the bottom threshold never fights the stream.
  const scrolledUp = container.scrollTop < lastScrollTop
  lastScrollTop = container.scrollTop

  const nearBottom = isNearBottom(container, 120)
  if (scrolledUp || !nearBottom) {
    shouldAutoScroll.value = false
  } else if (nearBottom) {
    shouldAutoScroll.value = true
  }

  if (scrollTimeout) {
    clearTimeout(scrollTimeout)
  }

  scrollTimeout = setTimeout(() => {
    if (container && isNearBottom(container, 120)) {
      shouldAutoScroll.value = true
    }
  }, 80)
}

function scrollToBottom(force = false) {
  const container = containerRef.value
  if (!container) return

  if (force) {
    shouldAutoScroll.value = true
  }

  const performScroll = () => {
    const currentContainer = containerRef.value
    if (!currentContainer) return
    currentContainer.scrollTop = currentContainer.scrollHeight
    lastScrollTop = currentContainer.scrollTop
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

function handleSourceToggle() {
  const container = containerRef.value
  if (!container) return

  if (shouldAutoScroll.value || isNearBottom(container, 120)) {
    nextTick(() => {
      requestAnimationFrame(() => {
        scrollToBottom(true)
      })
    })
  }
}

watch(
  () => [
    chatStore.messages.length,
    chatStore.currentStreamingText,
    chatStore.currentReasoning,
    chatStore.isStreaming,
    chatStore.isThinking,
    chatStore.currentConversationId
  ],
  (currentState, previousState) => {
    const messagesChanged = currentState[0] !== previousState?.[0]
    const streamingTextChanged = currentState[1] !== previousState?.[1]
    const reasoningChanged = currentState[2] !== previousState?.[2]
    const isCurrentlyStreaming = currentState[3]
    const isThinking = currentState[4]
    const convChanged = currentState[5] !== previousState?.[5]

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
    const wasStreaming = previousState?.[3] === true
    if (isCurrentlyStreaming && !wasStreaming) {
      shouldAutoScroll.value = true
    }

    // 3. During streaming / thinking — follow unless the user scrolled away,
    // but never force the main chat to chase the thinking panel while the model
    // is actively streaming its reasoning. The reasoning box itself remains
    // scrollable and decides its own follow behavior.
    if (isCurrentlyStreaming && (streamingTextChanged || reasoningChanged || isThinking)) {
      if (shouldAutoScroll.value) {
        scrollToBottom(false)
      }
    }
  },
  { flush: 'post' }
)

watch(
  () => chatStore.messages.map((msg) => [
    msg.id,
    msg.role,
    msg.content,
    msg.sources?.length ?? 0,
    msg.searchFailed ? 1 : 0,
    msg.isInterrupted ? 1 : 0,
    msg.stoppedByUser ? 1 : 0,
  ].join(':')).join('|'),
  () => {
    const container = containerRef.value
    if (!container) return

    const lastMsg = chatStore.messages[chatStore.messages.length - 1]
    const hasRenderedSources = !!lastMsg && !lastMsg.isInterrupted && !lastMsg.stoppedByUser && (!!lastMsg.sources?.length || !!lastMsg.searchFailed)

    if (!hasRenderedSources || (!shouldAutoScroll.value && !isNearBottom(container, 120))) {
      return
    }

    nextTick(() => {
      requestAnimationFrame(() => {
        if (shouldAutoScroll.value || isNearBottom(container, 120)) {
          scrollToBottom(true)
        }
      })
    })
  },
  { flush: 'post' }
)

watch(
  () => chatStore.isLoadingMessages,
  (isLoading, wasLoading) => {
    if (wasLoading && !isLoading && chatStore.messages.length > 0) {
      scrollToBottom(true)
    }
  },
  { flush: 'post' }
)

onMounted(() => {
  const container = containerRef.value
  if (container) {
    container.addEventListener('scroll', handleScroll, { passive: true })
    scrollToBottom(true)
  }

  // Observe content wrapper resize to handle dynamic markdown and image loading
  if (typeof ResizeObserver !== 'undefined' && contentRef.value) {
    resizeObserver = new ResizeObserver(() => {
      const c = containerRef.value
      if (!c) return
      if (shouldAutoScroll.value) {
        c.scrollTop = c.scrollHeight
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
    container.removeEventListener('scroll', handleScroll)
  }
})
</script>

<template>
  <div class="message-list-wrapper relative flex-1 flex flex-col min-h-0 overflow-hidden">
    <div ref="containerRef" class="message-list-viewport flex-1 overflow-y-auto overflow-x-hidden flex flex-col">
      <div ref="contentRef" class="chat-content-wrapper message-list-content flex flex-col">
        <!-- Branded Loading State with Site Logo when Opening/Switching Chat -->
        <div v-if="chatStore.isLoadingMessages || (chatStore.isLoadingConversations && chatStore.messages.length === 0)" class="chat-branded-loader">
          <div class="loader-logo-wrap">
            <div class="loader-logo-pulse"></div>
            <img :src="activeLogo" alt="پروا" class="loader-logo-img" />
          </div>
          <div class="loader-text-wrap">
            <span class="loader-title">پروا</span>
            <span class="loader-subtitle">در حال بارگذاری گفتگو...</span>
          </div>
        </div>

        <!-- Empty State -->
        <EmptyState v-else-if="chatStore.messages.length === 0 && !chatStore.isStreaming" />

        <!-- Render Existing Messages -->
        <template v-else>
          <MessageBubble
            v-for="(msg, index) in chatStore.messages"
            :key="msg.id"
            :message="msg"
            :is-last="index === chatStore.messages.length - 1"
            @source-toggle="handleSourceToggle"
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
                <!-- Thinking Block if reasoning is streaming or complete -->
                <ThinkingBlock
                  v-if="chatStore.currentReasoning || chatStore.isActivelyThinking"
                  :reasoning="chatStore.currentReasoning"
                  :is-thinking="chatStore.isActivelyThinking"
                  :duration-ms="chatStore.thinkingDurationMs"
                  class="mb-3"
                />

                <div v-if="chatStore.currentStreamingText" class="message-text relative">
                  <MarkdownContent :content="chatStore.currentStreamingText" :streaming="true" />
                </div>
                <ThinkingIndicator v-else-if="isThinkingWithSearch" :show-text="true" text="درحال تفکر و جستجو" />
                <ThinkingIndicator v-else-if="isSearchOnly" :show-text="true" text="درحال جستجو" />
                <ThinkingIndicator v-else-if="isThinkingOnly" :show-text="true" text="درحال تفکر" />
                <ThinkingIndicator v-else :show-text="false" />
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

/* ─── Branded Site Logo Loader ───────────────────────────────────────────── */
.chat-branded-loader {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 50vh;
  gap: 1.25rem;
  animation: fadeIn 250ms ease-out;
  user-select: none;
}

.loader-logo-wrap {
  position: relative;
  width: 72px;
  height: 72px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.loader-logo-pulse {
  position: absolute;
  inset: -8px;
  border-radius: 22px;
  background: radial-gradient(circle, color-mix(in srgb, var(--primary) 35%, transparent) 0%, transparent 72%);
  animation: pulse-glow 2.2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

.loader-logo-img {
  width: 56px;
  height: 56px;
  object-fit: contain;
  position: relative;
  z-index: 1;
  filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.08));
}

.loader-text-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
}

.loader-title {
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--foreground);
  letter-spacing: -0.02em;
}

.loader-subtitle {
  font-size: 0.825rem;
  color: var(--muted-foreground);
  animation: pulse-text 1.6s ease-in-out infinite;
}

@keyframes pulse-glow {
  0%, 100% {
    transform: scale(0.92);
    opacity: 0.45;
  }
  50% {
    transform: scale(1.18);
    opacity: 0.9;
  }
}

@keyframes pulse-text {
  0%, 100% {
    opacity: 0.6;
  }
  50% {
    opacity: 1;
  }
}
</style>
