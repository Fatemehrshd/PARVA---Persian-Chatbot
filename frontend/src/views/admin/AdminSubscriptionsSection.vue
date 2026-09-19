<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Ban, UserPlus } from '@lucide/vue'
import AdminTable, { type TableColumn } from '../../components/admin/AdminTable.vue'
import AdminTableSkeleton from '../../components/admin/AdminTableSkeleton.vue'
import BaseButton from '../../components/ui/BaseButton.vue'
import DeleteConfirmModal from '../../components/admin/DeleteConfirmModal.vue'
import AssignSubscriptionModal from '../../components/admin/modals/AssignSubscriptionModal.vue'
import { subscriptionService } from '../../services/subscription.service'
import { useUiStore } from '../../stores/ui'
import type { Subscription } from '../../types'

const uiStore = useUiStore()

const subscriptions = ref<Subscription[]>([])
const isLoading = ref(false)
const isSaving = ref(false)

const isAssignModalOpen = ref(false)
const isCancelModalOpen = ref(false)
const cancellingSub = ref<Subscription | null>(null)

const columns: TableColumn[] = [
  { key: 'user', label: 'کاربر (نام و ایمیل)', width: '240px', sortable: true },
  { key: 'plan', label: 'طرح اشتراک', width: '160px', sortable: true, align: 'center' },
  { key: 'status', label: 'وضعیت', width: '120px', sortable: true, align: 'center' },
  { key: 'dates', label: 'دوره اعتبار', width: '200px', sortable: false, align: 'center' },
  { key: 'source', label: 'نحوه تخصیص', width: '130px', align: 'center' },
  { key: 'actions', label: 'عملیات', width: '90px', align: 'center', sortable: false },
]

async function loadSubscriptions() {
  isLoading.value = true
  try {
    const res = await subscriptionService.getAllSubscriptions()
    subscriptions.value = res.items || []
  } catch (err: any) {
    uiStore.showToast(err.message || 'خطا در دریافت اشتراک‌های کاربران', 'error')
  } finally {
    isLoading.value = false
  }
}

onMounted(loadSubscriptions)

async function handleAssignSubscription(data: { userId: string; planId: string; durationDays?: number }) {
  isSaving.value = true
  try {
    await subscriptionService.assignPlan(data)
    uiStore.showToast('اشتراک با موفقیت به کاربر اختصاص داده شد.', 'success')
    isAssignModalOpen.value = false
    await loadSubscriptions()
  } catch (err: any) {
    uiStore.showToast(err.message || 'خطا در تخصیص اشتراک', 'error')
  } finally {
    isSaving.value = false
  }
}

function openCancelConfirm(sub: Subscription) {
  cancellingSub.value = sub
  isCancelModalOpen.value = true
}

async function handleCancelSubscription() {
  if (!cancellingSub.value) return
  isSaving.value = true
  try {
    await subscriptionService.cancelSubscription(cancellingSub.value.id, 'لغو توسط مدیر سیستم')
    uiStore.showToast('اشتراک کاربر با موفقیت لغو شد.', 'success')
    isCancelModalOpen.value = false
    await loadSubscriptions()
  } catch (err: any) {
    uiStore.showToast(err.message || 'خطا در لغو اشتراک', 'error')
  } finally {
    isSaving.value = false
  }
}

function formatDate(iso?: string | null): string {
  if (!iso) return 'دائمی / نامحدود'
  try {
    return new Date(iso).toLocaleDateString('fa-IR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return iso
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between flex-wrap gap-3">
      <div>
        <h2 class="text-lg font-bold">مدیریت اشتراک کاربران</h2>
        <p class="text-xs text-muted-foreground mt-0.5">مشاهده اشتراک‌های فعال، منقضی‌شده و لغو شده کاربران سیستم</p>
      </div>
      <BaseButton variant="primary" class="gap-2" @click="isAssignModalOpen = true">
        <UserPlus :size="16" />
        <span>تخصیص اشتراک جدید</span>
      </BaseButton>
    </div>

    <!-- Table -->
    <div class="border border-border rounded-xl bg-card overflow-hidden">
      <AdminTableSkeleton v-if="isLoading" :columns="columns.length" :rows="4" />
      <AdminTable
        v-else
        :columns="columns"
        :items="subscriptions"
        paginated
        :page-size="10"
        :page-sizes="[10, 25, 50]"
        empty-text="هیچ اشتراکی یافت نشد."
      >
        <template #row="{ item: sub }">
          <!-- User column -->
          <td data-label="کاربر">
            <div class="flex flex-col text-right">
              <span class="font-bold text-sm text-foreground">{{ sub.user?.displayName || 'بدون نام' }}</span>
              <span class="text-xs text-muted-foreground font-mono" dir="ltr">{{ sub.user?.email || sub.userId }}</span>
            </div>
          </td>

          <!-- Plan column -->
          <td data-label="طرح اشتراک" class="text-center">
            <span class="font-semibold text-xs text-primary">{{ sub.plan?.name || 'طرح نامشخص' }}</span>
          </td>

          <!-- Status column -->
          <td data-label="وضعیت" class="text-center">
            <span
              v-if="sub.status === 'ACTIVE'"
              class="px-2 py-0.5 text-[11px] font-bold rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
            >
              فعال
            </span>
            <span
              v-else-if="sub.status === 'EXPIRED'"
              class="px-2 py-0.5 text-[11px] font-medium rounded-full bg-gray-500/10 text-muted-foreground border border-border"
            >
              منقضی‌شده
            </span>
            <span
              v-else-if="sub.status === 'CANCELLED'"
              class="px-2 py-0.5 text-[11px] font-medium rounded-full bg-destructive/10 text-destructive border border-destructive/20"
            >
              لغو شده
            </span>
            <span v-else class="text-xs text-muted-foreground">{{ sub.status }}</span>
          </td>

          <!-- Dates column -->
          <td data-label="دوره اعتبار" class="text-center">
            <div class="flex flex-col items-center text-[11px]">
              <span>از: {{ formatDate(sub.startDate) }}</span>
              <span class="text-muted-foreground">تا: {{ formatDate(sub.endDate) }}</span>
            </div>
          </td>

          <!-- Source column -->
          <td data-label="نحوه تخصیص" class="text-center">
            <span v-if="sub.source === 'purchase'" class="text-xs text-muted-foreground">خرید آنلاین</span>
            <span v-else-if="sub.source === 'admin_manual'" class="text-xs text-amber-500 font-medium">دستی ادمین</span>
            <span v-else-if="sub.source === 'free_activation'" class="text-xs text-emerald-500">فعال‌سازی رایگان</span>
            <span v-else class="text-xs text-muted-foreground">{{ sub.source }}</span>
          </td>

          <!-- Actions column -->
          <td data-label="عملیات" class="text-center">
            <button
              v-if="sub.status === 'ACTIVE'"
              class="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
              title="لغو اشتراک"
              @click="openCancelConfirm(sub)"
            >
              <Ban :size="15" />
            </button>
            <span v-else class="text-muted-foreground text-xs">-</span>
          </td>
        </template>
      </AdminTable>
    </div>

    <!-- Modals -->
    <AssignSubscriptionModal
      :open="isAssignModalOpen"
      :is-saving="isSaving"
      @close="isAssignModalOpen = false"
      @save="handleAssignSubscription"
    />

    <DeleteConfirmModal
      :open="isCancelModalOpen"
      title="لغو اشتراک کاربر"
      confirm-text="لغو اشتراک"
      eyebrow="مدیریت اشتراک"
      :description="`آیا از لغو اشتراک طرح «${cancellingSub?.plan?.name}» برای کاربر «${cancellingSub?.user?.email}» مطمئن هستید؟`"
      :is-loading="isSaving"
      @close="isCancelModalOpen = false"
      @confirm="handleCancelSubscription"
    />
  </div>
</template>
