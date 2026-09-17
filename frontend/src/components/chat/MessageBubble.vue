<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Message } from '../../types'
import { useAuthStore } from '../../stores/auth'
import { useChatStore } from '../../stores/chat'
import { getTextDirection, getLineDirection } from '../../utils/textDirection'
import MarkdownContent from './MarkdownContent.vue'
import FilePreviewCard from './FilePreviewCard.vue'

const props = defineProps<{
  message: Message
  isLast?: boolean
}>()

const authStore = useAuthStore()
const chatStore = useChatStore()
const copied = ref(false)

function handleRetryFiles() {
  if (props.message.attachments) {
    for (const f of props.message.attachments) {
      if (f.status === 'error' || f.status === 'processing') {
        chatStore.retryFailedMessageFile(props.message.id, f.id)
      }
    }
  }
}

function handleRemoveFilesAndSend() {
  if (props.message.attachments) {
    const errorFiles = props.message.attachments.filter((f) => f.status === 'error')
    for (const f of errorFiles) {
      chatStore.removeMessageFileAndSend(props.message.id, f.id)
    }
  }
}

function handleDeleteMessage() {
  chatStore.deleteMessage(props.message.id)
}

const isUser = computed(() => props.message.role === 'user')
const textDirection = computed(() => getTextDirection(props.message.content))

const userMessageLines = computed(() => {
  if (!props.message.content) return []
  return props.message.content.split('\n')
})

const formattedTime = computed(() => {
  if (!props.message.createdAt) return ''
  const date = new Date(props.message.createdAt)
  if (isNaN(date.getTime())) return ''

  let hours = date.getHours()
  const minutes = date.getMinutes()
  const period = hours >= 12 ? 'بعدازظهر' : 'قبل‌ازظهر'
  hours = hours % 12 || 12
  const toPersianDigits = (val: number | string) =>
    String(val).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[Number(d)])
  const minutesStr = minutes < 10 ? `۰${toPersianDigits(minutes)}` : toPersianDigits(minutes)
  return `${toPersianDigits(hours)}:${minutesStr} ${period}`
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
  <div 
    :class="[
      'message-row', 
      isUser ? 'row-user' : 'row-assistant',
      props.isLast ? 'last-message-row mb-12 sm:mb-16' : 'mb-6',
      'w-full flex gap-3.5 group transition-all duration-200'
    ]"
  >
    <!-- Avatar -->
    <div 
      :class="[
        'avatar', 
        isUser ? 'avatar-user' : 'avatar-assistant',
        'w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center font-bold text-xs shadow-sm select-none mt-0.5 transition-transform'
      ]"
    >
      <template v-if="isUser">
        <img v-if="authStore.user?.avatarUrl" :src="authStore.user.avatarUrl" alt="" class="user-avatar-image" />
        <span v-else>{{ userInitial }}</span>
      </template>
      <template v-else>
        <!-- AI Icon -->
        <svg class="w-4 h-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2C6.477 2 2 6.477 2 12C2 17.523 6.477 22 12 22C17.523 22 22 17.523 22 12C22 6.477 17.523 2 12 2Z"/>
          <circle cx="9" cy="11" r="1.5" fill="currentColor"/>
          <circle cx="15" cy="11" r="1.5" fill="currentColor"/>
          <path d="M9 16C9.8 17.2 11.2 17.5 12 17.5C12.8 17.5 14.2 17.2 15 16" stroke-linecap="round"/>
        </svg>
      </template>
    </div>

    <!-- Bubble Container -->
    <div class="bubble-container flex flex-col flex-1 min-w-0">
      <!-- Bubble Content -->
      <div 
        :class="[
          'bubble', 
          isUser ? 'bubble-user rounded-2xl p-4' : 'bubble-assistant p-1', 
          isUser && message.status === 'error' ? 'border border-destructive/50' : '',
          textDirection,
          'transition-colors'
        ]"
        :dir="textDirection"
      >
        <!-- Attachments if any -->
        <div v-if="isUser && message.attachments && message.attachments.length > 0" class="message-attachments flex flex-wrap gap-2 mb-3">
          <FilePreviewCard
            v-for="file in message.attachments"
            :key="file.id"
            :file="file"
            read-only
            compact
          />
        </div>

        <!-- User: Plain text with per-line hybrid directional alignment -->
        <div v-if="isUser" class="message-text leading-relaxed text-[14px] md:text-[15px] space-y-0.5">
          <div
            v-for="(line, idx) in userMessageLines"
            :key="idx"
            :dir="getLineDirection(line, textDirection)"
            :class="['user-msg-line', getLineDirection(line, textDirection)]"
          >
            {{ line || '\u00A0' }}
          </div>
        </div>

        <!-- Assistant: Rich Markdown -->
        <div v-else class="message-text">
          <MarkdownContent :content="message.content" />
        </div>
      </div>

      <!-- Subtitle / Processing status for user message -->
      <div v-if="isUser && message.status === 'processing_files'" class="user-status-subtitle flex items-center gap-1.5 mt-1.5 px-1 text-xs text-muted-foreground animate-pulse">
        <svg class="w-3.5 h-3.5 animate-spin text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10" stroke-opacity="0.25"/>
          <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"/>
        </svg>
        <span>در حال پردازش فایل...</span>
      </div>

      <div v-else-if="isUser && message.status === 'queued'" class="user-status-subtitle flex items-center gap-1.5 mt-1.5 px-1 text-xs text-muted-foreground">
        <svg class="w-3.5 h-3.5 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 6 12 12 16 14"/>
        </svg>
        <span>در انتظار ارسال…</span>
      </div>

      <div v-else-if="isUser && message.status === 'error'" class="user-status-error flex flex-col gap-1.5 mt-2 px-1">
        <span class="text-xs text-destructive font-medium">خطا در پردازش فایل‌های پیوست</span>
        <div class="flex items-center gap-2 mt-1">
          <button
            type="button"
            class="px-2.5 py-1 text-xs rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-opacity cursor-pointer"
            @click="handleRetryFiles"
          >
            تلاش مجدد پردازش
          </button>
          <button
            type="button"
            class="px-2.5 py-1 text-xs rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors cursor-pointer"
            @click="handleRemoveFilesAndSend"
          >
            حذف فایل و ارسال بدون آن
          </button>
        </div>
      </div>

      <!-- Action bar under message (Available for both user and assistant) -->
      <div v-if="!message.id.startsWith('msg-err-')" class="meta-bar flex items-center gap-3 mt-2 px-1 text-xs text-muted-foreground">
        <span class="timestamp font-sans text-[11px] opacity-75">{{ formattedTime }}</span>
        <button 
          class="copy-button inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground text-xs font-sans transition-colors cursor-pointer" 
          @click="copyContent" 
          :title="copied ? 'کپی شد' : 'کپی متن'"
        >
          <svg v-if="!copied" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
          <span v-else class="copied-text font-sans text-primary text-xs font-semibold">✓</span>
          <span class="text-[11px]">{{ copied ? 'کپی شد' : 'کپی' }}</span>
        </button>
        <button
          class="delete-button inline-flex items-center gap-1 px-2 py-0.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive text-xs font-sans transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
          @click="handleDeleteMessage"
          title="حذف پیام"
        >
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
          <span class="text-[11px]">حذف</span>
        </button>
      </div>

      <!-- Recovery Action Bar for Interrupted Assistant Messages -->
      <div v-if="!isUser && message.isInterrupted && !message.id.startsWith('msg-err-') && message.status !== 'error'" class="recovery-bar flex flex-col gap-2 mt-3">
        <!-- Status label -->
        <div class="recovery-label flex items-center">
          <span class="stop-badge inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-500 border border-red-500/25">
            <span class="stop-square-icon w-1.5 h-1.5 rounded-sm bg-red-500"></span>
            {{ message.isInterrupted ? 'تولید توسط کاربر متوقف شد' : 'خطا در دریافت پاسخ' }}
          </span>
        </div>

        <!-- Retry action ONLY on the last message -->
        <div v-if="props.isLast && !chatStore.isStreaming" class="recovery-actions flex items-center gap-2 mt-1">
          <button 
            class="recovery-btn retry-btn inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground shadow-sm hover:opacity-90 transition-all active:scale-95" 
            @click="chatStore.retryLastMessage"
          >
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <polyline points="1 4 1 10 7 10"></polyline>
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
            </svg>
            <span>تلاش مجدد</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.message-row {
  display: flex;
  gap: clamp(0.625rem, 2vw, 0.875rem);
  margin-bottom: clamp(1rem, 3vw, 1.5rem);
  width: 100%;
}

.avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  flex: 0 0 32px;
  overflow: hidden;
}

/* User & Assistant Flow (ChatGPT Style):
   Consistent, linear top-to-bottom layout where each turn begins with the author
   and content flows cleanly directly beneath it */
.avatar-user {
  background: linear-gradient(135deg, var(--primary), #818cf8);
  color: #ffffff;
}

.user-avatar-image {
  width: 100%;
  height: 100%;
  border-radius: inherit;
  object-fit: cover;
}

.avatar-assistant {
  background-color: var(--card);
  border: 1px solid var(--border);
}

.bubble-container {
  display: flex;
  flex-direction: column;
  width: 100%;
  min-width: 0;
}

.bubble {
  padding: 14px 18px;
  font-size: 14.5px;
  line-height: 1.68;
  word-break: break-word;
  transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease;
}

.bubble.rtl,
.bubble[dir="rtl"] {
  text-align: right;
  direction: rtl;
}

.bubble.ltr,
.bubble[dir="ltr"] {
  text-align: left;
  direction: ltr;
}

/* Hybrid per-line alignment for user messages */
.user-msg-line.rtl,
.user-msg-line[dir="rtl"] {
  text-align: right;
  direction: rtl;
}

.user-msg-line.ltr,
.user-msg-line[dir="ltr"] {
  text-align: left;
  direction: ltr;
}

/* User Message Bubble: styled cleanly at the top of the turn */
.bubble-user {
  background-color: var(--chat-user-bg, #1e202d);
  color: var(--chat-user-fg, #f3f4f6);
  border: 1px solid var(--chat-user-border, #2e3247);
  border-radius: 16px;
  align-self: flex-start;
  max-width: 92%;
}

/* Assistant Message Bubble: completely borderless with transparent background */
.bubble-assistant {
  background-color: transparent !important;
  background: transparent !important;
  color: var(--foreground) !important;
  border: none !important;
  box-shadow: none !important;
  padding: 4px 0 !important;
  border-radius: 0 !important;
  width: 100%;
}

/* Action & recovery bars */
.meta-bar {
  display: flex;
  align-items: center;
  gap: 8px;
}

.copy-button {
  cursor: pointer;
}

.copied-text {
  color: var(--primary);
}
</style>
