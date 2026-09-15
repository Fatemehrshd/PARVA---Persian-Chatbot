<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { Search, X, MessageSquare, Loader2, Calendar } from '@lucide/vue'
import { useChatStore } from '../../stores/chat'
import { useUiStore } from '../../stores/ui'
import { chatService } from '../../services/chat.service'
import type { SearchResult } from '../../types'

const props = defineProps<{
  isOpen: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'select', conversationId: string): void
}>()

const router = useRouter()
const chatStore = useChatStore()
const uiStore = useUiStore()

const inputRef = ref<HTMLInputElement | null>(null)
const query = ref('')
const isSearching = ref(false)
const searchResults = ref<SearchResult[]>([])
const selectedIndex = ref(0)
let debounceTimer: any = null

const isRtl = computed(() => uiStore.direction === 'rtl')

const displayedItems = computed(() => {
  if (!query.value.trim()) {
    // Show recent conversations if no search query
    return chatStore.conversations.slice(0, 8).map((c) => ({
      id: c.id,
      title: c.title,
      updatedAt: c.updatedAt,
      matchedIn: 'title' as const,
      snippet: c.title
    }))
  }
  return searchResults.value
})

function close() {
  query.value = ''
  searchResults.value = []
  selectedIndex.value = 0
  emit('close')
}

async function performSearch(searchVal: string) {
  if (!searchVal.trim()) {
    searchResults.value = []
    isSearching.value = false
    return
  }

  isSearching.value = true
  try {
    const results = await chatService.searchConversations(searchVal)
    searchResults.value = results
    selectedIndex.value = 0
  } catch (err) {
    // Fallback: search locally in client conversations
    const q = searchVal.toLowerCase()
    searchResults.value = chatStore.conversations
      .filter((c) => c.title.toLowerCase().includes(q))
      .map((c) => ({
        id: c.id,
        title: c.title,
        updatedAt: c.updatedAt,
        matchedIn: 'title' as const,
        snippet: c.title
      }))
  } finally {
    isSearching.value = false
  }
}

watch(query, (val) => {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    performSearch(val)
  }, 220)
})

watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      query.value = ''
      searchResults.value = []
      selectedIndex.value = 0
      nextTick(() => {
        inputRef.value?.focus()
      })
    }
  }
)

function selectItem(convId: string) {
  chatStore.selectConversation(convId)
  router.push(`/chat/${convId}`)
  emit('select', convId)
  close()
}

function handleKeyDown(e: KeyboardEvent) {
  if (!props.isOpen) return

  if (e.key === 'Escape') {
    close()
  } else if (e.key === 'ArrowDown') {
    e.preventDefault()
    if (displayedItems.value.length > 0) {
      selectedIndex.value = (selectedIndex.value + 1) % displayedItems.value.length
    }
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    if (displayedItems.value.length > 0) {
      selectedIndex.value =
        (selectedIndex.value - 1 + displayedItems.value.length) % displayedItems.value.length
    }
  } else if (e.key === 'Enter') {
    e.preventDefault()
    if (displayedItems.value.length > 0 && displayedItems.value[selectedIndex.value]) {
      selectItem(displayedItems.value[selectedIndex.value].id)
    }
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeyDown)
  if (debounceTimer) clearTimeout(debounceTimer)
})

function formatDate(dateStr?: string) {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString(isRtl.value ? 'fa-IR' : 'en-US', {
      month: 'short',
      day: 'numeric'
    })
  } catch {
    return ''
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="search-modal">
      <div v-if="isOpen" class="search-modal-backdrop" @click="close">
        <div class="search-modal-card" @click.stop :dir="uiStore.direction">
          <!-- Search Header Input -->
          <div class="search-input-wrapper">
            <Search :size="18" class="search-icon" />
            <input
              ref="inputRef"
              v-model="query"
              type="text"
              class="search-input"
              :placeholder="isRtl ? 'جستجو در گفتگوها و پیام‌ها...' : 'Search conversations and messages...'"
            />
            <Loader2 v-if="isSearching" :size="16" class="search-spinner animate-spin" />
            <button
              v-else-if="query"
              class="search-clear-btn"
              @click="query = ''; inputRef?.focus()"
              :title="isRtl ? 'پاک کردن' : 'Clear'"
            >
              <X :size="15" />
            </button>
            <div class="keycap-badge font-mono">ESC</div>
          </div>

          <!-- Section Label -->
          <div class="search-section-label">
            <span>{{ query ? (isRtl ? 'نتایج جستجو' : 'Search Results') : (isRtl ? 'گفتگوهای اخیر' : 'Recent Conversations') }}</span>
          </div>

          <!-- Results List -->
          <div class="search-results-list">
            <div
              v-for="(item, idx) in displayedItems"
              :key="item.id + idx"
              class="search-result-item"
              :class="{ 'is-selected': idx === selectedIndex }"
              @mouseenter="selectedIndex = idx"
              @click="selectItem(item.id)"
            >
              <div class="result-icon-box">
                <MessageSquare :size="15" />
              </div>

              <div class="result-details">
                <div class="result-header">
                  <span class="result-title">{{ item.title }}</span>
                  <span class="result-date" v-if="item.updatedAt">
                    <Calendar :size="11" class="date-icon" />
                    {{ formatDate(item.updatedAt) }}
                  </span>
                </div>

                <p v-if="item.snippet && item.matchedIn === 'message'" class="result-snippet">
                  {{ item.snippet }}
                </p>
              </div>
            </div>

            <!-- Empty State -->
            <div v-if="!isSearching && query && displayedItems.length === 0" class="search-empty-state">
              <Search :size="32" class="empty-icon" />
              <p class="empty-text">
                {{ isRtl ? 'هیچ نتیجه‌ای یافت نشد' : 'No conversations found' }}
              </p>
              <span class="empty-hint">
                {{ isRtl ? 'عبارت دیگری را امتحان کنید' : 'Try searching with different keywords' }}
              </span>
            </div>
          </div>

          <!-- Footer Hints -->
          <div class="search-modal-footer font-mono">
            <div class="footer-hint">
              <span class="keycap">↵</span>
              <span>{{ isRtl ? 'انتخاب' : 'Open' }}</span>
            </div>
            <div class="footer-hint">
              <span class="keycap">↑</span>
              <span class="keycap">↓</span>
              <span>{{ isRtl ? 'ناوبری' : 'Navigate' }}</span>
            </div>
            <div class="footer-hint">
              <span class="keycap">ESC</span>
              <span>{{ isRtl ? 'بستن' : 'Close' }}</span>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.search-modal-backdrop {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(6px);
  z-index: 100;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 80px 16px 24px;
}

.search-modal-card {
  width: 100%;
  max-width: 580px;
  background-color: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg, 16px);
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5), 0 0 0 1px var(--border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Search input */
.search-input-wrapper {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 18px;
  border-bottom: 1px solid var(--border);
  background-color: var(--card);
}

.search-icon {
  color: var(--primary);
  flex-shrink: 0;
}

.search-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  font-size: 14px;
  color: var(--foreground);
}

.search-input::placeholder {
  color: var(--muted-foreground);
}

.search-spinner {
  color: var(--primary);
}

.search-clear-btn {
  background: transparent;
  border: none;
  color: var(--muted-foreground);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.search-clear-btn:hover {
  color: var(--foreground);
  background-color: var(--secondary);
}

.keycap-badge {
  font-size: 10px;
  padding: 3px 6px;
  border-radius: 4px;
  background-color: var(--secondary);
  border: 1px solid var(--border);
  color: var(--muted-foreground);
  flex-shrink: 0;
}

/* Section label */
.search-section-label {
  padding: 10px 18px 4px;
  font-size: 11px;
  font-weight: 600;
  color: var(--muted-foreground);
  letter-spacing: 0.03em;
}

/* Results */
.search-results-list {
  max-height: 380px;
  overflow-y: auto;
  padding: 6px 10px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.search-results-list::-webkit-scrollbar {
  width: 4px;
}
.search-results-list::-webkit-scrollbar-thumb {
  background-color: var(--border);
  border-radius: 4px;
}

.search-result-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 10px 12px;
  border-radius: var(--radius, 10px);
  cursor: pointer;
  transition: all 120ms ease;
  border: 1px solid transparent;
}

.search-result-item:hover,
.search-result-item.is-selected {
  background-color: var(--secondary);
  border-color: color-mix(in srgb, var(--primary) 25%, transparent);
}

.result-icon-box {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background-color: color-mix(in srgb, var(--primary) 12%, transparent);
  color: var(--primary);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-top: 2px;
}

.result-details {
  flex: 1;
  min-width: 0;
}

.result-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.result-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--foreground);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.result-date {
  font-size: 11px;
  color: var(--muted-foreground);
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.date-icon {
  opacity: 0.7;
}

.result-snippet {
  font-size: 12px;
  color: var(--muted-foreground);
  margin-top: 4px;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Empty state */
.search-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 36px 16px;
  text-align: center;
}

.empty-icon {
  color: var(--muted-foreground);
  opacity: 0.4;
  margin-bottom: 10px;
}

.empty-text {
  font-size: 14px;
  font-weight: 600;
  color: var(--foreground);
  margin-bottom: 4px;
}

.empty-hint {
  font-size: 12px;
  color: var(--muted-foreground);
}

/* Footer */
.search-modal-footer {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 8px 18px;
  border-top: 1px solid var(--border);
  background-color: var(--card);
  font-size: 11px;
  color: var(--muted-foreground);
}

.footer-hint {
  display: flex;
  align-items: center;
  gap: 5px;
}

.keycap {
  padding: 2px 5px;
  background-color: var(--secondary);
  border: 1px solid var(--border);
  border-radius: 4px;
  font-size: 10px;
  color: var(--foreground);
}

/* Transition */
.search-modal-enter-active,
.search-modal-leave-active {
  transition: opacity 180ms ease;
}

.search-modal-enter-active .search-modal-card,
.search-modal-leave-active .search-modal-card {
  transition: transform 180ms cubic-bezier(0.16, 1, 0.3, 1), opacity 180ms ease;
}

.search-modal-enter-from,
.search-modal-leave-to {
  opacity: 0;
}

.search-modal-enter-from .search-modal-card,
.search-modal-leave-to .search-modal-card {
  transform: translateY(-12px) scale(0.98);
  opacity: 0;
}
</style>
