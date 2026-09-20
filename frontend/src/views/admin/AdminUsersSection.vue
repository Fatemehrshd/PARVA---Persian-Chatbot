<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { Edit, FileText, CreditCard } from '@lucide/vue'
import AdminTable, { type TableColumn } from '../../components/admin/AdminTable.vue'
import AdminTableSkeleton from '../../components/admin/AdminTableSkeleton.vue'
import BaseButton from '../../components/ui/BaseButton.vue'
import BaseToggle from '../../components/ui/BaseToggle.vue'
import UserEditorModal from '../../components/admin/modals/UserEditorModal.vue'
import AssignSubscriptionModal from '../../components/admin/modals/AssignSubscriptionModal.vue'
import { adminService } from '../../services/admin.service'
import { subscriptionService } from '../../services/subscription.service'
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
// تنظیمات سقف‌ها برای resolve زنده سقف مؤثر هر کاربر (اختصاصی ← نقش ← سراسری)
const roleTokenLimits = ref<Record<string, number>>({})
const roleQuotas = ref<Record<string, any>>({})
const globalTokenLimit = ref(0)

const isEditorModalOpen = ref(false)
const editingUser = ref<AdminUser | null>(null)

// Column definitions with explicit widths for perfect alignment
const userColumns: TableColumn[] = [
  { key: 'displayName', label: 'کاربر (نام و ایمیل)', width: '240px', sortable: true },
  { key: 'role', label: 'نقش کاربری', width: '120px', sortable: true, align: 'center' },
  { key: 'creditStatus', label: 'وضعیت سقف و مصرف توکن', width: '170px', sortable: true, align: 'center' },
  { key: 'remaining', label: 'باقی‌مانده', width: '110px', sortable: false, align: 'center' },
  { key: 'conversations', label: 'تعداد گفتگوها', width: '120px', sortable: true, align: 'center' },
  { key: 'isActive', label: 'وضعیت فعالیت', width: '110px', align: 'center' },
  { key: 'actions', label: 'عملیات', align: 'center', width: '110px', sortable: false },
]

function tokensToDollars(tokens: number): number {
  return Number(((tokens / 1000) * tokenRatePer1000.value).toFixed(2))
}

/** منبع سقف مؤثر کاربر برای نمایش تگ در جدول. */
function limitSourceFor(user: AdminUser): 'personal' | 'plan' | 'role' | 'global' | 'admin' {
  if (user.role === 'admin' || user.tokenLimitSource === 'admin') return 'admin'
  if (user.tokenLimit !== null && user.tokenLimit !== undefined && Number(user.tokenLimit) > 0) return 'personal'
  if (user.tokenLimitSource === 'plan') return 'plan'
  const rl = roleQuotas.value[user.role || '']?.tokenLimit ?? roleTokenLimits.value[user.role || '']
  if (rl !== undefined && rl !== null && Number(rl) > 0) return 'role'
  if (user.tokenLimitSource && ['personal', 'plan', 'role', 'global', 'admin'].includes(user.tokenLimitSource)) {
    return user.tokenLimitSource
  }
  return 'global'
}

/** سقف مؤثر: با اولویت آبشاری: مدیر ← اختصاصی ← طرح اشتراک ← سقف نقش ← سقف سراسری */
function effectiveLimitFor(user: AdminUser): number | null {
  // ۱. مدیر سیستم همیشه نامحدود است
  if (user.role === 'admin' || user.tokenLimitSource === 'admin') {
    return null
  }
  // ۲. سهمیه اختصاصی کاربر
  if (user.tokenLimit !== null && user.tokenLimit !== undefined && Number(user.tokenLimit) > 0) {
    return Number(user.tokenLimit)
  }
  // ۳. سقف محاسبه شده مؤثر از بک‌اند (که اشتراک و نقش را مد نظر دارد)
  if (user.effectiveTokenLimit !== null && user.effectiveTokenLimit !== undefined) {
    return Number(user.effectiveTokenLimit) > 0 ? Number(user.effectiveTokenLimit) : null
  }
  // ۴. سهمیه مشخص نقش کاربر (در صورت وجود مقدار مثبت)
  const rl = roleQuotas.value[user.role || '']?.tokenLimit ?? roleTokenLimits.value[user.role || '']
  if (rl !== undefined && rl !== null && Number(rl) > 0) {
    return Number(rl)
  }
  // ۵. ارث‌بری از سقف سراسری سامانه
  const global = Number(globalTokenLimit.value)
  return global > 0 ? global : null
}

function getUserStats(user: AdminUser) {
  const used = Number(user.periodUsedTokens ?? user.usedTokens ?? 0)
  const limit = effectiveLimitFor(user)
  const limitSource = limitSourceFor(user)
  const hasLimit = limit !== null && limit > 0
  const remaining = hasLimit ? Math.max(0, limit! - used) : null
  // درصد مؤثر از بک‌اند می‌آید (min سقف توکن و سقف پیام، مطابق سایدبار کاربر).
  // اگر نیامد، fallback فقط توکن محاسبه می‌شود تا عدد همیشه با سایدبار سینک باشد.
  const remainingPercent =
    user.remainingPercent !== undefined && user.remainingPercent !== null
      ? Number(user.remainingPercent)
      : hasLimit
        ? Math.round((remaining! / limit!) * 100)
        : null

  // رنگ‌بندی بر اساس میزان باقی‌مانده: >۵۰٪ سبز، ۲۰-۵۰٪ نارنجی، <۲۰٪ قرمز
  let statusColor = 'text-emerald-500'
  if (hasLimit && remainingPercent !== null) {
    if (remainingPercent <= 20) {
      statusColor = 'text-rose-500'
    } else if (remainingPercent <= 50) {
      statusColor = 'text-amber-500'
    }
  }

  return {
    used,
    limit,
    remaining,
    remainingPercent,
    limitSource,
    hasLimit,
    statusColor,
  }
}

const page = ref(1)
const pageSize = ref(10)
const totalItems = ref(0)
const sortBy = ref<string | undefined>(undefined)
const sortOrder = ref<'ASC' | 'DESC' | undefined>(undefined)
const columnFilters = ref<Record<string, string>>({})
const tableSearchQuery = ref(props.searchQuery || '')
const searchField = ref('')

async function loadUsers(silent = false) {
  isLoading.value = silent ? isLoading.value : true
  errorMessage.value = silent ? '' : errorMessage.value
  try {
    const combinedSearch = (tableSearchQuery.value || props.searchQuery || '').trim()
    const params: any = {
      page: page.value,
      limit: pageSize.value,
    }
    if (combinedSearch) {
      params.search = combinedSearch
    }
    if (searchField.value) params.searchField = searchField.value
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
    if (sRes.status === 'fulfilled' && sRes.value) {
      if (sRes.value.tokenRatePer1000) {
        tokenRatePer1000.value = sRes.value.tokenRatePer1000
      }
      roleTokenLimits.value = (sRes.value as any).roleTokenLimits || {}
      roleQuotas.value = (sRes.value as any).roleQuotas || {}
      globalTokenLimit.value = (sRes.value as any).globalTokenLimit || 0
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

function handleSearch(query: string, field?: string) {
  tableSearchQuery.value = query
  searchField.value = field || ''
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

/** فقط کلیدهای مشخص‌شده (non-undefined) را روی ردیف اعمال می‌کند. */
function patchUserRow(row: AdminUser, fields: Record<string, any>) {
  for (const [k, v] of Object.entries(fields)) {
    // `k in row` نادیده گرفته می‌شود تا فیلدهای جدید (مثل remainingPercent)
    // که بک‌اند تازه اضافه کرده هم روی ردیف ست شوند.
    if (v !== undefined) (row as any)[k] = v
  }
}

/**
 * درصد باقی‌ماندهٔ مؤثر را محلی (optimistic) با فرمول مشترک بک‌اند محاسبه می‌کند:
 * min(درصد توکن، درصد پیام). در غیر این صورت سایدبار کاربر و جدول ادمین
 * بلافاصله بعد از ادیت از هم دور می‌شوند.
 */
function computeLocalRemainingPercent(
  row: AdminUser,
  tokenLimit: number | null,
  messageLimit: number | null,
): number | null {
  const usedTokens = Number(row.periodUsedTokens ?? row.usedTokens ?? 0)
  const usedMessages = Number(row.periodUsedMessages ?? 0)
  const pcts: number[] = []
  if (tokenLimit && tokenLimit > 0) {
    pcts.push(Math.max(0, Math.min(100, Math.round(((tokenLimit - usedTokens) / tokenLimit) * 100))))
  }
  if (messageLimit && messageLimit > 0) {
    pcts.push(Math.max(0, Math.min(100, Math.round(((messageLimit - usedMessages) / messageLimit) * 100))))
  }
  if (pcts.length === 0) return null
  return Math.min(...pcts)
}

async function handleSaveUser(payload: {
  displayName?: string
  email?: string
  role?: 'user' | 'admin'
  tokenLimit?: number | null
  messageLimit?: number | null
  newPlanId?: string
  durationDays?: number
}) {
  if (!editingUser.value) return
  isSaving.value = true
  const target = users.value.find((u) => u.id === editingUser.value!.id)
  const { newPlanId, durationDays, ...userFields } = payload
  // snapshot برای rollback در صورت خطا
  const backup = target ? { ...target } : null
  if (target) {
    // optimistic: بلافاصله روی ردیف جدول اعمال می‌شود
    patchUserRow(target, { ...userFields, tokenLimit: userFields.tokenLimit ?? null, messageLimit: userFields.messageLimit ?? null })
    // درصد مؤثر هم فوراً با سقف جدید recompute می‌شود تا با سایدبار همگام بماند
    patchUserRow(target, {
      remainingPercent: computeLocalRemainingPercent(
        target,
        userFields.tokenLimit ?? target.tokenLimit ?? null,
        userFields.messageLimit ?? target.messageLimit ?? null,
      ),
    })
  }
  try {
    await adminService.updateUser(editingUser.value.id, userFields)

    if (newPlanId) {
      await subscriptionService.assignSubscription({
        userId: editingUser.value.id,
        planId: newPlanId,
        durationDays,
      })
    }

    uiStore.showToast('اطلاعات کاربر با موفقیت به‌روزرسانی شد.', 'success')
    isEditorModalOpen.value = false
    // همگام‌سازی بی‌صدا با سرور (بدون فلش لودینگ)؛ در صورت خطا rollback شده‌ایم
    await loadUsers(true).catch(() => {})
  } catch (err: any) {
    if (target && backup) {
      Object.assign(target, backup)
    }
    uiStore.showToast(err?.message || 'خطا در ویرایش کاربر', 'error')
  } finally {
    isSaving.value = false
  }
}

const isAssignModalOpen = ref(false)
const assigningUser = ref<AdminUser | null>(null)
const isAssigning = ref(false)

function openAssignSubscriptionModal(user: AdminUser) {
  assigningUser.value = user
  isAssignModalOpen.value = true
}

async function handleAssignSubscription(data: { userId: string; planId: string; durationDays?: number }) {
  isAssigning.value = true
  try {
    await subscriptionService.assignSubscription(data)
    uiStore.showToast('اشتراک کاربر با موفقیت اختصاص داده شد.', 'success')
    isAssignModalOpen.value = false
    assigningUser.value = null
    await loadUsers()
  } catch (err: any) {
    uiStore.showToast(err?.message || 'خطا در تخصیص اشتراک کاربر', 'error')
  } finally {
    isAssigning.value = false
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

    <AdminTableSkeleton v-if="isLoading && !users.length" :rows="pageSize || 8" :columns="userColumns.length" />

    <AdminTable
      v-else
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
      :searchFields="[
        { key: 'displayName', label: 'نام کاربر' },
        { key: 'email', label: 'ایمیل' },
        { key: 'username', label: 'نام کاربری' },
      ]"
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
        <td data-label="نقش" class="text-center">
          <span
            class="tag text-xs px-2.5 py-1 rounded-md font-medium"
            :class="user.role === 'admin' ? 'bg-primary/15 text-primary border border-primary/25' : 'bg-muted text-muted-foreground border border-border'"
          >
            {{ user.role === 'admin' ? 'مدیر سیستم' : 'کاربر عادی' }}
          </span>
        </td>

        <!-- وضعیت سقف و مصرف توکن: مصرف / سقف مؤثر + هزینه مصرفی -->
        <td data-label="وضعیت سقف و مصرف توکن" class="text-center">
          <div class="credit-metric-cell space-y-1 py-1">
            <div class="text-xs flex items-center justify-center gap-1.5 flex-wrap">
              <span class="font-mono font-bold text-foreground">
                {{ Number(getUserStats(user).used).toLocaleString('fa-IR') }}
                <span class="text-[11px] font-normal text-muted-foreground">
                  / {{ getUserStats(user).hasLimit ? Number(getUserStats(user).limit).toLocaleString('fa-IR') : 'نامحدود' }}
                </span>
              </span>
              <span
                v-if="getUserStats(user).limitSource === 'admin'"
                class="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-500 border border-amber-500/25 font-sans font-medium"
                title="دسترسی نامحدود مدیر سیستم"
              >
                مدیر
              </span>
              <span
                v-else-if="getUserStats(user).limitSource === 'personal'"
                class="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-500 border border-blue-500/25 font-sans font-medium"
                title="سهمیه اختصاصی تعیین‌شده برای این کاربر"
              >
                اختصاصی
              </span>
              <span
                v-else-if="getUserStats(user).limitSource === 'plan'"
                class="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-500 border border-purple-500/25 font-sans font-medium"
                :title="user.planName ? `طرح اشتراک فعال: ${user.planName}` : 'ارث‌بری از طرح اشتراک'"
              >
                {{ user.planName || 'طرح اشتراک' }}
              </span>
              <span
                v-else-if="getUserStats(user).limitSource === 'role'"
                class="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-500 border border-indigo-500/25 font-sans font-medium"
                title="ارث‌بری خودکار از سقف نقش"
              >
                از نقش
              </span>
              <span
                v-else
                class="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground border border-border font-sans font-medium"
                title="ارث‌بری از سقف سراسری سامانه"
              >
                سراسری
              </span>
            </div>
            <div class="text-[11px] text-muted-foreground font-mono">
              ${{ Number(user.usedCostUsd ?? tokensToDollars(Number(user.usedTokens || 0))).toLocaleString('fa-IR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }} مصرفی
            </div>
            <div v-if="user.effectiveMessageLimit || user.messageLimit" class="text-[10px] text-muted-foreground font-sans">
              سقف پیام: {{ Number(user.effectiveMessageLimit || user.messageLimit).toLocaleString('fa-IR') }}
              <span v-if="user.messageLimit" class="text-blue-500 font-semibold">(اختصاصی)</span>
              <span v-else-if="user.tokenLimitSource === 'plan'" class="text-purple-500 font-semibold">(از طرح)</span>
              <span v-else class="text-indigo-500 font-semibold">(از نقش)</span>
            </div>
          </div>
        </td>

        <!-- باقی‌مانده: درصد باقی‌مانده سقف مؤثر (>۵۰٪ سبز، ۲۰-۵۰٪ نارنجی، <۲۰٪ قرمز) -->
        <td data-label="باقی‌مانده" class="text-center">
          <span class="font-mono text-xs font-bold" :class="getUserStats(user).statusColor">
            <template v-if="getUserStats(user).hasLimit">
              {{ Number(getUserStats(user).remainingPercent).toLocaleString('fa-IR') }}٪
            </template>
            <template v-else>∞</template>
          </span>
        </td>

        <!-- تعداد گفتگوها -->
        <td data-label="گفتگوها" class="mono font-semibold text-xs text-foreground text-center">
          {{ Number(user.conversationsCount || 0).toLocaleString('fa-IR') }}
        </td>

        <!-- وضعیت فعالیت -->
        <td data-label="وضعیت فعالیت" class="text-center">
          <BaseToggle
            :model-value="user.isActive !== false"
            size="sm"
            @update:model-value="toggleUserStatus(user)"
          />
        </td>

        <!-- عملیات -->
        <td data-label="عملیات" class="text-center">
          <div class="flex items-center justify-center gap-1.5">
            <BaseButton variant="ghost" size="sm" @click="openAssignSubscriptionModal(user)" title="تغییر یا تخصیص اشتراک">
              <CreditCard :size="14" class="text-purple-500" />
            </BaseButton>
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
      :inheritedTokenLimit="editingUser ? (
        (roleQuotas[editingUser.role]?.tokenLimit && Number(roleQuotas[editingUser.role]?.tokenLimit) > 0 ? Number(roleQuotas[editingUser.role]?.tokenLimit) : null)
        ?? (roleTokenLimits[editingUser.role] && Number(roleTokenLimits[editingUser.role]) > 0 ? Number(roleTokenLimits[editingUser.role]) : null)
        ?? (Number(globalTokenLimit) > 0 ? Number(globalTokenLimit) : null)
      ) : null"
      :inheritedMessageLimit="editingUser ? (
        (roleQuotas[editingUser.role]?.messageLimit && Number(roleQuotas[editingUser.role]?.messageLimit) > 0 ? Number(roleQuotas[editingUser.role]?.messageLimit) : null)
      ) : null"
      @close="isEditorModalOpen = false"
      @save="handleSaveUser"
    />

    <!-- Assign Subscription Modal Component -->
    <AssignSubscriptionModal
      :open="isAssignModalOpen"
      :is-saving="isAssigning"
      :initial-user-id="assigningUser?.id"
      :initial-plan-id="assigningUser?.planId || undefined"
      :user-name="assigningUser?.displayName ? `${assigningUser.displayName} (${assigningUser.email})` : assigningUser?.email"
      @close="isAssignModalOpen = false; assigningUser = null"
      @save="handleAssignSubscription"
    />
  </div>
</template>

<style scoped>
.mono {
  font-family: var(--font-mono, monospace);
  direction: ltr;
}
</style>
