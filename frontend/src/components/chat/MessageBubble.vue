<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Message } from '../../types'
import { useAuthStore } from '../../stores/auth'

const props = defineProps<{
  message: Message
}>()

const authStore = useAuthStore()
const copied = ref(false)

const isUser = computed(() => props.message.role === 'user')

const formattedTime = computed(() => {
  if (!props.message.createdAt) return ''
  const date = new Date(props.message.createdAt)
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
})

const userInitial = computed(() => {
  if (authStore.user?.displayName) return authStore.user.displayName.charAt(0).toUpperCase()
  if (authStore.user?.email) return authStore.user.email.charAt(0).toUpperCase()
  return 'U'
})

function copyContent() {
  navigator.clipboard.writeText(props.message.content)
  copied.value = true
  setTimeout(() => {
    copied.value = false
  }, 1500)
}
</script>

<template>
  <div :class="['message-row', isUser ? 'row-user' : 'row-assistant']">
    <!-- Avatar -->
    <div :class="['avatar', isUser ? 'avatar-user' : 'avatar-assistant']">
      <template v-if="isUser">
        {{ userInitial }}
      </template>
      <template v-else>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2C6.477 2 2 6.477 2 12C2 17.523 6.477 22 12 22C17.523 22 22 17.523 22 12C22 6.477 17.523 2 12 2Z" stroke="var(--primary)" stroke-width="2"/>
          <circle cx="9" cy="11" r="1.5" fill="var(--primary)"/>
          <circle cx="15" cy="11" r="1.5" fill="var(--primary)"/>
          <path d="M9 16C9.8 17.2 11.2 17.5 12 17.5C12.8 17.5 14.2 17.2 15 16" stroke="var(--primary)" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </template>
    </div>

    <!-- Bubble Content -->
    <div class="bubble-container">
      <div :class="['bubble', isUser ? 'bubble-user' : 'bubble-assistant']">
        <div class="message-text">{{ message.content }}</div>
      </div>

      <!-- Metadata & Action bar -->
      <div class="meta-bar">
        <span class="timestamp font-mono">{{ formattedTime }}</span>
        <button v-if="!isUser" class="copy-button" @click="copyContent" :title="copied ? 'Copied' : 'Copy'">
          <svg v-if="!copied" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
          <span v-else class="copied-text font-mono">✓</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.message-row {
  display: flex;
  gap: 12px;
  margin-bottom: 24px;
  width: 100%;
}

/* RTL layout (Default): User is anchored on the RIGHT, Assistant on the LEFT */
.row-user {
  flex-direction: row;
  justify-content: flex-start;
}

.row-assistant {
  flex-direction: row-reverse;
  justify-content: flex-start;
}

html[dir="ltr"] .row-user {
  flex-direction: row-reverse;
}

html[dir="ltr"] .row-assistant {
  flex-direction: row;
}

.avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 13px;
}

.avatar-user {
  background: linear-gradient(135deg, var(--primary), #a78bfa);
  color: #ffffff;
}

.avatar-assistant {
  background-color: var(--card);
  border: 1px solid var(--border);
}

.bubble-container {
  display: flex;
  flex-direction: column;
  max-width: 82%;
}

.row-user .bubble-container {
  align-items: flex-start;
}

.row-assistant .bubble-container {
  align-items: flex-end;
}

html[dir="ltr"] .row-user .bubble-container {
  align-items: flex-end;
}

html[dir="ltr"] .row-assistant .bubble-container {
  align-items: flex-start;
}

.bubble {
  padding: 12px 16px;
  font-size: 14px;
  line-height: 1.6;
  word-break: break-word;
  white-space: pre-wrap;
  text-align: right;
  transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease;
}

html[dir="ltr"] .bubble {
  text-align: left;
}

/* User Message Bubble */
.bubble-user {
  background-color: var(--chat-user-bg, #1e202d);
  color: var(--chat-user-fg, #f3f4f6);
  border: 1px solid var(--chat-user-border, #2e3247);
  border-radius: 18px 18px 4px 18px;
}

/* Assistant Message Bubble */
.bubble-assistant {
  background-color: var(--chat-assistant-bg, #0c0d13);
  color: var(--chat-assistant-fg, #f3f4f6);
  border: 1px solid var(--chat-assistant-border, #1e202d);
  border-radius: 18px 18px 18px 4px;
}

.meta-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
  padding: 0 4px;
}

.timestamp {
  font-size: 11px;
  color: var(--muted-foreground);
}

.copy-button {
  color: var(--muted-foreground);
  padding: 2px 4px;
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.copy-button:hover {
  color: var(--foreground);
  background-color: var(--secondary);
}

.copied-text {
  font-size: 11px;
  color: var(--primary);
}
</style>
