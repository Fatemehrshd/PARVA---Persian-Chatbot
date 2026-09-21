<script setup lang="ts">
import { ref, onMounted } from 'vue'
import {
  Users,
  MessageSquare,
  FileText,
  Boxes,
  Plus,
  ExternalLink,
  ThumbsUp,
  ThumbsDown,
} from '@lucide/vue'
import AdminTable, { type TableColumn } from '../../components/admin/AdminTable.vue'
import BaseButton from '../../components/ui/BaseButton.vue'
import ModelEditorModal from '../../components/admin/modals/ModelEditorModal.vue'
import { adminService } from '../../services/admin.service'
import { modelsService } from '../../services/models.service'
import { useModelsStore } from '../../stores/models'
import { useUiStore } from '../../stores/ui'
import type { AdminDashboardStats, Model, AdminUser, Provider } from '../../types'

defineEmits<{
  navigate: [section: string]
}>()

const modelsStore = useModelsStore()
const uiStore = useUiStore()

const stats = ref<AdminDashboardStats | null>(null)
const recentModels = ref<Model[]>(modelsStore.models)
const topUsers = ref<AdminUser[]>([])
const providers = ref<Provider[]>([])
const isLoading = ref(true)
const isSaving = ref(false)
const errorMessage = ref('')
const isEditorModalOpen = ref(false)

const modelColumns: TableColumn[] = [
  { key: 'name', label: 'نام مدل', width: '220px' },
  { key: 'provider', label: 'ارائه‌دهنده', width: '150px' },
  { key: 'apiIdentifier', label: 'شناسه API', width: '200px' },
  { key: 'isActive', label: 'وضعیت', width: '100px' },
]

async function loadDashboardData() {
  isLoading.value = true
  errorMessage.value = ''
  try {
    const [dashStats, modelsData, usersData, provsData] = await Promise.allSettled([
      adminService.getDashboardStats(),
      modelsService.listModels(),
      adminService.listUsers(),
      modelsService.listProviders(),
    ])

    if (dashStats.status === 'fulfilled') {
      stats.value = dashStats.value
    }
    if (modelsData.status === 'fulfilled') {
      const mList = Array.isArray(modelsData.value) ? modelsData.value : (modelsData.value as any)?.items || []
      recentModels.value = mList.length > 0 ? mList.slice(0, 5) : modelsStore.models.slice(0, 5)
    }
    if (usersData.status === 'fulfilled') {
      const uList = Array.isArray(usersData.value) ? usersData.value : (usersData.value as any)?.items || []
      topUsers.value = [...uList]
        .sort((a, b) => (Number(b.usedTokens) || 0) - (Number(a.usedTokens) || 0))
        .slice(0, 5)
    }
    if (provsData.status === 'fulfilled') {
      providers.value = Array.isArray(provsData.value) ? provsData.value : (provsData.value as any)?.items || []
    }
  } catch (err: any) {
    errorMessage.value = err?.message || 'خطا در بارگذاری آمار داشبورد'
  } finally {
    isLoading.value = false
  }
}

async function handleSaveModel(payload: { name: string; provider: string; providerId?: string; apiIdentifier: string; isActive: boolean }) {
  isSaving.value = true
  try {
    await modelsStore.addModel(payload)
    uiStore.showToast('مدل جدید با موفقیت اضافه شد.', 'success')
    isEditorModalOpen.value = false
    await loadDashboardData()
  } catch (err: any) {
    uiStore.showToast(err?.message || 'ذخیره مدل با خطا مواجه شد', 'error')
  } finally {
    isSaving.value = false
  }
}

onMounted(loadDashboardData)
</script>

<template>
  <div class="dashboard-section space-y-6">
    <div v-if="errorMessage" class="error-banner p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive">
      {{ errorMessage }}
    </div>

    <!-- 5 KPI Cards -->
    <div class="kpi-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      <div class="metric-card p-4 rounded-xl border border-border bg-card shadow-sm flex items-center justify-between">
        <div>
          <span class="text-xs text-muted-foreground block mb-1">کاربران ثبت‌نام‌شده</span>
          <strong class="text-2xl font-bold font-mono text-foreground">
            {{ stats?.totalUsers !== undefined ? Number(stats.totalUsers).toLocaleString('fa-IR') : '—' }}
          </strong>
        </div>
        <div class="metric-icon-box p-2.5 rounded-xl bg-primary/10 text-primary">
          <Users :size="22" />
        </div>
      </div>

      <div class="metric-card p-4 rounded-xl border border-border bg-card shadow-sm flex items-center justify-between">
        <div>
          <span class="text-xs text-muted-foreground block mb-1">گفتگوهای ایجاد‌شده</span>
          <strong class="text-2xl font-bold font-mono text-foreground">
            {{ stats?.totalConversations !== undefined ? Number(stats.totalConversations).toLocaleString('fa-IR') : '—' }}
          </strong>
        </div>
        <div class="metric-icon-box p-2.5 rounded-xl bg-blue-500/10 text-blue-500">
          <MessageSquare :size="22" />
        </div>
      </div>

      <div class="metric-card p-4 rounded-xl border border-border bg-card shadow-sm flex items-center justify-between">
        <div>
          <span class="text-xs text-muted-foreground block mb-1">کل پیام‌های تبادل‌شده</span>
          <strong class="text-2xl font-bold font-mono text-foreground">
            {{ stats?.totalMessages !== undefined ? Number(stats.totalMessages).toLocaleString('fa-IR') : '—' }}
          </strong>
        </div>
        <div class="metric-icon-box p-2.5 rounded-xl bg-emerald-500/10 text-emerald-500">
          <FileText :size="22" />
        </div>
      </div>

      <div class="metric-card p-4 rounded-xl border border-border bg-card shadow-sm flex items-center justify-between">
        <div>
          <span class="text-xs text-muted-foreground block mb-1">مدل‌های فعال</span>
          <strong class="text-2xl font-bold font-mono text-foreground">
            {{ stats?.activeModels !== undefined ? Number(stats.activeModels).toLocaleString('fa-IR') : '—' }}
          </strong>
        </div>
        <div class="metric-icon-box p-2.5 rounded-xl bg-purple-500/10 text-purple-500">
          <Boxes :size="22" />
        </div>
      </div>

      <div class="metric-card p-4 rounded-xl border border-border bg-card shadow-sm flex items-center justify-between">
        <div>
          <span class="text-xs text-muted-foreground block mb-1">رضایت کاربران (لایک‌ها)</span>
          <strong class="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
            {{ stats?.satisfactionRate !== undefined ? `${Number(stats.satisfactionRate).toLocaleString('fa-IR')}٪` : '۱۰۰٪' }}
          </strong>
          <span class="text-[11px] text-muted-foreground block mt-0.5">
            {{ Number(stats?.totalLikes || 0).toLocaleString('fa-IR') }} 👍 / {{ Number(stats?.totalDislikes || 0).toLocaleString('fa-IR') }} 👎
          </span>
        </div>
        <div class="metric-icon-box p-2.5 rounded-xl bg-amber-500/10 text-amber-500">
          <ThumbsUp :size="22" />
        </div>
      </div>
    </div>

    <!-- Main Dashboard Row: Recent Models Table & Top Token Consumers -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Recent Models Table -->
      <div class="lg:col-span-2 space-y-3">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-bold text-foreground">مدل‌های فعال اخیر</h3>
          <div class="flex items-center gap-2">
            <BaseButton variant="primary" size="sm" @click="isEditorModalOpen = true">
              <Plus :size="14" />
              <span>مدل جدید</span>
            </BaseButton>
            <BaseButton variant="ghost" size="sm" @click="$emit('navigate', 'models')">
              <span>مشاهده همه مدل‌ها</span>
              <ExternalLink :size="13" class="mr-1" />
            </BaseButton>
          </div>
        </div>

        <AdminTable :columns="modelColumns" :items="recentModels" tableClass="dashboard-table">
          <template #row="{ item: model }">
            <td class="font-semibold text-foreground">{{ model.name }}</td>
            <td>
              <span class="provider-pill px-2 py-0.5 rounded text-xs bg-muted text-muted-foreground font-medium">
                {{ model.provider }}
              </span>
            </td>
            <td class="mono text-xs text-muted-foreground">{{ model.apiIdentifier }}</td>
            <td>
              <span
                class="status-tag text-[11px] px-2 py-0.5 rounded-full font-medium"
                :class="model.isActive ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' : 'bg-muted text-muted-foreground'"
              >
                {{ model.isActive ? 'فعال' : 'غیرفعال' }}
              </span>
            </td>
          </template>
        </AdminTable>
      </div>

      <!-- Top Token Consumers -->
      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-bold text-foreground">پرمصرف‌ترین کاربران</h3>
          <BaseButton variant="ghost" size="sm" @click="$emit('navigate', 'users')">
            <span>مشاهده کاربران</span>
            <ExternalLink :size="13" class="mr-1" />
          </BaseButton>
        </div>

        <div class="top-users-list p-4 rounded-xl border border-border bg-card space-y-3">
          <div
            v-for="(u, idx) in topUsers"
            :key="u.id"
            class="top-user-item flex items-center justify-between py-2 border-b border-border/50 last:border-none"
          >
            <div class="flex items-center gap-2.5">
              <span class="user-rank text-xs font-mono font-bold text-muted-foreground w-4 text-center">
                {{ idx + 1 }}
              </span>
              <div class="avatar-chip w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                {{ (u.displayName || u.email).charAt(0).toUpperCase() }}
              </div>
              <div class="overflow-hidden">
                <strong class="block text-xs truncate max-w-[130px]" :title="u.displayName || u.email">
                  {{ u.displayName || u.email }}
                </strong>
                <span class="text-[10px] text-muted-foreground mono block truncate max-w-[130px]">{{ u.email }}</span>
              </div>
            </div>

            <div class="text-left">
              <span class="font-mono text-xs font-bold text-foreground block">
                {{ Number(u.usedTokens || 0).toLocaleString('fa-IR') }}
              </span>
              <span class="text-[10px] text-muted-foreground block">توکن مصرفی</span>
            </div>
          </div>

          <div v-if="!topUsers.length" class="empty-top p-6 text-center text-xs text-muted-foreground">
            هیچ داده‌ای برای نمایش موجود نیست.
          </div>
        </div>
      </div>
    </div>

    <!-- User Experience & Satisfaction Overview -->
    <div class="feedback-section p-5 rounded-xl border border-border bg-card shadow-sm space-y-4">
      <div class="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 class="text-sm font-bold text-foreground flex items-center gap-2">
            <ThumbsUp :size="16" class="text-primary" />
            <span>تجربه کاربری و رضایت کلی (User Experience & Satisfaction)</span>
          </h3>
          <p class="text-xs text-muted-foreground mt-0.5">
            آمار کلی بازخوردهای ثبت‌شده و میزان رضایت کاربران از پاسخ‌های هوش مصنوعی
          </p>
        </div>
      </div>

      <!-- Satisfaction summary banner -->
      <div class="satisfaction-summary p-4 rounded-lg bg-secondary/30 border border-border/60 flex items-center justify-between flex-wrap gap-4">
        <div class="flex items-center gap-6">
          <div class="flex items-center gap-2 text-sm font-bold text-emerald-600 dark:text-emerald-400">
            <ThumbsUp :size="18" />
            <span>{{ Number(stats?.totalLikes || 0).toLocaleString('fa-IR') }} پاسخ پسندیده‌شده</span>
          </div>
          <div class="flex items-center gap-2 text-sm font-bold text-rose-600 dark:text-rose-400">
            <ThumbsDown :size="18" />
            <span>{{ Number(stats?.totalDislikes || 0).toLocaleString('fa-IR') }} پاسخ ناپسند</span>
          </div>
        </div>
        <div class="flex items-center gap-2 text-sm font-bold text-foreground">
          <span>شاخص کلی رضایت‌مندی:</span>
          <span class="px-3 py-1 rounded-full text-sm font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-mono">
            {{ stats?.satisfactionRate !== undefined ? `${Number(stats.satisfactionRate).toLocaleString('fa-IR')}٪` : '۱۰۰٪' }}
          </span>
        </div>
      </div>
    </div>

    <!-- Model Editor Modal -->
    <ModelEditorModal
      :open="isEditorModalOpen"
      :providers="providers"
      :isSaving="isSaving"
      @close="isEditorModalOpen = false"
      @save="handleSaveModel"
    />
  </div>
</template>

<style scoped>
.mono {
  font-family: var(--font-mono, monospace);
  direction: ltr;
}
</style>
