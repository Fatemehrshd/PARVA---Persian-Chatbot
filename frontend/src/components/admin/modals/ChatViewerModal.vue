<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import { Loader2, Download } from '@lucide/vue'
import AdminModal from '../AdminModal.vue'
import { formatIranTime } from '../../../lib/date'
import { buildUrl } from '../../../services/api'
import type { AdminConversationDetail } from '../../../types'

const props = defineProps<{
  open: boolean
  conversation: AdminConversationDetail | null
  isLoading?: boolean
}>()

defineEmits<{
  close: []
}>()

// In-chat search state
const chatSearchQuery = ref('')
const activeChatMatchIndex = ref(0)

const matchingMessages = computed(() => {
  const q = chatSearchQuery.value.trim().toLowerCase()
  if (!q || !props.conversation?.messages) return []
  return props.conversation.messages.filter((m) =>
    m.content?.toLowerCase().includes(q)
  )
})

function scrollToActiveMatch() {
  nextTick(() => {
    const match = matchingMessages.value[activeChatMatchIndex.value]
    if (!match) return
    const el = document.getElementById(`admin-chat-msg-${match.id}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  })
}

function nextChatMatch() {
  if (!matchingMessages.value.length) return
  activeChatMatchIndex.value = (activeChatMatchIndex.value + 1) % matchingMessages.value.length
  scrollToActiveMatch()
}

function prevChatMatch() {
  if (!matchingMessages.value.length) return
  activeChatMatchIndex.value =
    (activeChatMatchIndex.value - 1 + matchingMessages.value.length) % matchingMessages.value.length
  scrollToActiveMatch()
}

function resetChatSearch() {
  chatSearchQuery.value = ''
  activeChatMatchIndex.value = 0
}

function getFileDownloadUrl(fileId: string): string {
  const token = localStorage.getItem('token')
  const qs = token ? `?token=${encodeURIComponent(token)}` : ''
  return buildUrl(`/admin/files/${fileId}/content${qs}`)
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let size = bytes
  let unitIndex = 0
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }
  return `${size.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ${units[unitIndex]}`
}

function getAttBadgeClass(fileType: string): string {
  switch (fileType) {
    case 'pdf': return 'badge-pdf'
    case 'excel': return 'badge-excel'
    case 'image': return 'badge-image'
    default: return 'badge-text'
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'ready': return 'آماده'
    case 'processing': return 'در حال پردازش...'
    case 'error': return 'خطا در پردازش'
    case 'uploading': return 'در حال آپلود...'
    default: return status
  }
}

function getStatusClass(status: string): string {
  switch (status) {
    case 'ready': return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
    case 'processing': return 'bg-amber-500/10 text-amber-600 border-amber-500/20'
    case 'error': return 'bg-rose-500/10 text-rose-600 border-rose-500/20'
    default: return 'bg-muted text-muted-foreground'
  }
}
</script>

<template>
  <AdminModal
    v-if="open"
    eyebrow="بازبینی چت"
    :title="conversation?.title || 'مشاهده تاریخچه پیام‌ها'"
    @close="$emit('close'); resetChatSearch()"
  >
    <div class="chat-viewer-modal">
      <div v-if="isLoading" class="chat-viewer-loading">
        <Loader2 :size="28" class="animate-spin text-primary" />
        <span>در حال بارگذاری پیام‌های گفتگو...</span>
      </div>

      <div v-else-if="conversation" class="chat-viewer-body">
        <div class="chat-viewer-meta flex items-center justify-between">
          <div class="meta-item">
            <span class="text-muted-foreground text-xs">کاربر:</span>
            <strong class="text-xs mr-1">{{ conversation.user?.displayName || conversation.user?.email || 'ناشناس' }}</strong>
          </div>
          <div class="meta-item">
            <span class="text-muted-foreground text-xs">تعداد پیام‌ها:</span>
            <strong class="text-xs mr-1">{{ conversation.messages?.length || 0 }}</strong>
          </div>
        </div>

        <!-- نوار جستجو درون پیام‌ها با اسکرول خودکار -->
        <div class="chat-search-bar flex items-center gap-2 p-2 bg-secondary/70 border border-border rounded-lg mt-3">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-muted-foreground shrink-0">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            v-model="chatSearchQuery"
            type="text"
            class="chat-search-input flex-1 bg-transparent border-none outline-none text-xs text-foreground placeholder:text-muted-foreground"
            placeholder="جستجو در متن پیام‌های این گفتگو..."
            @keydown.enter="nextChatMatch"
          />
          <div v-if="chatSearchQuery.trim()" class="search-match-nav flex items-center gap-2 text-xs">
            <span class="match-count text-muted-foreground mono font-medium">
              {{ matchingMessages.length > 0 ? `${(activeChatMatchIndex + 1).toLocaleString('fa-IR')} از ${matchingMessages.length.toLocaleString('fa-IR')}` : 'یافت نشد' }}
            </span>
            <button
              type="button"
              :disabled="!matchingMessages.length"
              class="search-nav-btn px-2 py-0.5 rounded border border-border bg-card hover:bg-secondary disabled:opacity-40"
              title="پیام قبلی"
              @click="prevChatMatch"
            >
              ▲
            </button>
            <button
              type="button"
              :disabled="!matchingMessages.length"
              class="search-nav-btn px-2 py-0.5 rounded border border-border bg-card hover:bg-secondary disabled:opacity-40"
              title="پیام بعدی"
              @click="nextChatMatch"
            >
              ▼
            </button>
            <button
              type="button"
              class="clear-search-btn text-muted-foreground hover:text-foreground font-bold px-1"
              title="پاک کردن جستجو"
              @click="resetChatSearch"
            >
              ×
            </button>
          </div>
        </div>

        <div class="chat-messages-container mt-3">
          <div
            v-for="msg in conversation.messages"
            :id="`admin-chat-msg-${msg.id}`"
            :key="msg.id"
            class="chat-bubble-row transition-all duration-300"
            :class="[
              msg.role === 'user' ? 'role-user' : 'role-assistant',
              chatSearchQuery && msg.content?.toLowerCase().includes(chatSearchQuery.toLowerCase()) ? 'search-match-bubble' : '',
              matchingMessages[activeChatMatchIndex]?.id === msg.id ? 'active-search-match-bubble' : ''
            ]"
          >
            <div class="chat-bubble-avatar">
              {{ msg.role === 'user' ? 'کاربر' : 'پروا' }}
            </div>
            <div class="chat-bubble-content">
              <div class="chat-bubble-header">
                <span class="bubble-sender">{{ msg.role === 'user' ? 'کاربر' : 'دستیار هوش مصنوعی' }}</span>
                <span class="bubble-time mono">
                  {{ formatIranTime(msg.createdAt) }}
                </span>
              </div>

              <!-- Attached files in message -->
              <div v-if="msg.attachments && msg.attachments.length > 0" class="admin-msg-attachments flex flex-wrap gap-2 mb-2">
                <div
                  v-for="att in msg.attachments"
                  :key="att.id"
                  class="admin-att-card flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-background/80 border border-border text-xs"
                >
                  <span :class="['att-badge px-1.5 py-0.5 rounded text-[10px] font-bold uppercase', getAttBadgeClass(att.fileType)]">
                    {{ att.fileType }}
                  </span>
                  <span class="att-name max-w-[140px] truncate font-medium" :title="att.originalName">{{ att.originalName }}</span>
                  <span class="att-size text-muted-foreground text-[10px]">({{ formatFileSize(att.fileSize) }})</span>
                  <span :class="['att-status text-[10px] px-1.5 py-0.5 rounded', getStatusClass(att.status)]">
                    {{ getStatusLabel(att.status) }}
                  </span>
                  <a
                    v-if="att.id"
                    :href="getFileDownloadUrl(att.id)"
                    :download="att.originalName"
                    class="text-primary hover:underline flex items-center gap-0.5 text-[10px] mr-1"
                    title="دانلود فایل"
                  >
                    <Download :size="12" />
                  </a>
                </div>
              </div>

              <div class="bubble-text">{{ msg.content }}</div>
              <div v-if="msg.isInterrupted" class="bubble-tag tag-interrupted">قطع ارتباط</div>
              <div v-if="msg.stoppedByUser" class="bubble-tag tag-stopped">توقف توسط کاربر</div>
            </div>
          </div>

          <div v-if="!conversation.messages?.length" class="empty-state p-6 text-center text-xs text-muted-foreground">
            هیچ پیامی در این گفتگو ثبت نشده است.
          </div>
        </div>
      </div>
    </div>
  </AdminModal>
</template>

<style scoped>
.chat-viewer-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 40px;
  color: var(--muted-foreground);
  font-size: 13px;
}
.chat-messages-container {
  display: flex;
  flex-direction: column;
  gap: 14px;
  max-height: 480px;
  overflow-y: auto;
  padding: 8px 4px;
}
.chat-bubble-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}
.chat-bubble-avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: bold;
  background: var(--secondary);
  color: var(--foreground);
  flex-shrink: 0;
}
.role-user .chat-bubble-avatar {
  background: var(--primary);
  color: var(--primary-foreground);
}
.chat-bubble-content {
  flex: 1;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 10px 14px;
}
.chat-bubble-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
  font-size: 11.5px;
}
.bubble-sender {
  font-weight: 600;
  color: var(--foreground);
}
.bubble-time {
  font-size: 10.5px;
  color: var(--muted-foreground);
}
.bubble-text {
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}
.bubble-tag {
  display: inline-block;
  margin-top: 6px;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
}
.tag-interrupted {
  background: rgba(239, 68, 68, 0.15);
  color: #ef4444;
}
.tag-stopped {
  background: rgba(234, 179, 8, 0.15);
  color: #eab308;
}
.search-match-bubble {
  border-right: 3px solid var(--primary) !important;
  background-color: color-mix(in srgb, var(--primary) 8%, var(--card)) !important;
}
.active-search-match-bubble {
  border-right: 4px solid var(--primary) !important;
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--primary) 35%, transparent) !important;
  background-color: color-mix(in srgb, var(--primary) 15%, var(--card)) !important;
}
.badge-pdf { background: rgba(239, 68, 68, 0.15); color: #ef4444; }
.badge-excel { background: rgba(34, 197, 94, 0.15); color: #22c55e; }
.badge-image { background: rgba(59, 130, 246, 0.15); color: #3b82f6; }
.badge-text { background: rgba(168, 85, 247, 0.15); color: #a855f7; }
</style>
