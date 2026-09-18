<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { MessageSquare, Eye, Trash2 } from '@lucide/vue'
import AdminTable, { type TableColumn } from '../../components/admin/AdminTable.vue'
import BaseButton from '../../components/ui/BaseButton.vue'
import ChatViewerModal from '../../components/admin/modals/ChatViewerModal.vue'
import { adminService } from '../../services/admin.service'
import { formatIranDateTime } from '../../lib/date'
import { useUiStore } from '../../stores/ui'
import type { AdminConversationSummary, AdminConversationDetail } from '../../types'

const props = defineProps<{
  searchQuery?: string
}>()

defineEmits<{
  deletePrompt: [target: { type: 'conversation'; id: string; name: string }]
}>()

const uiStore = useUiStore()
const conversations = ref<AdminConversationSummary[]>([])
const isLoading = ref(false)
const errorMessage = ref('')
const page = ref(1)
const pageSize = ref(10)
const totalItems = ref(0)
const sortBy = ref<string | undefined>(undefined)
const sortOrder = ref<'ASC' | 'DESC' | undefined>(undefined)
const columnFilters = ref<Record<string, string>>({})
const tableSearchQuery = ref(props.searchQuery || '')

const isViewerModalOpen = ref(false)
const inspectingConversation = ref<AdminConversationDetail | null>(null)
const isLoadingDetail = ref(false)

const chatColumns: TableColumn[] = [
  { key: 'title', label: 'عنوان گفتگو', width: '260px', sortable: true },
  { key: 'user', label: 'کاربر', width: '220px', sortable: true },
  { key: 'messageCount', label: 'تعداد پیام‌ها', width: '130px', sortable: true },
  { key: 'updatedAt', label: 'تاریخ آخرین فعالیت', width: '160px', sortable: true },
  { key: 'actions', label: 'عملیات', align: 'left', width: '110px', sortable: false },
]

async function loadConversations() {
  isLoading.value = true
  errorMessage.value = ''
  try {
    const combinedSearch = (tableSearchQuery.value || props.searchQuery || '').trim()
    const params: any = {
      page: page.value,
      limit: pageSize.value,
    }
    if (combinedSearch) params.search = combinedSearch
    if (sortBy.value) {
      params.sortBy = sortBy.value
      params.sortOrder = sortOrder.value
    }
    for (const [k, v] of Object.entries(columnFilters.value)) {
      if (v) params[k] = v
    }

    const res = await adminService.listConversations(params)
    if (res && typeof res === 'object' && 'items' in res) {
      conversations.value = (res as any).items || []
      totalItems.value = (res as any).total || 0
    } else if (Array.isArray(res)) {
      conversations.value = res
      totalItems.value = res.length
    }
  } catch (err: any) {
    errorMessage.value = err?.message || 'خطا در بارگذاری لیست گفتگوها'
  } finally {
    isLoading.value = false
  }
}

watch(() => props.searchQuery, (newVal) => {
  tableSearchQuery.value = newVal || ''
  page.value = 1
  loadConversations()
})

function handlePageChange(newPage: number) {
  page.value = newPage
  loadConversations()
}

function handlePageSizeChange(newSize: number) {
  pageSize.value = newSize
  page.value = 1
  loadConversations()
}

function handleSearch(query: string) {
  tableSearchQuery.value = query
  page.value = 1
  loadConversations()
}

function handleSortChange(col: string | null, order: 'asc' | 'desc' | null) {
  sortBy.value = col || undefined
  sortOrder.value = order ? (order.toUpperCase() as 'ASC' | 'DESC') : undefined
  loadConversations()
}

function handleColumnFilterChange(filters: Record<string, string>) {
  columnFilters.value = filters
  page.value = 1
  loadConversations()
}

async function openChatViewer(conv: AdminConversationSummary) {
  isViewerModalOpen.value = true
  isLoadingDetail.value = true
  inspectingConversation.value = null
  try {
    const detail = await adminService.getConversation(conv.id)
    inspectingConversation.value = detail
  } catch (err: any) {
    uiStore.showToast(err?.message || 'خطا در دریافت پیام‌های چت', 'error')
    isViewerModalOpen.value = false
  } finally {
    isLoadingDetail.value = false
  }
}

onMounted(loadConversations)
</script>

<template>
  <div class="chats-section space-y-4">
    <div class="section-toolbar flex items-center justify-between">
      <div>
        <h3 class="text-base font-bold text-foreground">تاریخچه گفتگوهای کاربران</h3>
        <p class="text-xs text-muted-foreground mt-0.5">پایش پیام‌ها، فایل‌های پیوست و وضعیت ارسال پاسخ مدل‌ها</p>
      </div>
      <span class="record-badge text-xs px-2.5 py-1 rounded-full bg-secondary border border-border text-muted-foreground font-mono">
        {{ (totalItems || conversations.length).toLocaleString('fa-IR') }} گفتگو
      </span>
    </div>

    <div v-if="errorMessage" class="error-banner p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive">
      {{ errorMessage }}
    </div>

    <AdminTable
      :columns="chatColumns"
      :items="conversations"
      serverSide
      paginated
      searchable
      :currentPage="page"
      :pageSize="pageSize"
      :totalItems="totalItems"
      :pageSizes="[10, 25, 50, 100]"
      :searchQuery="tableSearchQuery"
      @update:page="handlePageChange"
      @update:pageSize="handlePageSizeChange"
      @search="handleSearch"
      @sortChange="handleSortChange"
      @columnFilterChange="handleColumnFilterChange"
    >
      <template #row="{ item: conv }">
        <!-- عنوان گفتگو -->
        <td data-label="عنوان گفتگو">
          <div class="chat-title-cell flex items-center gap-2.5">
            <MessageSquare :size="15" class="text-primary shrink-0" />
            <div class="overflow-hidden">
              <strong class="block text-xs font-semibold text-foreground truncate max-w-[220px]" :title="conv.title || 'بدون عنوان'">
                {{ conv.title || 'بدون عنوان' }}
              </strong>
              <span class="subtext mono text-[10px] text-muted-foreground block truncate">{{ conv.id.slice(0, 8) }}...</span>
            </div>
          </div>
        </td>

        <!-- کاربر -->
        <td data-label="کاربر">
          <div class="user-cell flex items-center gap-2">
            <div class="avatar-chip w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
              {{ (conv.user?.displayName || conv.user?.email || 'U').charAt(0).toUpperCase() }}
            </div>
            <div class="overflow-hidden">
              <strong class="block text-xs font-medium text-foreground truncate max-w-[160px]">
                {{ conv.user?.displayName || '—' }}
              </strong>
              <span class="subtext mono text-[10px] text-muted-foreground block truncate max-w-[160px]">
                {{ conv.user?.email || 'کاربر ناشناس' }}
              </span>
            </div>
          </div>
        </td>

        <!-- تعداد پیام‌ها -->
        <td data-label="تعداد پیام‌ها" class="mono font-semibold text-xs text-foreground">
          <span class="px-2 py-0.5 rounded-full bg-muted text-foreground text-xs">
            {{ Number(conv.messageCount || 0).toLocaleString('fa-IR') }} پیام
          </span>
        </td>

        <!-- تاریخ آخرین فعالیت (با ساعت و تاریخ رسمی ایران) -->
        <td data-label="تاریخ آخرین فعالیت" class="mono text-xs text-muted-foreground">
          {{ formatIranDateTime(conv.updatedAt || conv.createdAt) }}
        </td>

        <!-- عملیات -->
        <td data-label="عملیات" class="text-left">
          <div class="flex items-center justify-end gap-1.5">
            <BaseButton variant="ghost" size="sm" @click="openChatViewer(conv)" title="مشاهده پیام‌ها">
              <Eye :size="14" />
            </BaseButton>
            <BaseButton variant="ghost" size="sm" class="text-destructive hover:bg-destructive/10" @click="$emit('deletePrompt', { type: 'conversation', id: conv.id, name: conv.title || 'گفتگو' })" title="حذف">
              <Trash2 :size="14" />
            </BaseButton>
          </div>
        </td>
      </template>
    </AdminTable>

    <!-- Chat Viewer Modal Component -->
    <ChatViewerModal
      :open="isViewerModalOpen"
      :conversation="inspectingConversation"
      :isLoading="isLoadingDetail"
      @close="isViewerModalOpen = false"
    />
  </div>
</template>

<style scoped>
.mono {
  font-family: var(--font-mono, monospace);
  direction: ltr;
}
</style>
