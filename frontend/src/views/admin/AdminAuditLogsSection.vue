<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import {
  Eye,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Clock,
  Globe,
  Shield,
  Layers,
  Search,
  Info,
  Database,
  Server,
  User,
  UserCheck,
  Hash,
  FilterX,
  Calendar,
  Terminal,
} from '@lucide/vue'
import AdminTable, { type TableColumn } from '../../components/admin/AdminTable.vue'
import AdminTableSkeleton from '../../components/admin/AdminTableSkeleton.vue'
import AdminModal from '../../components/admin/AdminModal.vue'
import BaseButton from '../../components/ui/BaseButton.vue'
import PersianDatePicker from '../../components/ui/PersianDatePicker.vue'
import LiveTerminalLogs from '../../components/admin/LiveTerminalLogs.vue'
import { auditService, type AuditStats } from '../../services/audit.service'
import { useUiStore } from '../../stores/ui'
import type { AuditLogItem } from '../../types'

const props = defineProps<{
  searchQuery?: string
}>()

const uiStore = useUiStore()

const logs = ref<AuditLogItem[]>([])
const stats = ref<AuditStats>({
  totalLogs: 0,
  errorCount: 0,
  fetchCount: 0,
  avgDurationMs: 0,
})
const isLoading = ref(false)

// Pagination State (Server-Side)
const page = ref(1)
const pageSize = ref(20)
const totalItems = ref(0)

const isDetailModalOpen = ref(false)
const selectedLog = ref<AuditLogItem | null>(null)

// Filters
const typeFilter = ref<'all' | 'http_request' | 'external_fetch' | 'security' | 'system_logs'>('all')
const statusFilter = ref<'all' | 'success' | 'error'>('all')
const idFilter = ref('')
const actorFilter = ref('')
const traceFilter = ref('')
const startDate = ref('')
const endDate = ref('')
const copiedText = ref<string | null>(null)

// SigNoz URL configuration (can come from env or default)
const signozBaseUrl = ref(
  (import.meta.env.VITE_SIGNOZ_URL as string) || 'http://localhost:3301',
)

const columns: TableColumn[] = [
  { key: 'status', label: 'وضعیت / متد', width: '130px', align: 'center', sortable: false },
  { key: 'action', label: 'عملیات و مسیر', width: '270px', sortable: false },
  { key: 'traceId', label: 'شناسه تریس (SigNoz)', width: '180px', align: 'center', sortable: false },
  { key: 'actor', label: 'عامل انجام‌دهنده', width: '220px', align: 'right', sortable: false },
  { key: 'duration', label: 'مدت (ms)', width: '95px', align: 'center', sortable: false },
  { key: 'createdAt', label: 'زمان وقوع', width: '150px', align: 'center', sortable: false },
  { key: 'details', label: 'جزئیات', width: '65px', align: 'center', sortable: false },
]

const hasActiveFilters = computed(() => {
  return Boolean(
    idFilter.value.trim() ||
      actorFilter.value.trim() ||
      traceFilter.value.trim() ||
      startDate.value.trim() ||
      endDate.value.trim() ||
      typeFilter.value !== 'all' ||
      statusFilter.value !== 'all' ||
      props.searchQuery?.trim(),
  )
})

async function loadAuditLogs() {
  isLoading.value = true
  try {
    const res = await auditService.getAuditLogs({
      page: page.value,
      limit: pageSize.value,
      search: props.searchQuery?.trim() || undefined,
      id: idFilter.value.trim() || undefined,
      actorEmail: actorFilter.value.trim() || undefined,
      traceId: traceFilter.value.trim() || undefined,
      type: typeFilter.value,
      status: statusFilter.value,
      startDate: startDate.value.trim() || undefined,
      endDate: endDate.value.trim() || undefined,
    })
    logs.value = res.items || []
    totalItems.value = res.total || 0
    if (res.stats) {
      stats.value = res.stats
    }
  } catch (err: any) {
    uiStore.showToast(err.message || 'خطا در بارگذاری لاگ‌ها', 'error')
  } finally {
    isLoading.value = false
  }
}

function handlePageChange(newPage: number) {
  page.value = newPage
  loadAuditLogs()
}

function handlePageSizeChange(newSize: number) {
  pageSize.value = newSize
  page.value = 1
  loadAuditLogs()
}

function applyFilters() {
  page.value = 1
  loadAuditLogs()
}

function clearAllFilters() {
  idFilter.value = ''
  actorFilter.value = ''
  traceFilter.value = ''
  startDate.value = ''
  endDate.value = ''
  typeFilter.value = 'all'
  statusFilter.value = 'all'
  page.value = 1
  loadAuditLogs()
}

function filterByActorEmail(email?: string | null) {
  if (!email) return
  actorFilter.value = email
  page.value = 1
  loadAuditLogs()
  if (isDetailModalOpen.value) {
    isDetailModalOpen.value = false
  }
}

function filterByActorId(actorId?: string | null) {
  if (!actorId) return
  idFilter.value = actorId
  page.value = 1
  loadAuditLogs()
  if (isDetailModalOpen.value) {
    isDetailModalOpen.value = false
  }
}

watch(
  () => [props.searchQuery, typeFilter.value, statusFilter.value, startDate.value, endDate.value],
  () => {
    if (typeFilter.value !== 'system_logs') {
      page.value = 1
      loadAuditLogs()
    }
  },
)

onMounted(() => {
  if (typeFilter.value !== 'system_logs') {
    loadAuditLogs()
  }
})

function openDetails(log: AuditLogItem) {
  selectedLog.value = log
  isDetailModalOpen.value = true
}

function getSignozTraceUrl(traceId?: string | null, spanId?: string | null): string {
  if (!traceId) return '#'
  const base = signozBaseUrl.value.replace(/\/$/, '')
  const encodedTrace = encodeURIComponent(traceId)
  if (spanId) {
    return `${base}/trace/${encodedTrace}?spanId=${encodeURIComponent(spanId)}`
  }
  return `${base}/trace/${encodedTrace}`
}

async function copyToClipboard(text?: string | null, label = 'شناسه') {
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
    copiedText.value = text
    uiStore.showToast(`${label} با موفقیت کپی شد`, 'success')
    setTimeout(() => {
      if (copiedText.value === text) {
        copiedText.value = null
      }
    }, 2500)
  } catch {
    uiStore.showToast('خطا در کپی کردن شناسه', 'error')
  }
}

function getStatusBadge(log: AuditLogItem): { text: string; bg: string; textCol: string } {
  if (log.statusCode) {
    if (log.statusCode >= 200 && log.statusCode < 300) {
      return { text: `${log.statusCode} OK`, bg: 'bg-emerald-500/10 border-emerald-500/30', textCol: 'text-emerald-500' }
    }
    if (log.statusCode >= 300 && log.statusCode < 400) {
      return { text: `${log.statusCode}`, bg: 'bg-blue-500/10 border-blue-500/30', textCol: 'text-blue-500' }
    }
    if (log.statusCode >= 400 && log.statusCode < 500) {
      return { text: `${log.statusCode} WARN`, bg: 'bg-amber-500/10 border-amber-500/30', textCol: 'text-amber-500' }
    }
    return { text: `${log.statusCode} ERR`, bg: 'bg-rose-500/10 border-rose-500/30', textCol: 'text-rose-500' }
  }

  if (log.errorMessage || log.action.includes('failed') || log.action.includes('FAILED')) {
    return { text: 'ERROR', bg: 'bg-rose-500/10 border-rose-500/30', textCol: 'text-rose-500' }
  }

  return { text: 'INFO', bg: 'bg-muted border-border', textCol: 'text-muted-foreground' }
}

function getMethodBadge(method?: string | null): { text: string; color: string } {
  const m = (method || 'GET').toUpperCase()
  if (m === 'GET') return { text: 'GET', color: 'text-blue-500 bg-blue-500/10 border-blue-500/20' }
  if (m === 'POST') return { text: 'POST', color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' }
  if (m === 'PUT' || m === 'PATCH') return { text: m, color: 'text-amber-500 bg-amber-500/10 border-amber-500/20' }
  if (m === 'DELETE') return { text: 'DEL', color: 'text-rose-500 bg-rose-500/10 border-rose-500/20' }
  return { text: m, color: 'text-muted-foreground bg-accent border-border' }
}

function getActorInitial(log: AuditLogItem): string {
  if (log.actorName) return log.actorName.charAt(0).toUpperCase()
  if (log.actorEmail) return log.actorEmail.charAt(0).toUpperCase()
  if (log.actorType === 'admin') return 'A'
  if (log.actorType === 'system') return 'S'
  return 'U'
}

function formatDate(iso?: string): string {
  if (!iso) return '-'
  try {
    return new Date(iso).toLocaleString('fa-IR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  } catch {
    return iso
  }
}
</script>

<template>
  <div class="space-y-6" dir="rtl">
    <!-- Header & Storage Architecture Info -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-border/60">
      <div>
        <div class="flex items-center gap-2 flex-wrap">
          <h2 class="text-base font-bold flex items-center gap-2">
            <Activity :size="18" class="text-primary" />
            لاگ‌های سیستم، ردیابی فراخوانی‌ها و ممیزی
          </h2>
          <!-- Compact Architecture Badges -->
          <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20" title="لاگ‌ها ساخت‌یافته در دیتابیس رابطه‌ای ذخیره می‌شوند">
            <Database :size="11" />
            <span>PostgreSQL</span>
          </span>
          <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20" title="تریس‌ها به موتور کلیک‌هاوس سیگنوز برای آنالیز کارایی متصل هستند">
            <Server :size="11" />
            <span>ClickHouse / SigNoz</span>
          </span>
        </div>
        <p class="text-[11.5px] text-muted-foreground mt-0.5">
          لاگ‌های تغییرناپذیر ممیزی در دیتابیس همراه با اتصال مستقیم تریس به موتور کلیک‌هاوس سیگنوز برای آنالیز بار و تله‌متری.
        </p>
      </div>

      <div class="flex items-center gap-2 shrink-0 flex-wrap">
        <!-- Dedicated Live Logs in SigNoz Button -->
        <a
          :href="`${signozBaseUrl}/logs?liveTail=true`"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-xs font-bold hover:bg-emerald-500/25 transition-all shadow-xs"
          title="مشاهده زنده تمام لاگ‌های سیستم، خطاها و ریکوئست‌ها در SigNoz (بدون اشغال دیتابیس PostgreSQL)"
        >
          <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <Activity :size="13" />
          <span>لاگ‌های زنده در SigNoz</span>
          <ArrowUpRight :size="12" />
        </a>

        <a
          :href="signozBaseUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-primary/30 bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors"
          title="باز کردن داشبورد تحلیلی SigNoz / ClickHouse"
        >
          <Layers :size="13" />
          <span>داشبورد SigNoz</span>
          <ArrowUpRight :size="12" />
        </a>

        <BaseButton
          variant="secondary"
          size="sm"
          :disabled="isLoading"
          class="flex items-center gap-1 text-xs"
          @click="loadAuditLogs"
        >
          <RefreshCw :size="13" :class="{ 'animate-spin': isLoading }" />
          <span>بروزرسانی</span>
        </BaseButton>
      </div>
    </div>

    <!-- Minimal Quick Stats Strip -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-2.5">
      <div class="px-3.5 py-2 rounded-xl border border-border bg-card flex items-center justify-between shadow-xs">
        <div>
          <span class="text-[11px] text-muted-foreground block font-medium">کل لاگ‌های ثبت‌شده</span>
          <span class="text-lg font-bold font-mono text-foreground">{{ stats.totalLogs.toLocaleString('fa-IR') }}</span>
        </div>
        <div class="p-1.5 rounded-lg bg-primary/10 text-primary">
          <Activity :size="16" />
        </div>
      </div>

      <div class="px-3.5 py-2 rounded-xl border border-border bg-card flex items-center justify-between shadow-xs">
        <div>
          <span class="text-[11px] text-muted-foreground block font-medium">خطاها و شکست‌ها</span>
          <span class="text-lg font-bold font-mono text-rose-500">{{ stats.errorCount.toLocaleString('fa-IR') }}</span>
        </div>
        <div class="p-1.5 rounded-lg bg-rose-500/10 text-rose-500">
          <AlertTriangle :size="16" />
        </div>
      </div>

      <div class="px-3.5 py-2 rounded-xl border border-border bg-card flex items-center justify-between shadow-xs">
        <div>
          <span class="text-[11px] text-muted-foreground block font-medium">فراخوانی خروجی (Fetch)</span>
          <span class="text-lg font-bold font-mono text-blue-500">{{ stats.fetchCount.toLocaleString('fa-IR') }}</span>
        </div>
        <div class="p-1.5 rounded-lg bg-blue-500/10 text-blue-500">
          <Globe :size="16" />
        </div>
      </div>

      <div class="px-3.5 py-2 rounded-xl border border-border bg-card flex items-center justify-between shadow-xs">
        <div>
          <span class="text-[11px] text-muted-foreground block font-medium">میانگین زمان پاسخ</span>
          <span class="text-lg font-bold font-mono text-amber-500">{{ stats.avgDurationMs }} ms</span>
        </div>
        <div class="p-1.5 rounded-lg bg-amber-500/10 text-amber-500">
          <Clock :size="16" />
        </div>
      </div>
    </div>

    <!-- Minimal Filter & Date Range Toolbar -->
    <div class="p-3 rounded-xl border border-border bg-card space-y-2.5 text-xs shadow-xs">
      <!-- Top Row: Type Tabs ("همه لاگ‌ها" + sub-categories) & Status Filter -->
      <div class="flex flex-wrap items-center justify-between gap-2.5">
        <!-- Type Filter Segmented Tabs -->
        <div class="flex items-center gap-1 bg-accent/40 p-0.5 rounded-lg border border-border/60">
          <button
            type="button"
            class="px-2.5 py-1 rounded-md transition-colors text-xs"
            :class="typeFilter === 'all' ? 'bg-primary text-primary-foreground font-semibold shadow-xs' : 'text-muted-foreground hover:text-foreground'"
            @click="typeFilter = 'all'"
          >
            همه لاگ‌ها
          </button>
          <button
            type="button"
            class="px-2.5 py-1 rounded-md transition-colors text-xs"
            :class="typeFilter === 'http_request' ? 'bg-primary text-primary-foreground font-semibold shadow-xs' : 'text-muted-foreground hover:text-foreground'"
            @click="typeFilter = 'http_request'"
          >
            درخواست‌های ورودی
          </button>
          <button
            type="button"
            class="px-2.5 py-1 rounded-md transition-colors text-xs"
            :class="typeFilter === 'external_fetch' ? 'bg-primary text-primary-foreground font-semibold shadow-xs' : 'text-muted-foreground hover:text-foreground'"
            @click="typeFilter = 'external_fetch'"
          >
            فراخوانی‌های خارجی (Fetch)
          </button>
          <button
            type="button"
            class="px-2.5 py-1 rounded-md transition-colors text-xs"
            :class="typeFilter === 'security' ? 'bg-primary text-primary-foreground font-semibold shadow-xs' : 'text-muted-foreground hover:text-foreground'"
            @click="typeFilter = 'security'"
          >
            رویدادهای امنیتی
          </button>
          <button
            type="button"
            class="px-2.5 py-1 rounded-md transition-colors text-xs flex items-center gap-1.5"
            :class="typeFilter === 'system_logs' ? 'bg-primary text-primary-foreground font-semibold shadow-xs' : 'text-muted-foreground hover:text-foreground'"
            @click="typeFilter = 'system_logs'"
          >
            <Terminal :size="12" />
            <span>لاگ‌های زنده فایل سرور</span>
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
          </button>
        </div>

        <!-- Status Filter & Clear Filters Button -->
        <div class="flex items-center gap-2 flex-wrap">
          <select
            v-model="statusFilter"
            class="px-2.5 py-1 rounded-lg border border-border bg-background text-foreground text-xs outline-none focus:border-primary"
          >
            <option value="all">همه وضعیت‌ها</option>
            <option value="success">فقط موفق (2xx / OK)</option>
            <option value="error">فقط خطاها (4xx / 5xx / Failed)</option>
          </select>

          <button
            v-if="hasActiveFilters"
            type="button"
            class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-xs hover:bg-destructive/20 transition-colors"
            title="حذف تمام فیلترها و نمایش همه"
            @click="clearAllFilters"
          >
            <FilterX :size="13" />
            <span>حذف فیلترها</span>
          </button>
        </div>
      </div>

      <!-- Bottom Row: Jalali Date Range & ID/Actor Search Inputs -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 pt-2 border-t border-border/50">
        <!-- 1. Start Date (Persian DatePicker) -->
        <div class="relative flex flex-col gap-1">
          <span class="text-[10.5px] text-muted-foreground font-medium flex items-center gap-1">
            <Calendar :size="11" class="text-primary" />
            <span>از تاریخ:</span>
          </span>
          <PersianDatePicker
            v-model="startDate"
            placeholder="انتخاب تاریخ شروع..."
          />
        </div>

        <!-- 2. End Date (Persian DatePicker) -->
        <div class="relative flex flex-col gap-1">
          <span class="text-[10.5px] text-muted-foreground font-medium flex items-center gap-1">
            <Calendar :size="11" class="text-primary" />
            <span>تا تاریخ:</span>
          </span>
          <PersianDatePicker
            v-model="endDate"
            placeholder="انتخاب تاریخ پایان..."
          />
        </div>

        <!-- 3. Direct ID Search (Log ID, User ID, Entity ID) -->
        <div class="relative flex flex-col gap-1">
          <span class="text-[10.5px] text-muted-foreground font-medium flex items-center gap-1">
            <Hash :size="11" class="text-primary" />
            <span>شناسه رخداد / کاربر:</span>
          </span>
          <div class="relative flex items-center">
            <input
              v-model="idFilter"
              type="text"
              placeholder="Log ID / User ID..."
              class="w-full pl-6 pr-2.5 py-1.5 rounded-xl border border-border bg-background text-foreground text-xs font-mono outline-none focus:border-primary placeholder:font-sans"
              @keyup.enter="applyFilters"
            />
            <button
              v-if="idFilter"
              type="button"
              class="absolute left-2 text-muted-foreground hover:text-foreground text-xs"
              @click="idFilter = ''; applyFilters()"
            >
              ✕
            </button>
          </div>
        </div>

        <!-- 4. Actor / User Email Filter -->
        <div class="relative flex flex-col gap-1">
          <span class="text-[10.5px] text-muted-foreground font-medium flex items-center gap-1">
            <User :size="11" class="text-primary" />
            <span>ایمیل یا عامل:</span>
          </span>
          <div class="relative flex items-center">
            <input
              v-model="actorFilter"
              type="text"
              placeholder="جستجوی ایمیل عامل..."
              class="w-full pl-6 pr-2.5 py-1.5 rounded-xl border border-border bg-background text-foreground text-xs outline-none focus:border-primary"
              @keyup.enter="applyFilters"
            />
            <button
              v-if="actorFilter"
              type="button"
              class="absolute left-2 text-muted-foreground hover:text-foreground text-xs"
              @click="actorFilter = ''; applyFilters()"
            >
              ✕
            </button>
          </div>
        </div>

        <!-- 5. Trace ID Filter -->
        <div class="relative flex flex-col gap-1">
          <span class="text-[10.5px] text-muted-foreground font-medium flex items-center gap-1">
            <Search :size="11" class="text-primary" />
            <span>شناسه تریس SigNoz:</span>
          </span>
          <div class="relative flex items-center">
            <input
              v-model="traceFilter"
              type="text"
              placeholder="Trace ID..."
              class="w-full pl-6 pr-2.5 py-1.5 rounded-xl border border-border bg-background text-foreground text-xs font-mono outline-none focus:border-primary placeholder:font-sans"
              @keyup.enter="applyFilters"
            />
            <button
              v-if="traceFilter"
              type="button"
              class="absolute left-2 text-muted-foreground hover:text-foreground text-xs"
              @click="traceFilter = ''; applyFilters()"
            >
              ✕
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- High-Volume Architecture Strategy Hint -->
    <div class="flex items-center justify-between gap-3 px-3.5 py-2 rounded-xl bg-accent/30 border border-border/80 text-xs text-muted-foreground">
      <div class="flex items-center gap-2">
        <Server :size="14" class="text-primary shrink-0" />
        <span>
          <strong>جداسازی هوشمند بار لاگ‌ها:</strong> کلیه درخواست‌های روزمره کاربران با حجم بالا در <strong>SigNoz (ClickHouse با TTL انقضا)</strong> ایندکس می‌شوند و فقط رخدادهای کلیدی ممیزی در <strong>PostgreSQL</strong> می‌نشینند تا حجم دیتابیس متورم نشود.
        </span>
      </div>
      <a
        :href="signozBaseUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex items-center gap-1 text-[11px] text-primary font-medium hover:underline shrink-0"
      >
        <span>تحلیل تریس‌ها</span>
        <ArrowUpRight :size="12" />
      </a>
    </div>

    <!-- Table with Server-Side Pagination -->
    <div v-if="typeFilter !== 'system_logs'" class="border border-border rounded-xl bg-card overflow-hidden shadow-xs">
      <AdminTableSkeleton v-if="isLoading" :columns="columns.length" :rows="pageSize || 10" />
      <AdminTable
        v-else
        :columns="columns"
        :items="logs"
        serverSide
        paginated
        :currentPage="page"
        :pageSize="pageSize"
        :totalItems="totalItems"
        :pageSizes="[10, 20, 50, 100]"
        empty-text="هیچ لاگی با معیارهای انتخابی یافت نشد."
        @update:page="handlePageChange"
        @update:pageSize="handlePageSizeChange"
      >
        <template #row="{ item: log }">
          <!-- Status / Method -->
          <td data-label="وضعیت / متد" class="text-center">
            <div class="flex items-center justify-center gap-1.5">
              <span
                v-if="log.method"
                class="px-1.5 py-0.5 text-[10px] font-mono font-bold rounded border"
                :class="getMethodBadge(log.method).color"
              >
                {{ getMethodBadge(log.method).text }}
              </span>
              <span
                class="px-2 py-0.5 text-[10.5px] font-mono font-semibold rounded-md border"
                :class="[getStatusBadge(log).bg, getStatusBadge(log).textCol]"
              >
                {{ getStatusBadge(log).text }}
              </span>
            </div>
          </td>

          <!-- Action & Path -->
          <td data-label="عملیات و مسیر">
            <div class="flex flex-col text-right">
              <span class="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Globe v-if="log.entityType === 'external_fetch'" :size="13" class="text-blue-500 shrink-0" />
                <Shield v-else-if="log.entityType !== 'http_request'" :size="13" class="text-amber-500 shrink-0" />
                <span class="truncate" :title="log.action">{{ log.action }}</span>
              </span>
              <span v-if="log.path" class="text-[11px] text-muted-foreground font-mono truncate" dir="ltr" :title="log.path">
                {{ log.path }}
              </span>
              <span v-if="log.id" class="text-[10px] text-muted-foreground/70 font-mono mt-0.5 flex items-center gap-1" dir="ltr">
                <span>id: {{ log.id.slice(0, 8) }}...</span>
              </span>
            </div>
          </td>

          <!-- Trace ID (Clickable SigNoz Link & Copy) -->
          <td data-label="شناسه تریس" class="text-center">
            <div v-if="log.traceId" class="inline-flex items-center gap-1 bg-accent/50 px-2 py-1 rounded-lg border border-border/80">
              <a
                :href="getSignozTraceUrl(log.traceId, log.spanId)"
                target="_blank"
                rel="noopener noreferrer"
                class="font-mono text-[11px] text-primary hover:underline inline-flex items-center gap-1"
                title="مشاهده مستقیم ردپا در SigNoz"
              >
                <span dir="ltr">{{ log.traceId.slice(0, 8) }}...{{ log.traceId.slice(-4) }}</span>
                <ExternalLink :size="11" class="text-primary/70" />
              </a>
              <button
                type="button"
                class="p-0.5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                title="کپی شناسه Trace ID"
                @click.stop="copyToClipboard(log.traceId, 'شناسه Trace ID')"
              >
                <Check v-if="copiedText === log.traceId" :size="12" class="text-emerald-500" />
                <Copy v-else :size="12" />
              </button>
            </div>
            <span v-else class="text-muted-foreground text-xs">-</span>
          </td>

          <!-- Actor (Rich Profile Column) -->
          <td data-label="عامل انجام‌دهنده" class="text-right">
            <div class="flex items-center gap-2.5">
              <!-- Initials Avatar -->
              <div
                class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 border"
                :class="{
                  'bg-primary/10 text-primary border-primary/20': log.actorType === 'admin',
                  'bg-blue-500/10 text-blue-500 border-blue-500/20': log.actorType === 'user',
                  'bg-muted text-muted-foreground border-border': log.actorType === 'system',
                }"
              >
                {{ getActorInitial(log) }}
              </div>

              <!-- Name & Email / Role -->
              <div class="flex flex-col overflow-hidden text-right">
                <div class="flex items-center gap-1.5">
                  <span class="text-xs font-semibold text-foreground truncate max-w-[120px]" :title="log.actorName || log.actorEmail || (log.actorType === 'admin' ? 'مدیر سیستم' : log.actorType === 'system' ? 'سیستم خودکار' : 'کاربر سامانه')">
                    {{ log.actorName || log.actorEmail || (log.actorType === 'admin' ? 'مدیر سیستم' : log.actorType === 'system' ? 'سیستم خودکار' : 'کاربر سامانه') }}
                  </span>
                  <span
                    class="text-[9.5px] px-1 py-0.2 rounded font-medium shrink-0"
                    :class="{
                      'bg-purple-500/10 text-purple-600 dark:text-purple-400': log.actorType === 'admin',
                      'bg-blue-500/10 text-blue-600 dark:text-blue-400': log.actorType === 'user',
                      'bg-muted text-muted-foreground': log.actorType === 'system',
                    }"
                  >
                    {{ log.actorType === 'admin' ? 'مدیر' : log.actorType === 'system' ? 'سیستم' : 'کاربر' }}
                  </span>
                </div>

                <div class="flex items-center gap-1 text-[10.5px] text-muted-foreground">
                  <span v-if="log.actorEmail" class="truncate font-mono max-w-[130px]" dir="ltr" :title="log.actorEmail">
                    {{ log.actorEmail }}
                  </span>
                  <span v-else-if="log.actorId" class="font-mono text-[10px]" dir="ltr" :title="log.actorId">
                    {{ log.actorId.slice(0, 8) }}...
                  </span>
                  <span v-else>{{ log.actorType === 'system' ? 'سرویس سیستم' : 'کاربر سامانه' }}</span>

                  <!-- Quick Filter Button by Actor -->
                  <button
                    v-if="log.actorEmail || log.actorId"
                    type="button"
                    class="opacity-60 hover:opacity-100 text-primary transition-opacity"
                    title="فیلتر لاگ‌های این کاربر"
                    @click.stop="log.actorEmail ? filterByActorEmail(log.actorEmail) : filterByActorId(log.actorId)"
                  >
                    <Search :size="10" />
                  </button>
                </div>
              </div>
            </div>
          </td>

          <!-- Duration -->
          <td data-label="مدت" class="text-center">
            <span v-if="log.durationMs !== null && log.durationMs !== undefined" class="font-mono text-xs" :class="log.durationMs > 1500 ? 'text-amber-500 font-bold' : 'text-muted-foreground'">
              {{ log.durationMs }} ms
            </span>
            <span v-else class="text-muted-foreground text-xs">-</span>
          </td>

          <!-- Time -->
          <td data-label="زمان وقوع" class="text-center">
            <span class="text-xs text-muted-foreground">{{ formatDate(log.createdAt) }}</span>
          </td>

          <!-- Details -->
          <td data-label="جزئیات" class="text-center">
            <button
              class="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              title="مشاهده جزئیات کامل لاگ"
              @click="openDetails(log)"
            >
              <Eye :size="15" />
            </button>
          </td>
        </template>
      </AdminTable>
    </div>

    <!-- Live System Logs Terminal Viewer (When typeFilter === 'system_logs') -->
    <LiveTerminalLogs v-else :signozUrl="signozBaseUrl" />

    <!-- Detail Modal -->
    <AdminModal
      v-if="isDetailModalOpen"
      eyebrow="ردیابی و ممیزی سیستم (Audit & Traces)"
      title="جزئیات درخواست و رخداد"
      @close="isDetailModalOpen = false"
    >
      <div v-if="selectedLog" class="space-y-4 text-xs" dir="rtl">
        <!-- Top Banner with SigNoz Deep Link -->
        <div class="p-3 bg-accent/40 rounded-xl border border-border flex items-center justify-between gap-3">
          <div class="flex items-center gap-2">
            <span
              v-if="selectedLog.method"
              class="px-2 py-0.5 text-xs font-mono font-bold rounded border"
              :class="getMethodBadge(selectedLog.method).color"
            >
              {{ getMethodBadge(selectedLog.method).text }}
            </span>
            <span
              class="px-2 py-0.5 text-xs font-mono font-semibold rounded border"
              :class="[getStatusBadge(selectedLog).bg, getStatusBadge(selectedLog).textCol]"
            >
              {{ getStatusBadge(selectedLog).text }}
            </span>
            <span class="font-mono font-semibold text-xs truncate max-w-xs" dir="ltr">{{ selectedLog.action }}</span>
          </div>

          <a
            v-if="selectedLog.traceId"
            :href="getSignozTraceUrl(selectedLog.traceId, selectedLog.spanId)"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-semibold text-xs hover:opacity-90 transition-opacity shrink-0"
          >
            <span>مشاهده ردپا در SigNoz</span>
            <ExternalLink :size="13" />
          </a>
        </div>

        <!-- Ingestion delay hint & Storage info -->
        <div class="flex items-center justify-between gap-2 p-2 rounded-lg bg-muted/40 border border-border/60 text-[11px] text-muted-foreground">
          <div class="flex items-center gap-1.5">
            <Database :size="13" class="text-primary shrink-0" />
            <span>ذخیره‌شده در: <strong>PostgreSQL</strong> (جدول audit_logs) + <strong>ClickHouse</strong> (ردیابی APM)</span>
          </div>
          <div class="flex items-center gap-1 text-[10.5px]">
            <Info :size="12" class="text-muted-foreground" />
            <span>تاخیر تله‌متری سیگنوز: ۱ تا ۲ ثانیه</span>
          </div>
        </div>

        <!-- Error Alert if present -->
        <div v-if="selectedLog.errorMessage" class="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 flex items-start gap-2">
          <AlertTriangle :size="16" class="shrink-0 mt-0.5" />
          <div>
            <span class="font-bold block">پیام خطا:</span>
            <span class="font-mono text-[11px] block mt-0.5" dir="ltr">{{ selectedLog.errorMessage }}</span>
          </div>
        </div>

        <!-- Actor Details Card (Who performed this action) -->
        <div class="p-3 bg-card rounded-xl border border-border space-y-2">
          <div class="flex items-center justify-between">
            <span class="font-bold text-foreground flex items-center gap-1.5">
              <UserCheck :size="15" class="text-primary" />
              <span>اطلاعات انجام‌دهنده (Actor Identity):</span>
            </span>
            <button
              v-if="selectedLog.actorEmail || selectedLog.actorId"
              type="button"
              class="text-xs text-primary hover:underline inline-flex items-center gap-1"
              @click="selectedLog.actorEmail ? filterByActorEmail(selectedLog.actorEmail) : filterByActorId(selectedLog.actorId)"
            >
              <Search :size="12" />
              <span>مشاهده همه رخدادهای این کاربر</span>
            </button>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs">
            <div>
              <span class="text-muted-foreground block text-[11px]">نام کاربر:</span>
              <span class="font-semibold text-foreground">
                {{ selectedLog.actorName || selectedLog.actorEmail || (selectedLog.actorType === 'admin' ? 'مدیر ارشد سامانه' : selectedLog.actorType === 'system' ? 'سرویس داخلی سامانه' : selectedLog.actorId ? `کاربر (${selectedLog.actorId.slice(0, 8)})` : 'کاربر سامانه') }}
              </span>
            </div>

            <div>
              <span class="text-muted-foreground block text-[11px]">پست الکترونیکی:</span>
              <div class="flex items-center gap-1.5">
                <span class="font-mono" dir="ltr">{{ selectedLog.actorEmail || '-' }}</span>
                <button
                  v-if="selectedLog.actorEmail"
                  type="button"
                  class="text-muted-foreground hover:text-foreground"
                  title="کپی ایمیل"
                  @click="copyToClipboard(selectedLog.actorEmail, 'ایمیل')"
                >
                  <Copy :size="11" />
                </button>
              </div>
            </div>

            <div>
              <span class="text-muted-foreground block text-[11px]">شناسه کاربری (User UUID):</span>
              <div class="flex items-center gap-1.5">
                <span class="font-mono text-[11px]" dir="ltr">{{ selectedLog.actorId || '-' }}</span>
                <button
                  v-if="selectedLog.actorId"
                  type="button"
                  class="text-muted-foreground hover:text-foreground"
                  title="کپی شناسه کاربر"
                  @click="copyToClipboard(selectedLog.actorId, 'شناسه کاربر')"
                >
                  <Copy :size="11" />
                </button>
              </div>
            </div>

            <div>
              <span class="text-muted-foreground block text-[11px]">نقش عامل:</span>
              <span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium"
                :class="{
                  'bg-purple-500/10 text-purple-600 dark:text-purple-400': selectedLog.actorType === 'admin',
                  'bg-blue-500/10 text-blue-600 dark:text-blue-400': selectedLog.actorType === 'user',
                  'bg-muted text-muted-foreground': selectedLog.actorType === 'system',
                }"
              >
                {{ selectedLog.actorType === 'admin' ? 'مدیر سیستم' : selectedLog.actorType === 'system' ? 'سیستمی' : 'کاربر' }}
              </span>
            </div>
          </div>
        </div>

        <!-- Technical & Identification Grid -->
        <div class="grid grid-cols-2 gap-3 p-3 bg-accent/20 rounded-xl border border-border">
          <div>
            <span class="text-muted-foreground">شناسه لاگ (Log UUID):</span>
            <div class="flex items-center gap-1 mt-0.5">
              <span class="font-mono text-[11px] block select-all truncate" dir="ltr">{{ selectedLog.id }}</span>
              <button
                type="button"
                class="text-muted-foreground hover:text-foreground shrink-0"
                title="کپی Log ID"
                @click="copyToClipboard(selectedLog.id, 'شناسه Log ID')"
              >
                <Copy :size="12" />
              </button>
            </div>
          </div>

          <div>
            <span class="text-muted-foreground">شناسه Trace ID:</span>
            <div class="flex items-center gap-1 mt-0.5">
              <span class="font-mono text-[11px] block select-all truncate" dir="ltr">{{ selectedLog.traceId || '-' }}</span>
              <button
                v-if="selectedLog.traceId"
                type="button"
                class="text-muted-foreground hover:text-foreground shrink-0"
                title="کپی Trace ID"
                @click="copyToClipboard(selectedLog.traceId, 'شناسه Trace ID')"
              >
                <Copy :size="12" />
              </button>
            </div>
          </div>

          <div>
            <span class="text-muted-foreground">شناسه Span ID:</span>
            <span class="font-mono block mt-0.5 text-[11px]" dir="ltr">{{ selectedLog.spanId || '-' }}</span>
          </div>

          <div>
            <span class="text-muted-foreground">مدت زمان اجرا:</span>
            <span class="font-mono block mt-0.5">
              {{ selectedLog.durationMs !== null ? `${selectedLog.durationMs} میلی‌ثانیه` : '-' }}
            </span>
          </div>

          <div class="col-span-2">
            <span class="text-muted-foreground">مسیر کامل (Path / URL):</span>
            <span class="font-mono block mt-0.5 break-all select-all text-[11px]" dir="ltr">{{ selectedLog.path || '-' }}</span>
          </div>

          <div>
            <span class="text-muted-foreground">آدرس IP درخواست‌دهنده:</span>
            <span class="font-mono block mt-0.5" dir="ltr">{{ selectedLog.ip || '-' }}</span>
          </div>

          <div>
            <span class="text-muted-foreground">زمان وقوع:</span>
            <span class="block mt-0.5">{{ formatDate(selectedLog.createdAt) }}</span>
          </div>

          <div v-if="selectedLog.userAgent" class="col-span-2">
            <span class="text-muted-foreground">User Agent:</span>
            <span class="font-mono text-[10px] text-muted-foreground block mt-0.5 break-all" dir="ltr">{{ selectedLog.userAgent }}</span>
          </div>
        </div>

        <!-- Metadata JSON -->
        <div v-if="selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0">
          <span class="font-bold text-muted-foreground mb-1 block">اطلاعات تکمیلی و پارامترها (Metadata):</span>
          <pre class="p-3 bg-card border border-border rounded-xl font-mono text-[11px] overflow-x-auto max-h-48" dir="ltr">{{ JSON.stringify(selectedLog.metadata, null, 2) }}</pre>
        </div>

        <!-- Changes JSON -->
        <div v-if="selectedLog.changes">
          <span class="font-bold text-muted-foreground mb-1 block">تغییرات داده (Changes):</span>
          <pre class="p-3 bg-card border border-border rounded-xl font-mono text-[11px] overflow-x-auto max-h-48" dir="ltr">{{ JSON.stringify(selectedLog.changes, null, 2) }}</pre>
        </div>
      </div>

      <template #footer>
        <div class="flex justify-end w-full">
          <BaseButton variant="secondary" @click="isDetailModalOpen = false">
            بستن
          </BaseButton>
        </div>
      </template>
    </AdminModal>
  </div>
</template>
