<script setup lang="ts">
import { Download } from '@lucide/vue'
import AdminModal from '../AdminModal.vue'
import BaseButton from '../../ui/BaseButton.vue'
import { formatIranDateTime } from '../../../lib/date'
import { fixUtf8MangledString } from '../../../lib/filename'
import { buildUrl } from '../../../services/api'
import type { AdminFileDetail } from '../../../types'

defineProps<{
  open: boolean
  file: AdminFileDetail | null
  isRetrying?: boolean
}>()

defineEmits<{
  close: []
  retry: [file: AdminFileDetail]
}>()

function getFileDownloadUrl(fileId: string): string {
  const token = localStorage.getItem('token')
  const qs = token ? `?token=${encodeURIComponent(token)}` : ''
  return buildUrl(`/admin/files/${fileId}/content${qs}`)
}

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
</script>

<template>
  <AdminModal
    v-if="open && file"
    eyebrow="مدیریت فایل‌ها"
    title="جزئیات فایل و بررسی لاگ پردازش"
    @close="$emit('close')"
  >
    <div class="file-detail-dialog space-y-4">
      <!-- File Header Card -->
      <div class="file-detail-head p-3 rounded-xl bg-card border border-border flex items-center justify-between flex-wrap gap-2">
        <div class="flex items-center gap-3">
          <span :class="['att-badge px-2.5 py-1 rounded text-xs font-bold uppercase', getAttBadgeClass(file.fileType)]">
            {{ file.fileType }}
          </span>
          <div>
            <strong class="block text-sm font-semibold">{{ fixUtf8MangledString(file.originalName) }}</strong>
            <span class="text-xs text-muted-foreground mono">{{ formatFileSize(file.fileSize) }} | {{ file.mimeType }}</span>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <span :class="['status-badge-pill px-2.5 py-1 rounded-full text-xs font-medium border', getStatusClass(file.status)]">
            {{ getStatusLabel(file.status) }}
          </span>
          <a
            :href="getFileDownloadUrl(file.id)"
            :download="fixUtf8MangledString(file.originalName)"
            class="download-btn flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border bg-secondary hover:bg-secondary/80 text-foreground font-medium"
            title="دانلود فایل اصلی"
          >
            <Download :size="13" />
            <span>دانلود فایل</span>
          </a>
        </div>
      </div>

      <!-- Meta Grid -->
      <div class="file-meta-grid grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <div class="meta-item p-2.5 rounded-lg bg-card/60 border border-border">
          <span class="text-muted-foreground block mb-1">کاربر ارسال‌کننده:</span>
          <strong>{{ file.user?.displayName || file.user?.email || 'نامشخص' }}</strong>
          <span v-if="file.user?.displayName" class="block text-muted-foreground text-[11px]">{{ file.user.email }}</span>
        </div>
        <div class="meta-item p-2.5 rounded-lg bg-card/60 border border-border">
          <span class="text-muted-foreground block mb-1">زمان پردازش / تاریخ:</span>
          <strong v-if="file.metadata?.processingDurationMs">{{ file.metadata.processingDurationMs }} میلی‌ثانیه</strong>
          <strong v-else>—</strong>
          <span class="block text-muted-foreground text-[11px]">{{ formatIranDateTime(file.createdAt) }}</span>
        </div>
      </div>

      <!-- Error Alert if status is error -->
      <div v-if="file.status === 'error'" class="error-detail-box p-3 rounded-xl bg-destructive/10 border border-destructive/30 space-y-1.5">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold text-destructive flex items-center gap-1">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            پیام و علت خطای پردازش:
          </span>
          <BaseButton
            variant="secondary"
            size="sm"
            :loading="isRetrying"
            @click="$emit('retry', file)"
          >
            تلاش مجدد پردازش
          </BaseButton>
        </div>
        <p class="text-xs text-destructive/90 font-medium">{{ file.errorMessage || 'خطای نامشخص در حین استخراج فایل' }}</p>
        <pre v-if="file.metadata?.errorDetails" class="text-[11px] p-2 rounded bg-black/20 overflow-x-auto text-destructive-foreground/80 mono">{{ file.metadata.errorDetails }}</pre>
      </div>

      <!-- Extracted Text Area -->
      <div class="extracted-text-section space-y-1.5">
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold text-foreground">محتوای استخراج‌شده از فایل:</span>
          <span v-if="file.extractedText" class="text-[11px] text-muted-foreground">
            {{ file.extractedText.length.toLocaleString('fa-IR') }} کاراکتر
          </span>
        </div>
        <div v-if="file.extractedText" class="extracted-content-box p-3 rounded-xl bg-card border border-border text-xs max-h-60 overflow-y-auto whitespace-pre-wrap leading-relaxed">
          {{ file.extractedText }}
        </div>
        <div v-else class="empty-extracted p-4 rounded-xl bg-card/40 border border-dashed border-border text-center text-xs text-muted-foreground">
          {{ file.status === 'processing' ? 'فایل در حال پردازش در صف پس‌زمینه است...' : 'هیچ متنی از این فایل استخراج نشده است.' }}
        </div>
      </div>

      <!-- Technical Metadata -->
      <div v-if="file.metadata" class="metadata-section space-y-1">
        <span class="text-xs font-semibold text-muted-foreground">متادیتای فنی و تله‌متری (Trace):</span>
        <pre class="text-[11px] p-2.5 rounded-xl bg-card border border-border overflow-x-auto mono text-muted-foreground max-h-32">{{ JSON.stringify(file.metadata, null, 2) }}</pre>
      </div>

      <div class="modal-actions mt-4 flex justify-end">
        <BaseButton variant="ghost" size="md" type="button" @click="$emit('close')">
          بستن
        </BaseButton>
      </div>
    </div>
  </AdminModal>
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
