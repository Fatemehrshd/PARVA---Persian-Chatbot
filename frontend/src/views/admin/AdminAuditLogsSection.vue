<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Eye } from '@lucide/vue'
import AdminTable, { type TableColumn } from '../../components/admin/AdminTable.vue'
import AdminTableSkeleton from '../../components/admin/AdminTableSkeleton.vue'
import AdminModal from '../../components/admin/AdminModal.vue'
import BaseButton from '../../components/ui/BaseButton.vue'
import { auditService } from '../../services/audit.service'
import { useUiStore } from '../../stores/ui'
import type { AuditLogItem } from '../../types'

const uiStore = useUiStore()

const logs = ref<AuditLogItem[]>([])
const isLoading = ref(false)

const isDetailModalOpen = ref(false)
const selectedLog = ref<AuditLogItem | null>(null)

const columns: TableColumn[] = [
  { key: 'action', label: 'عملیات / رویداد', width: '220px', sortable: true },
  { key: 'entityType', label: 'موجودیت', width: '130px', sortable: true, align: 'center' },
  { key: 'actor', label: 'عامل تغییر', width: '140px', align: 'center' },
  { key: 'createdAt', label: 'زمان وقوع', width: '170px', sortable: true, align: 'center' },
  { key: 'details', label: 'جزئیات', width: '80px', align: 'center', sortable: false },
]

async function loadAuditLogs() {
  isLoading.value = true
  try {
    const res = await auditService.getAuditLogs({ limit: 50 })
    logs.value = res.items || []
  } catch (err: any) {
    uiStore.showToast(err.message || 'خطا در بارگذاری لاگ‌های امنیتی', 'error')
  } finally {
    isLoading.value = false
  }
}

onMounted(loadAuditLogs)

function openDetails(log: AuditLogItem) {
  selectedLog.value = log
  isDetailModalOpen.value = true
}

function getActionLabel(action: string): { text: string; color: string } {
  if (action.includes('created')) return { text: 'ایجاد', color: 'text-emerald-500 bg-emerald-500/10' }
  if (action.includes('updated')) return { text: 'ویرایش', color: 'text-blue-500 bg-blue-500/10' }
  if (action.includes('deleted') || action.includes('cancelled')) return { text: 'حذف/لغو', color: 'text-rose-500 bg-rose-500/10' }
  if (action.includes('verified') || action.includes('success')) return { text: 'تأیید پرداخت', color: 'text-emerald-500 bg-emerald-500/10' }
  if (action.includes('failed')) return { text: 'شکست', color: 'text-destructive bg-destructive/10' }
  if (action.includes('assigned')) return { text: 'تخصیص اشتراک', color: 'text-amber-500 bg-amber-500/10' }
  return { text: action, color: 'text-muted-foreground bg-accent' }
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
  <div class="space-y-6">
    <div>
      <h2 class="text-lg font-bold">لاگ‌های امنیتی و رویدادهای سیستم (Audit Logs)</h2>
      <p class="text-xs text-muted-foreground mt-0.5">ثبت تغییرات حساس، تراکنش‌های مالی، تخصیص اشتراک‌ها و فعالیت‌های مدیریتی</p>
    </div>

    <!-- Table -->
    <div class="border border-border rounded-xl bg-card overflow-hidden">
      <AdminTableSkeleton v-if="isLoading" :columns="columns.length" :rows="4" />
      <AdminTable
        v-else
        :columns="columns"
        :items="logs"
        searchable
        empty-text="هیچ لاگی ثبت نشده است."
      >
        <template #row="{ item: log }">
          <!-- Action column -->
          <td data-label="عملیات">
            <div class="flex items-center gap-2 text-right">
              <span
                class="px-2 py-0.5 text-[11px] font-bold rounded-md"
                :class="getActionLabel(log.action).color"
              >
                {{ getActionLabel(log.action).text }}
              </span>
              <span class="text-xs font-mono text-muted-foreground" dir="ltr">{{ log.action }}</span>
            </div>
          </td>

          <!-- Entity column -->
          <td data-label="موجودیت" class="text-center">
            <span class="px-2 py-0.5 text-[11px] rounded-full border border-border bg-accent/40 font-mono">
              {{ log.entityType }}
            </span>
          </td>

          <!-- Actor column -->
          <td data-label="انجام‌دهنده" class="text-center">
            <div class="flex flex-col items-center">
              <span class="text-xs font-semibold">{{ log.actorType === 'admin' ? 'مدیر سیستم' : log.actorType === 'system' ? 'سیستمی' : 'کاربر' }}</span>
              <span v-if="log.actorId" class="text-[10px] text-muted-foreground font-mono" dir="ltr">{{ log.actorId.slice(0, 8) }}...</span>
            </div>
          </td>

          <!-- Time column -->
          <td data-label="زمان ثبت" class="text-center">
            <span class="text-xs text-muted-foreground">{{ formatDate(log.createdAt) }}</span>
          </td>

          <!-- Details column -->
          <td data-label="جزئیات" class="text-center">
            <button
              class="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              title="مشاهده جزئیات لاگ"
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
      eyebrow="لاگ ممیزی"
      title="جزئیات رویداد و تغییرات"
      @close="isDetailModalOpen = false"
    >
      <div v-if="selectedLog" class="space-y-4 text-xs" dir="rtl">
        <div class="grid grid-cols-2 gap-3 p-3 bg-accent/30 rounded-xl border border-border">
          <div>
            <span class="text-muted-foreground">شناسه رویداد:</span>
            <span class="font-mono block" dir="ltr">{{ selectedLog.id }}</span>
          </div>
          <div>
            <span class="text-muted-foreground">شناسه موجودیت:</span>
            <span class="font-mono block" dir="ltr">{{ selectedLog.entityId || '-' }}</span>
          </div>
          <div>
            <span class="text-muted-foreground">آدرس IP:</span>
            <span class="font-mono block" dir="ltr">{{ selectedLog.ip || '-' }}</span>
          </div>
          <div>
            <span class="text-muted-foreground">زمان ثبت:</span>
            <span class="block">{{ formatDate(selectedLog.createdAt) }}</span>
          </div>
        </div>

        <div v-if="selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0">
          <span class="font-bold text-muted-foreground mb-1 block">اطلاعات تکمیلی (Metadata):</span>
          <pre class="p-3 bg-card border border-border rounded-xl font-mono text-[11px] overflow-x-auto" dir="ltr">{{ JSON.stringify(selectedLog.metadata, null, 2) }}</pre>
        </div>

        <div v-if="selectedLog.changes">
          <span class="font-bold text-muted-foreground mb-1 block">تغییرات داده (Changes):</span>
          <pre class="p-3 bg-card border border-border rounded-xl font-mono text-[11px] overflow-x-auto" dir="ltr">{{ JSON.stringify(selectedLog.changes, null, 2) }}</pre>
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
