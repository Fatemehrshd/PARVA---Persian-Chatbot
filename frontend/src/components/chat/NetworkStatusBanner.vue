<script setup lang="ts">
import { ref } from 'vue'
import { useUiStore } from '../../stores/ui'
import { useChatStore } from '../../stores/chat'

const uiStore = useUiStore()
const chatStore = useChatStore()
const isChecking = ref(false)

async function checkConnection() {
  isChecking.value = true
  try {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      throw new Error('Offline')
    }
    // Try to refresh current conversation if one is selected
    if (chatStore.currentConversationId) {
      await chatStore.selectConversation(chatStore.currentConversationId)
    }
    uiStore.setOnline(true)
    uiStore.showToast(
      uiStore.direction === 'rtl' ? 'اتصال برقرار شد.' : 'Connection restored.',
      'success',
      2000
    )
  } catch {
    uiStore.setOnline(false)
  } finally {
    isChecking.value = false
  }
}
</script>

<template>
  <transition name="slide-fade">
    <div
      v-if="!uiStore.isOnline"
      class="network-banner"
      role="alert"
    >
      <div class="banner-inner">
        <div class="banner-text">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="banner-icon">
            <line x1="1" y1="1" x2="23" y2="23"></line>
            <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"></path>
            <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"></path>
            <path d="M10.71 5.05A16 16 0 0 1 22.58 9"></path>
            <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"></path>
            <path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path>
            <line x1="12" y1="20" x2="12.01" y2="20"></line>
          </svg>
          <span>
            {{ uiStore.direction === 'rtl' ? 'اتصال شما به اینترنت قطع است.' : 'You are currently offline.' }}
          </span>
        </div>

        <button
          class="retry-btn"
          :disabled="isChecking"
          @click="checkConnection"
        >
          <svg v-if="isChecking" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="animate-spin">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
          </svg>
          <svg v-else width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="1 4 1 10 7 10"></polyline>
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
          </svg>
          <span>{{ uiStore.direction === 'rtl' ? 'تلاش مجدد' : 'Retry' }}</span>
        </button>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.network-banner {
  width: 100%;
  background-color: rgba(234, 179, 8, 0.12);
  color: #ca8a04;
  padding: 6px 16px;
  font-size: 12px;
  display: flex;
  justify-content: center;
  z-index: 25;
}

:global(.dark) .network-banner {
  background-color: rgba(234, 179, 8, 0.16);
  color: #facc15;
}

.banner-inner {
  max-width: 672px;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.banner-text {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
}

.banner-icon {
  flex-shrink: 0;
}

.retry-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 10px;
  background-color: rgba(234, 179, 8, 0.2);
  color: inherit;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: opacity 150ms ease;
}

.retry-btn:hover {
  opacity: 0.85;
}

.retry-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.slide-fade-enter-active,
.slide-fade-leave-active {
  transition: all 200ms ease;
}

.slide-fade-enter-from,
.slide-fade-leave-to {
  transform: translateY(-100%);
  opacity: 0;
}
</style>

