<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
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
} from '@lucide/vue'
import AdminTable, { type TableColumn } from '../../components/admin/AdminTable.vue'
import AdminTableSkeleton from '../../components/admin/AdminTableSkeleton.vue'
import AdminModal from '../../components/admin/AdminModal.vue'
import BaseButton from '../../components/ui/BaseButton.vue'
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

const isDetailModalOpen = ref(false)
const selectedLog = ref<AuditLogItem | null>(null)

// Filters
const typeFilter = ref<'all' | 'http_request' | 'external_fetch' | 'security'>('all')
const statusFilter = ref<'all' | 'success' | 'error'>('all')
const traceFilter = ref('')
const copiedTraceId = ref<string | null>(null)

// SigNoz URL configuration (can come from env or default)
const signozBaseUrl = ref(
  (import.meta.env.VITE_SIGNOZ_URL as string) || 'http://localhost:3301',
)

const columns: TableColumn[] = [
  { key: 'status', label: 'وضعیت / متد', width: '130px', align: 'center', sortable: true },
  { key: 'action', label: 'عملیات و مسیر', width: '280px', sortable: true },
  { key: 'traceId', label: 'شناسه تریس (SigNoz)', width: '190px', align: 'center' },
  { key: 'actor', label: 'عامل', width: '120px', align: 'center' },
  { key: 'duration', label: 'مدت (ms)', width: '100px', align: 'center', sortable: true },
  { key: 'createdAt', label: 'زمان وقوع', width: '160px', sortable: true, align: 'center' },
  { key: 'details', label: 'جزئیات', width: '70px', align: 'center', sortable: false },
]

async function loadAuditLogs() {
  isLoading.value = true
  try {
    const res = await auditService.getAuditLogs({
      limit: 100,
      search: props.searchQuery,
      traceId: traceFilter.value.trim() || undefined,
      type: typeFilter.value,
      status: statusFilter.value,
    })
    logs.value = res.items || []
    if (res.stats) {
      stats.value = res.stats
    }
  } catch (err: any) {
    uiStore.showToast(err.message || 'خطا در بارگذاری لاگ‌ها', 'error')
  } finally {
    isLoading.value = false
  }
}

watch(
  () => [props.searchQuery, typeFilter.value, statusFilter.value],
  () => {
    loadAuditLogs()
  },
)

onMounted(loadAuditLogs)

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

async function copyToClipboard(text?: string | null) {
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
    copiedTraceId.value = text
    uiStore.showToast('شناسه Trace ID با موفقیت کپی شد', 'success')
    setTimeout(() => {
      if (copiedTraceId.value === text) {
        copiedTraceId.value = null
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
    <!-- Header & SigNoz Info -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h2 class="text-lg font-bold flex items-center gap-2">
          <Activity :size="20" class="text-primary" />
          لاگ‌های سیستم، ردیابی فراخوانی‌ها و ممیزی (Audit & Traces)
        </h2>
        <p class="text-xs text-muted-foreground mt-0.5">
          ثبت جامع تمامی درخواست‌های ورودی، فراخوانی‌های خروجی هوش مصنوعی و پرداخت با اتصال مستقیم به SigNoz
        </p>
      </div>

      <div class="flex items-center gap-2">
        <a
          :href="signozBaseUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-primary/30 bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors"
          title="باز کردن داشبورد SigNoz"
        >
          <Layers :size="14" />
          <span>داشبورد SigNoz</span>
          <ArrowUpRight :size="13" />
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

    <!-- Quick Stats Cards -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
      <div class="p-3.5 rounded-xl border border-border bg-card flex items-center justify-between">
        <div>
          <span class="text-xs text-muted-foreground block font-medium">کل لاگ‌های ثبت‌شده</span>
          <span class="text-xl font-bold font-mono">{{ stats.totalLogs.toLocaleString('fa-IR') }}</span>
        </div>
        <div class="p-2 rounded-lg bg-primary/10 text-primary">
          <Activity :size="18" />
        </div>
      </div>

      <div class="p-3.5 rounded-xl border border-border bg-card flex items-center justify-between">
        <div>
          <span class="text-xs text-muted-foreground block font-medium">خطاها و شکست‌ها</span>
          <span class="text-xl font-bold font-mono text-rose-500">{{ stats.errorCount.toLocaleString('fa-IR') }}</span>
        </div>
        <div class="p-2 rounded-lg bg-rose-500/10 text-rose-500">
          <AlertTriangle :size="18" />
        </div>
      </div>

      <div class="p-3.5 rounded-xl border border-border bg-card flex items-center justify-between">
        <div>
          <span class="text-xs text-muted-foreground block font-medium">فراخوانی خروجی (Fetch)</span>
          <span class="text-xl font-bold font-mono text-blue-500">{{ stats.fetchCount.toLocaleString('fa-IR') }}</span>
        </div>
        <div class="p-2 rounded-lg bg-blue-500/10 text-blue-500">
          <Globe :size="18" />
        </div>
      </div>

      <div class="p-3.5 rounded-xl border border-border bg-card flex items-center justify-between">
        <div>
          <span class="text-xs text-muted-foreground block font-medium">میانگین زمان پاسخ</span>
          <span class="text-xl font-bold font-mono text-amber-500">{{ stats.avgDurationMs }} ms</span>
        </div>
        <div class="p-2 rounded-lg bg-amber-500/10 text-amber-500">
          <Clock :size="18" />
        </div>
      </div>
    </div>

    <!-- Filter Toolbar -->
    <div class="p-3 rounded-xl border border-border bg-card flex flex-wrap items-center justify-between gap-3 text-xs">
      <!-- Type Filter Tabs -->
      <div class="flex items-center gap-1 bg-accent/40 p-1 rounded-lg border border-border/60">
        <button
          type="button"
          class="px-2.5 py-1 rounded-md transition-colors"
          :class="typeFilter === 'all' ? 'bg-primary text-primary-foreground font-semibold shadow-xs' : 'text-muted-foreground hover:text-foreground'"
          @click="typeFilter = 'all'"
        >
          همه
        </button>
        <button
          type="button"
          class="px-2.5 py-1 rounded-md transition-colors"
          :class="typeFilter === 'http_request' ? 'bg-primary text-primary-foreground font-semibold shadow-xs' : 'text-muted-foreground hover:text-foreground'"
          @click="typeFilter = 'http_request'"
        >
          درخواست‌های ورودی
        </button>
        <button
          type="button"
          class="px-2.5 py-1 rounded-md transition-colors"
          :class="typeFilter === 'external_fetch' ? 'bg-primary text-primary-foreground font-semibold shadow-xs' : 'text-muted-foreground hover:text-foreground'"
          @click="typeFilter = 'external_fetch'"
        >
          فراخوانی‌های خارجی (Fetch)
        </button>
        <button
          type="button"
          class="px-2.5 py-1 rounded-md transition-colors"
          :class="typeFilter === 'security' ? 'bg-primary text-primary-foreground font-semibold shadow-xs' : 'text-muted-foreground hover:text-foreground'"
          @click="typeFilter = 'security'"
        >
          رویدادهای امنیتی
        </button>
      </div>

      <!-- Status Filter & Trace Search -->
      <div class="flex items-center gap-2 flex-wrap">
        <select
          v-model="statusFilter"
          class="px-2.5 py-1 rounded-lg border border-border bg-background text-foreground text-xs outline-none focus:border-primary"
        >
          <option value="all">همه وضعیت‌ها</option>
          <option value="success">فقط موفق (2xx / OK)</option>
          <option value="error">فقط خطاها (4xx / 5xx / Failed)</option>
        </select>

        <div class="relative flex items-center">
          <Search :size="13" class="absolute right-2.5 text-muted-foreground pointer-events-none" />
          <input
            v-model="traceFilter"
            type="text"
            placeholder="فیلتر با شناسه Trace ID..."
            class="pr-7 pl-2.5 py-1 rounded-lg border border-border bg-background text-foreground text-xs font-mono outline-none focus:border-primary w-44"
            @keyup.enter="loadAuditLogs"
          />
        </div>
      </div>
    </div>

    <!-- Table -->
    <div class="border border-border rounded-xl bg-card overflow-hidden">
      <AdminTableSkeleton v-if="isLoading" :columns="columns.length" :rows="6" />
      <AdminTable
        v-else
        :columns="columns"
        :items="logs"
        empty-text="هیچ لاگی با شرایط انتخابی یافت نشد."
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
                <span class="truncate">{{ log.action }}</span>
              </span>
              <span v-if="log.path" class="text-[11px] text-muted-foreground font-mono truncate" dir="ltr">
                {{ log.path }}
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
                @click.stop="copyToClipboard(log.traceId)"
              >
                <Check v-if="copiedTraceId === log.traceId" :size="12" class="text-emerald-500" />
                <Copy v-else :size="12" />
              </button>
            </div>
            <span v-else class="text-muted-foreground text-xs">-</span>
          </td>

          <!-- Actor -->
          <td data-label="عامل" class="text-center">
            <div class="flex flex-col items-center">
              <span class="text-xs font-semibold">
                {{ log.actorType === 'admin' ? 'مدیر سیستم' : log.actorType === 'system' ? 'سیستمی' : 'کاربر' }}
              </span>
              <span v-if="log.actorId" class="text-[10px] text-muted-foreground font-mono" dir="ltr">
                {{ log.actorId.slice(0, 8) }}...
              </span>
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

    <!-- Detail Modal -->
    <AdminModal
      v-if="isDetailModalOpen"
      eyebrow="ردیابی و ممیزی سیستم"
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
            <span class="font-mono font-semibold text-xs" dir="ltr">{{ selectedLog.action }}</span>
          </div>

          <a
            v-if="selectedLog.traceId"
            :href="getSignozTraceUrl(selectedLog.traceId, selectedLog.spanId)"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-semibold text-xs hover:opacity-90 transition-opacity"
          >
            <span>مشاهده ردپا در SigNoz</span>
            <ExternalLink :size="13" />
          </a>
        </div>

        <!-- Ingestion delay hint -->
        <div class="flex items-center gap-1.5 text-[11px] text-muted-foreground px-1">
          <Info :size="13" class="text-primary/70 shrink-0" />
          <span>توجه: در صورتی که این رخداد در چند ثانیه اخیر انجام شده است، پردازش اولیه در SigNoz ممکن است ۱ تا ۲ ثانیه زمان ببرد.</span>
        </div>

        <!-- Error Alert if present -->
        <div v-if="selectedLog.errorMessage" class="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 flex items-start gap-2">
          <AlertTriangle :size="16" class="shrink-0 mt-0.5" />
          <div>
            <span class="font-bold block">پیام خطا:</span>
            <span class="font-mono text-[11px] block mt-0.5" dir="ltr">{{ selectedLog.errorMessage }}</span>
          </div>
        </div>

        <!-- Metadata Grid -->
        <div class="grid grid-cols-2 gap-3 p-3 bg-accent/20 rounded-xl border border-border">
          <div>
            <span class="text-muted-foreground">شناسه Trace ID:</span>
            <div class="flex items-center gap-1 mt-0.5">
              <span class="font-mono block select-all" dir="ltr">{{ selectedLog.traceId || '-' }}</span>
              <button
                v-if="selectedLog.traceId"
                type="button"
                class="text-muted-foreground hover:text-foreground"
                title="کپی Trace ID"
                @click="copyToClipboard(selectedLog.traceId)"
              >
                <Copy :size="12" />
              </button>
            </div>
          </div>

          <div>
            <span class="text-muted-foreground">شناسه Span ID:</span>
            <span class="font-mono block mt-0.5" dir="ltr">{{ selectedLog.spanId || '-' }}</span>
          </div>

          <div class="col-span-2">
            <span class="text-muted-foreground">مسیر کامل (Path / URL):</span>
            <span class="font-mono block mt-0.5 break-all select-all" dir="ltr">{{ selectedLog.path || '-' }}</span>
          </div>

          <div>
            <span class="text-muted-foreground">مدت زمان اجرا:</span>
            <span class="font-mono block mt-0.5">
              {{ selectedLog.durationMs !== null ? `${selectedLog.durationMs} میلی‌ثانیه` : '-' }}
            </span>
          </div>

          <div>
            <span class="text-muted-foreground">آدرس IP:</span>
            <span class="font-mono block mt-0.5" dir="ltr">{{ selectedLog.ip || '-' }}</span>
          </div>

          <div>
            <span class="text-muted-foreground">عامل انجام‌دهنده:</span>
            <span class="block mt-0.5">
              {{ selectedLog.actorType === 'admin' ? 'مدیر سیستم' : selectedLog.actorType === 'system' ? 'سیستمی' : 'کاربر' }}
              <span v-if="selectedLog.actorId" class="text-muted-foreground font-mono text-[10px]" dir="ltr">({{ selectedLog.actorId }})</span>
            </span>
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
