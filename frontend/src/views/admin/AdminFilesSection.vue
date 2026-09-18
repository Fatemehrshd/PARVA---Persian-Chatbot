<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { Eye, Trash2, RotateCw, FileText, CheckCircle2, Clock, AlertTriangle, X } from '@lucide/vue'
import AdminTable, { type TableColumn } from '../../components/admin/AdminTable.vue'
import BaseButton from '../../components/ui/BaseButton.vue'
import FileDetailModal from '../../components/admin/modals/FileDetailModal.vue'
import { adminService } from '../../services/admin.service'
import { formatIranDateTime } from '../../lib/date'
import { useUiStore } from '../../stores/ui'
import type { AdminFileItem, AdminFileStats, AdminFileDetail, AdminUser } from '../../types'

const props = defineProps<{
  searchQuery?: string
  userFilter?: AdminUser | null
}>()

defineEmits<{
  clearUserFilter: []
  deletePrompt: [target: { type: 'file'; id: string; name: string }]
}>()

const uiStore = useUiStore()
const files = ref<AdminFileItem[]>([])
const fileStats = ref<AdminFileStats | null>(null)
const isLoading = ref(false)
const errorMessage = ref('')

const statusFilter = ref<'all' | 'ready' | 'processing' | 'error'>('all')
const page = ref(1)
const limit = ref(10)
const totalItems = ref(0)
const sortBy = ref<string | undefined>(undefined)
const sortOrder = ref<'ASC' | 'DESC' | undefined>(undefined)
const columnFilters = ref<Record<string, string>>({})
const tableSearchQuery = ref(props.searchQuery || '')

const isDetailModalOpen = ref(false)
const inspectingFile = ref<AdminFileDetail | null>(null)
const isRetrying = ref(false)

const fileColumns: TableColumn[] = [
  { key: 'name', label: 'نام فایل و فرمت', width: '250px', sortable: true },
  { key: 'user', label: 'کاربر', width: '200px', sortable: true },
  { key: 'size', label: 'حجم فایل', width: '120px', sortable: true },
  { key: 'status', label: 'وضعیت پردازش', width: '130px', sortable: true },
  { key: 'createdAt', label: 'زمان آپلود', width: '160px', sortable: true },
  { key: 'actions', label: 'عملیات', align: 'left', width: '120px', sortable: false },
]

function formatFileSize(bytes?: number): string {
  if (!bytes) return '۰ B'
  const units = ['B', 'KB', 'MB', 'GB']
  let size = bytes
  let unitIndex = 0
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }
  return `${size.toFixed(1)} ${units[unitIndex]}`
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

async function loadFilesData() {
  isLoading.value = true
  errorMessage.value = ''
  try {
    const combinedSearch = (tableSearchQuery.value || props.searchQuery || '').trim()
    const params: any = {
      page: page.value,
      limit: limit.value,
      status: statusFilter.value === 'all' ? undefined : statusFilter.value,
      userId: props.userFilter?.id,
    }
    if (combinedSearch) params.search = combinedSearch
    if (sortBy.value) {
      params.sortBy = sortBy.value
      params.sortOrder = sortOrder.value
    }
    for (const [k, v] of Object.entries(columnFilters.value)) {
      if (v) params[k] = v
    }

    const [listRes, statsRes] = await Promise.allSettled([
      adminService.listFiles(params),
      adminService.getFileStats(),
    ])

    if (listRes.status === 'fulfilled') {
      const res = listRes.value
      files.value = res.items || []
      totalItems.value = res.total || 0
    }
    if (statsRes.status === 'fulfilled') {
      fileStats.value = statsRes.value
    }
  } catch (err: any) {
    errorMessage.value = err?.message || 'خطا در بارگذاری اطلاعات فایل‌ها'
  } finally {
    isLoading.value = false
  }
}

watch([() => props.searchQuery, () => props.userFilter, statusFilter], () => {
  if (props.searchQuery !== undefined) {
    tableSearchQuery.value = props.searchQuery
  }
  page.value = 1
  loadFilesData()
})

function handlePageChange(newPage: number) {
  page.value = newPage
  loadFilesData()
}

function handlePageSizeChange(newSize: number) {
  limit.value = newSize
  page.value = 1
  loadFilesData()
}

function handleSearch(query: string) {
  tableSearchQuery.value = query
  page.value = 1
  loadFilesData()
}

function handleSortChange(col: string | null, order: 'asc' | 'desc' | null) {
  sortBy.value = col || undefined
  sortOrder.value = order ? (order.toUpperCase() as 'ASC' | 'DESC') : undefined
  loadFilesData()
}

function handleColumnFilterChange(filters: Record<string, string>) {
  columnFilters.value = filters
  page.value = 1
  loadFilesData()
}

async function openFileDetail(file: AdminFileItem) {
  try {
    const detail = await adminService.getFileDetail(file.id)
    inspectingFile.value = detail
    isDetailModalOpen.value = true
  } catch (err: any) {
    uiStore.showToast(err?.message || 'خطا در دریافت جزئیات فایل', 'error')
  }
}

async function handleRetry(file: AdminFileDetail) {
  isRetrying.value = true
  try {
    await adminService.retryFile(file.id)
    uiStore.showToast('درخواست پردازش مجدد با موفقیت ارسال شد.', 'success')
    isDetailModalOpen.value = false
    await loadFilesData()
  } catch (err: any) {
    uiStore.showToast(err?.message || 'خطا در ارسال پردازش مجدد', 'error')
  } finally {
    isRetrying.value = false
  }
}

onMounted(loadFilesData)
</script>

<template>
  <div class="files-section space-y-5">
    <div class="section-toolbar flex items-center justify-between">
      <div>
        <h3 class="text-base font-bold text-foreground">مدیریت و پایش فایل‌های کاربران</h3>
        <p class="text-xs text-muted-foreground mt-0.5">بررسی وضعیت استخراج متون، صف پردازش و خطاهای پردازشی</p>
      </div>
      <BaseButton variant="secondary" size="sm" @click="loadFilesData" :loading="isLoading">
        <RotateCw :size="14" />
        <span>به‌روزرسانی آمار</span>
      </BaseButton>
    </div>

    <!-- Active User Filter Banner -->
    <div v-if="userFilter" class="user-filter-banner p-3 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-between">
      <div class="flex items-center gap-2 text-xs">
        <span class="text-primary font-bold">فیلتر فعال:</span>
        <span>نمایش فایل‌های آپلود شده توسط کاربر <strong>{{ userFilter.displayName || userFilter.email }}</strong></span>
      </div>
      <button
        type="button"
        class="text-xs px-2 py-1 rounded bg-card hover:bg-muted border border-border flex items-center gap-1 cursor-pointer"
        @click="$emit('clearUserFilter')"
      >
        <X :size="12" />
        <span>حذف فیلتر کاربر</span>
      </button>
    </div>

    <div v-if="errorMessage" class="error-banner p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive">
      {{ errorMessage }}
    </div>

    <!-- File KPI Stats Cards -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <div class="stat-card p-3.5 rounded-xl border border-border bg-card shadow-sm">
        <div class="flex items-center justify-between">
          <span class="text-xs text-muted-foreground">کل فایل‌ها</span>
          <FileText :size="16" class="text-primary" />
        </div>
        <strong class="text-xl font-bold font-mono text-foreground mt-1 block">
          {{ fileStats?.totalFiles !== undefined ? Number(fileStats.totalFiles).toLocaleString('fa-IR') : '—' }}
        </strong>
      </div>

      <div class="stat-card p-3.5 rounded-xl border border-border bg-card shadow-sm">
        <div class="flex items-center justify-between">
          <span class="text-xs text-muted-foreground">آماده و موفق</span>
          <CheckCircle2 :size="16" class="text-emerald-500" />
        </div>
        <strong class="text-xl font-bold font-mono text-emerald-600 mt-1 block">
          {{ fileStats?.readyFiles !== undefined ? Number(fileStats.readyFiles).toLocaleString('fa-IR') : '—' }}
        </strong>
      </div>

      <div class="stat-card p-3.5 rounded-xl border border-border bg-card shadow-sm">
        <div class="flex items-center justify-between">
          <span class="text-xs text-muted-foreground">در حال پردازش</span>
          <Clock :size="16" class="text-amber-500" />
        </div>
        <strong class="text-xl font-bold font-mono text-amber-600 mt-1 block">
          {{ fileStats?.processingFiles !== undefined ? Number(fileStats.processingFiles).toLocaleString('fa-IR') : '—' }}
        </strong>
      </div>

      <div class="stat-card p-3.5 rounded-xl border border-border bg-card shadow-sm">
        <div class="flex items-center justify-between">
          <span class="text-xs text-muted-foreground">دارای خطا</span>
          <AlertTriangle :size="16" class="text-rose-500" />
        </div>
        <strong class="text-xl font-bold font-mono text-rose-600 mt-1 block">
          {{ fileStats?.errorFiles !== undefined ? Number(fileStats.errorFiles).toLocaleString('fa-IR') : '—' }}
        </strong>
      </div>
    </div>

    <!-- Status Tabs -->
    <div class="status-tabs flex items-center gap-1.5 p-1 rounded-lg bg-muted/50 border border-border w-fit text-xs">
      <button
        type="button"
        class="tab-btn px-3 py-1.5 rounded-md transition-colors cursor-pointer font-medium"
        :class="statusFilter === 'all' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'"
        @click="statusFilter = 'all'"
      >
        همه فایل‌ها
      </button>
      <button
        type="button"
        class="tab-btn px-3 py-1.5 rounded-md transition-colors cursor-pointer font-medium"
        :class="statusFilter === 'ready' ? 'bg-card text-emerald-600 shadow-sm' : 'text-muted-foreground hover:text-foreground'"
        @click="statusFilter = 'ready'"
      >
        آماده (موفق)
      </button>
      <button
        type="button"
        class="tab-btn px-3 py-1.5 rounded-md transition-colors cursor-pointer font-medium"
        :class="statusFilter === 'processing' ? 'bg-card text-amber-600 shadow-sm' : 'text-muted-foreground hover:text-foreground'"
        @click="statusFilter = 'processing'"
      >
        در حال پردازش
      </button>
      <button
        type="button"
        class="tab-btn px-3 py-1.5 rounded-md transition-colors cursor-pointer font-medium"
        :class="statusFilter === 'error' ? 'bg-card text-rose-600 shadow-sm' : 'text-muted-foreground hover:text-foreground'"
        @click="statusFilter = 'error'"
      >
        دارای خطا
      </button>
    </div>

    <!-- Files Table -->
    <AdminTable
      :columns="fileColumns"
      :items="files"
      serverSide
      paginated
      searchable
      :currentPage="page"
      :pageSize="limit"
      :totalItems="totalItems"
      :pageSizes="[10, 25, 50, 100]"
      :searchQuery="tableSearchQuery"
      @update:page="handlePageChange"
      @update:pageSize="handlePageSizeChange"
      @search="handleSearch"
      @sortChange="handleSortChange"
      @columnFilterChange="handleColumnFilterChange"
    >
      <template #row="{ item: file }">
        <!-- نام فایل و نوع -->
        <td data-label="نام فایل و فرمت">
          <div class="file-name-cell flex items-center gap-2.5">
            <span :class="['att-badge px-2 py-0.5 rounded text-[10px] font-bold uppercase shrink-0', getAttBadgeClass(file.fileType)]">
              {{ file.fileType }}
            </span>
            <div class="overflow-hidden">
              <strong class="block text-xs font-semibold text-foreground truncate max-w-[190px]" :title="file.originalName">
                {{ file.originalName }}
              </strong>
              <span class="subtext mono text-[10px] text-muted-foreground block truncate">{{ file.id.slice(0, 8) }}...</span>
            </div>
          </div>
        </td>

        <!-- کاربر -->
        <td data-label="کاربر">
          <div class="user-cell flex items-center gap-2">
            <div class="avatar-chip w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
              {{ (file.user?.displayName || file.user?.email || 'U').charAt(0).toUpperCase() }}
            </div>
            <div class="overflow-hidden">
              <strong class="block text-xs font-medium text-foreground truncate max-w-[150px]">
                {{ file.user?.displayName || '—' }}
              </strong>
              <span class="subtext mono text-[10px] text-muted-foreground block truncate max-w-[150px]">
                {{ file.user?.email || 'کاربر ناشناس' }}
              </span>
            </div>
          </div>
        </td>

        <!-- حجم -->
        <td data-label="حجم فایل" class="mono text-xs text-muted-foreground">
          {{ formatFileSize(file.fileSize) }}
        </td>

        <!-- وضعیت پردازش -->
        <td data-label="وضعیت پردازش">
          <span :class="['px-2.5 py-0.5 rounded-full text-[11px] font-medium border', getStatusClass(file.status)]">
            {{ getStatusLabel(file.status) }}
          </span>
        </td>

        <!-- زمان آپلود -->
        <td data-label="زمان آپلود" class="mono text-xs text-muted-foreground">
          {{ formatIranDateTime(file.createdAt) }}
        </td>

        <!-- عملیات -->
        <td data-label="عملیات" class="text-left">
          <div class="flex items-center justify-end gap-1.5">
            <BaseButton variant="ghost" size="sm" @click="openFileDetail(file)" title="مشاهده لاگ و جزئیات">
              <Eye :size="14" />
            </BaseButton>
            <BaseButton variant="ghost" size="sm" class="text-destructive hover:bg-destructive/10" @click="$emit('deletePrompt', { type: 'file', id: file.id, name: file.originalName })" title="حذف">
              <Trash2 :size="14" />
            </BaseButton>
          </div>
        </td>
      </template>
    </AdminTable>

    <!-- File Detail Modal Component -->
    <FileDetailModal
      :open="isDetailModalOpen"
      :file="inspectingFile"
      :isRetrying="isRetrying"
      @close="isDetailModalOpen = false"
      @retry="handleRetry"
    />
  </div>
</template>

<style scoped>
.mono {
  font-family: var(--font-mono, monospace);
  direction: ltr;
}
.badge-pdf { background: rgba(239, 68, 68, 0.15); color: #ef4444; }
.badge-excel { background: rgba(34, 197, 94, 0.15); color: #22c55e; }
.badge-image { background: rgba(59, 130, 246, 0.15); color: #3b82f6; }
.badge-text { background: rgba(168, 85, 247, 0.15); color: #a855f7; }
</style>
