<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { Edit, FileText } from '@lucide/vue'
import AdminTable, { type TableColumn } from '../../components/admin/AdminTable.vue'
import BaseButton from '../../components/ui/BaseButton.vue'
import BaseToggle from '../../components/ui/BaseToggle.vue'
import UserEditorModal from '../../components/admin/modals/UserEditorModal.vue'
import { adminService } from '../../services/admin.service'
import { useUiStore } from '../../stores/ui'
import type { AdminUser } from '../../types'

const props = defineProps<{
  searchQuery?: string
}>()

defineEmits<{
  filterFiles: [user: AdminUser]
}>()

const uiStore = useUiStore()
const users = ref<AdminUser[]>([])
const isLoading = ref(false)
const isSaving = ref(false)
const errorMessage = ref('')
const tokenRatePer1000 = ref(10)

const isEditorModalOpen = ref(false)
const editingUser = ref<AdminUser | null>(null)

// Column definitions with explicit widths for perfect alignment
const userColumns: TableColumn[] = [
  { key: 'user', label: 'کاربر (نام و ایمیل)', width: '240px', sortable: true },
  { key: 'role', label: 'نقش کاربری', width: '120px', sortable: true },
  { key: 'creditStatus', label: 'وضعیت سقف و مصرف توکن', width: '260px', sortable: true },
  { key: 'conversations', label: 'تعداد گفتگوها', width: '120px', sortable: true },
  { key: 'isActive', label: 'وضعیت فعالیت', width: '110px' },
  { key: 'actions', label: 'عملیات', align: 'left', width: '110px', sortable: false },
]

function tokensToDollars(tokens: number): number {
  return Number(((tokens / 1000) * tokenRatePer1000.value).toFixed(2))
}

function getUserStats(user: AdminUser) {
  const used = Number(user.usedTokens || 0)
  const limit = user.tokenLimit !== null && user.tokenLimit !== undefined ? Number(user.tokenLimit) : null
  const hasLimit = limit !== null && limit > 0
  const usedPercent = hasLimit ? Math.min(100, Math.round((used / limit) * 100)) : 0

  let statusColor = 'text-emerald-500'
  let barColor = 'bg-emerald-500'
  let badgeLabel = 'مصرف نرمال'
  let badgeClass = 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'

  if (usedPercent >= 90) {
    statusColor = 'text-rose-500'
    barColor = 'bg-rose-500'
    badgeLabel = usedPercent >= 100 ? 'اتمام سهمیه' : 'در آستانه اتمام'
    badgeClass = 'bg-rose-500/10 text-rose-600 border-rose-500/20'
  } else if (usedPercent >= 70) {
    statusColor = 'text-amber-500'
    barColor = 'bg-amber-500'
    badgeLabel = 'هشدار مصرف'
    badgeClass = 'bg-amber-500/10 text-amber-600 border-amber-500/20'
  }

  return {
    used,
    limit,
    hasLimit,
    usedPercent,
    statusColor,
    barColor,
    badgeLabel,
    badgeClass,
  }
}

const page = ref(1)
const pageSize = ref(10)
const totalItems = ref(0)
const sortBy = ref<string | undefined>(undefined)
const sortOrder = ref<'ASC' | 'DESC' | undefined>(undefined)
const columnFilters = ref<Record<string, string>>({})
const tableSearchQuery = ref(props.searchQuery || '')

async function loadUsers() {
  isLoading.value = true
  errorMessage.value = ''
  try {
    const combinedSearch = (tableSearchQuery.value || props.searchQuery || '').trim()
    const params: any = {
      page: page.value,
      limit: pageSize.value,
    }
    if (combinedSearch) {
      params.search = combinedSearch
    }
    if (sortBy.value) {
      params.sortBy = sortBy.value
      params.sortOrder = sortOrder.value
    }
    for (const [k, v] of Object.entries(columnFilters.value)) {
      if (v) params[k] = v
    }

    const [uRes, sRes] = await Promise.allSettled([
      adminService.listUsers(params),
      adminService.getSettings(),
    ])

    if (uRes.status === 'fulfilled') {
      const val = uRes.value
      if (val && typeof val === 'object' && 'items' in val) {
        users.value = (val as any).items || []
        totalItems.value = (val as any).total || 0
      } else if (Array.isArray(val)) {
        users.value = val
        totalItems.value = val.length
      }
    }
    if (sRes.status === 'fulfilled' && sRes.value?.tokenRatePer1000) {
      tokenRatePer1000.value = sRes.value.tokenRatePer1000
    }
  } catch (err: any) {
    errorMessage.value = err?.message || 'خطا در دریافت لیست کاربران'
  } finally {
    isLoading.value = false
  }
}

watch(() => props.searchQuery, (newVal) => {
  tableSearchQuery.value = newVal || ''
  page.value = 1
  loadUsers()
})

function handlePageChange(newPage: number) {
  page.value = newPage
  loadUsers()
}

function handlePageSizeChange(newSize: number) {
  pageSize.value = newSize
  page.value = 1
  loadUsers()
}

function handleSearch(query: string) {
  tableSearchQuery.value = query
  page.value = 1
  loadUsers()
}

function handleSortChange(col: string | null, order: 'asc' | 'desc' | null) {
  sortBy.value = col || undefined
  sortOrder.value = order ? (order.toUpperCase() as 'ASC' | 'DESC') : undefined
  loadUsers()
}

function handleColumnFilterChange(filters: Record<string, string>) {
  columnFilters.value = filters
  page.value = 1
  loadUsers()
}

function openEditModal(user: AdminUser) {
  editingUser.value = user
  isEditorModalOpen.value = true
}

async function handleSaveUser(payload: { displayName?: string; email?: string; role?: 'user' | 'admin'; tokenLimit?: number | null }) {
  if (!editingUser.value) return
  isSaving.value = true
  try {
    await adminService.updateUser(editingUser.value.id, payload)
    uiStore.showToast('اطلاعات کاربر با موفقیت ویرایش شد.', 'success')
    isEditorModalOpen.value = false
    await loadUsers()
  } catch (err: any) {
    uiStore.showToast(err?.message || 'خطا در ویرایش کاربر', 'error')
  } finally {
    isSaving.value = false
  }
}

async function toggleUserStatus(user: AdminUser) {
  try {
    await adminService.updateUserStatus(user.id, !user.isActive)
    user.isActive = !user.isActive
    uiStore.showToast(`وضعیت کاربر «${user.displayName || user.email}» به‌روز شد.`, 'info')
  } catch (err: any) {
    uiStore.showToast(err?.message || 'خطا در تغییر وضعیت کاربر', 'error')
  }
}

onMounted(loadUsers)
</script>

<template>
  <div class="users-section space-y-4">
    <div class="section-toolbar flex items-center justify-between">
      <div>
        <h3 class="text-base font-bold text-foreground">مدیریت کاربران سامانه</h3>
        <p class="text-xs text-muted-foreground mt-0.5">مشاهده سوابق مصرف، تخصیص اعتبار دلاری و تعیین سقف مجاز توکن</p>
      </div>
      <span class="record-badge text-xs px-2.5 py-1 rounded-full bg-secondary border border-border text-muted-foreground font-mono">
        {{ (totalItems || users.length).toLocaleString('fa-IR') }} کاربر
      </span>
    </div>

    <div v-if="errorMessage" class="error-banner p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive">
      {{ errorMessage }}
    </div>

    <AdminTable
      :columns="userColumns"
      :items="users"
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
      <template #row="{ item: user }">
        <!-- کاربر: نام و ایمیل -->
        <td data-label="کاربر">
          <div class="user-cell flex items-center gap-2.5">
            <div class="avatar-chip w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
              {{ (user.displayName || user.email).charAt(0).toUpperCase() }}
            </div>
            <div class="overflow-hidden">
              <strong class="block text-xs font-semibold text-foreground truncate max-w-[170px]" :title="user.displayName || '—'">
                {{ user.displayName || '—' }}
              </strong>
              <span class="subtext mono text-[11px] text-muted-foreground block truncate max-w-[170px]">{{ user.email }}</span>
            </div>
          </div>
        </td>

        <!-- نقش -->
        <td data-label="نقش">
          <span
            class="tag text-xs px-2.5 py-1 rounded-md font-medium"
            :class="user.role === 'admin' ? 'bg-primary/15 text-primary border border-primary/25' : 'bg-muted text-muted-foreground border border-border'"
          >
            {{ user.role === 'admin' ? 'مدیر سیستم' : 'کاربر عادی' }}
          </span>
        </td>

        <!-- وضعیت سقف و مصرف توکن (کاملاً صاف، بدون چرخش و هماهنگ با سایر ستون‌های عددی) -->
        <td data-label="وضعیت سقف و مصرف توکن">
          <div class="credit-metric-cell space-y-1.5 py-1">
            <div class="flex items-center justify-between text-xs">
              <span class="font-mono font-bold text-foreground">
                {{ Number(user.usedTokens || 0).toLocaleString('fa-IR') }}
                <span class="text-[11px] font-normal text-muted-foreground">
                  / {{ user.tokenLimit ? Number(user.tokenLimit).toLocaleString('fa-IR') : 'نامحدود' }} توکن
                </span>
              </span>
              <span
                v-if="getUserStats(user).hasLimit"
                class="font-mono text-[11px] font-bold"
                :class="getUserStats(user).statusColor"
              >
                {{ getUserStats(user).usedPercent }}٪
              </span>
              <span v-else class="text-[11px] text-muted-foreground font-mono">∞</span>
            </div>

            <!-- نوار پیشرفت افقی صاف و تمیز -->
            <div v-if="getUserStats(user).hasLimit" class="progress-track w-full h-1.5 rounded-full bg-muted/60 overflow-hidden">
              <div
                class="progress-fill h-full rounded-full transition-all duration-300"
                :class="getUserStats(user).barColor"
                :style="{ width: `${getUserStats(user).usedPercent}%` }"
              />
            </div>

            <div class="flex items-center justify-between text-[10px] text-muted-foreground font-mono">
              <span>${{ tokensToDollars(Number(user.usedTokens || 0)) }} مصرفی</span>
              <span
                class="px-1.5 py-0.2 rounded text-[10px] font-medium border"
                :class="getUserStats(user).badgeClass"
              >
                {{ getUserStats(user).badgeLabel }}
              </span>
            </div>
          </div>
        </td>

        <!-- تعداد گفتگوها -->
        <td data-label="گفتگوها" class="mono font-semibold text-xs text-foreground">
          {{ Number(user.conversationsCount || 0).toLocaleString('fa-IR') }}
        </td>

        <!-- وضعیت فعالیت -->
        <td data-label="وضعیت فعالیت">
          <BaseToggle
            :model-value="user.isActive !== false"
            size="sm"
            @update:model-value="toggleUserStatus(user)"
          />
        </td>

        <!-- عملیات -->
        <td data-label="عملیات" class="text-left">
          <div class="flex items-center justify-end gap-1.5">
            <BaseButton variant="ghost" size="sm" @click="openEditModal(user)" title="ویرایش و شارژ">
              <Edit :size="14" />
            </BaseButton>
            <BaseButton variant="ghost" size="sm" @click="$emit('filterFiles', user)" title="مشاهده فایل‌های کاربر">
              <FileText :size="14" />
            </BaseButton>
          </div>
        </td>
      </template>
    </AdminTable>

    <!-- User Editor & Recharge Modal Component -->
    <UserEditorModal
      :open="isEditorModalOpen"
      :user="editingUser"
      :tokenRatePer1000="tokenRatePer1000"
      :isSaving="isSaving"
      @close="isEditorModalOpen = false"
      @save="handleSaveUser"
    />
  </div>
</template>

<style scoped>
.mono {
  font-family: var(--font-mono, monospace);
  direction: ltr;
}
</style>
