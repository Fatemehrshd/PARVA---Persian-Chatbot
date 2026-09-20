<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Plus, Edit2, Trash2 } from '@lucide/vue'
import AdminTable, { type TableColumn } from '../../components/admin/AdminTable.vue'
import AdminTableSkeleton from '../../components/admin/AdminTableSkeleton.vue'
import BaseButton from '../../components/ui/BaseButton.vue'
import BaseToggle from '../../components/ui/BaseToggle.vue'
import PlanEditorModal from '../../components/admin/modals/PlanEditorModal.vue'
import DeleteConfirmModal from '../../components/admin/DeleteConfirmModal.vue'
import { subscriptionService } from '../../services/subscription.service'
import { useUiStore } from '../../stores/ui'
import type { SubscriptionPlan } from '../../types'

const uiStore = useUiStore()

const plans = ref<SubscriptionPlan[]>([])
const isLoading = ref(false)
const isSaving = ref(false)

const isEditorModalOpen = ref(false)
const editingPlan = ref<SubscriptionPlan | null>(null)

const isDeleteModalOpen = ref(false)
const deletingPlan = ref<SubscriptionPlan | null>(null)

const columns: TableColumn[] = [
  { key: 'name', label: 'نام و شناسه طرح', width: '220px', sortable: true },
  { key: 'price', label: 'قیمت و دوره', width: '170px', sortable: true, align: 'center' },
  { key: 'tokenQuota', label: 'سقف توکن', width: '160px', sortable: true, align: 'center' },
  { key: 'features', label: 'قابلیت‌های فعال', width: '180px', sortable: false, align: 'center' },
  { key: 'isDefault', label: 'پیش‌فرض', width: '90px', align: 'center' },
  { key: 'isActive', label: 'وضعیت فعال', width: '100px', align: 'center' },
  { key: 'actions', label: 'عملیات', width: '110px', align: 'center', sortable: false },
]

async function loadPlans() {
  isLoading.value = true
  try {
    plans.value = await subscriptionService.getAllPlans()
  } catch (err: any) {
    uiStore.showToast(err.message || 'خطا در دریافت لیست طرح‌ها', 'error')
  } finally {
    isLoading.value = false
  }
}

onMounted(loadPlans)

function openCreateModal() {
  editingPlan.value = null
  isEditorModalOpen.value = true
}

function openEditModal(plan: SubscriptionPlan) {
  editingPlan.value = plan
  isEditorModalOpen.value = true
}

function openDeleteConfirm(plan: SubscriptionPlan) {
  if (plan.isDefault) {
    uiStore.showToast('امکان حذف طرح پیش‌فرض سیستم وجود ندارد.', 'warning')
    return
  }
  deletingPlan.value = plan
  isDeleteModalOpen.value = true
}

async function handleSavePlan(data: any) {
  isSaving.value = true
  try {
    if (editingPlan.value) {
      await subscriptionService.updatePlan(editingPlan.value.id, data)
      uiStore.showToast('طرح با موفقیت ویرایش شد.', 'success')
    } else {
      await subscriptionService.createPlan(data)
      uiStore.showToast('طرح جدید با موفقیت ایجاد شد.', 'success')
    }
    isEditorModalOpen.value = false
    await loadPlans()
  } catch (err: any) {
    uiStore.showToast(err.message || 'خطا در ذخیره طرح', 'error')
  } finally {
    isSaving.value = false
  }
}

async function handleDeletePlan() {
  if (!deletingPlan.value) return
  isSaving.value = true
  try {
    await subscriptionService.deletePlan(deletingPlan.value.id)
    uiStore.showToast('طرح با موفقیت حذف شد.', 'success')
    isDeleteModalOpen.value = false
    await loadPlans()
  } catch (err: any) {
    uiStore.showToast(err.message || 'خطا در حذف طرح', 'error')
  } finally {
    isSaving.value = false
  }
}

async function handleToggleActive(plan: SubscriptionPlan) {
  try {
    const updated = await subscriptionService.updatePlan(plan.id, { isActive: !plan.isActive })
    plan.isActive = updated.isActive
    uiStore.showToast(`طرح «${plan.name}» ${plan.isActive ? 'فعال' : 'غیرفعال'} شد.`, 'info')
  } catch (err: any) {
    uiStore.showToast(err.message || 'خطا در تغییر وضعیت طرح', 'error')
  }
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header row with action button -->
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-lg font-bold">مدیریت طرح‌های اشتراک</h2>
        <p class="text-xs text-muted-foreground mt-0.5">تعریف طرح‌های تجاری، سهمیه توکن، قیمت‌گذاری و مدل‌های هوش مصنوعی اختصاصی</p>
      </div>
      <BaseButton variant="primary" class="gap-2" @click="openCreateModal">
        <Plus :size="16" />
        <span>طرح جدید</span>
      </BaseButton>
    </div>

    <!-- Table -->
    <div class="border border-border rounded-xl bg-card overflow-hidden">
      <AdminTableSkeleton v-if="isLoading" :columns="columns.length" :rows="3" />
      <AdminTable
        v-else
        :columns="columns"
        :items="plans"
        searchable
        empty-text="هنوز طرح اشتراکی تعریف نشده است."
      >
        <template #row="{ item: plan }">
          <!-- Name column -->
          <td data-label="نام و شناسه طرح">
            <div class="flex flex-col text-right">
              <span class="font-bold text-sm text-foreground">{{ plan.name }}</span>
              <span class="text-xs text-muted-foreground font-mono" dir="ltr">{{ plan.slug }}</span>
            </div>
          </td>

          <!-- Price column -->
          <td data-label="قیمت و دوره" class="text-center">
            <div class="flex flex-col items-center">
              <span v-if="Number(plan.price) === 0" class="text-xs font-bold text-emerald-500">رایگان</span>
              <span v-else class="text-xs font-semibold">{{ Number(plan.price).toLocaleString('fa-IR') }} ریال</span>
              <span class="text-[11px] text-muted-foreground">{{ plan.durationDays > 0 ? `${plan.durationDays} روزه` : 'دائمی' }}</span>
            </div>
          </td>

          <!-- Token Quota column -->
          <td data-label="سقف توکن" class="text-center">
            <div class="flex flex-col items-center">
              <span v-if="plan.tokenQuota > 0" class="text-xs font-bold font-mono">
                {{ Number(plan.tokenQuota).toLocaleString('fa-IR') }}
              </span>
              <span v-else class="text-[11px] text-muted-foreground">ارث‌بری از سراسری</span>
              <span class="text-[10px] text-muted-foreground">ریست هر {{ plan.resetHours }} ساعت</span>
            </div>
          </td>

          <!-- Features column -->
          <td data-label="قابلیت‌های فعال" class="text-center">
            <div class="flex flex-wrap items-center justify-center gap-1.5">
              <span
                v-if="plan.features?.webSearch"
                class="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-blue-500/10 text-blue-500 border border-blue-500/20"
              >
                وب
              </span>
              <span
                v-if="plan.features?.thinking"
                class="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-purple-500/10 text-purple-500 border border-purple-500/20"
              >
                تفکر
              </span>
              <span
                v-if="plan.features?.document"
                class="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-amber-500/10 text-amber-500 border border-amber-500/20"
              >
                اسناد
              </span>
              <span
                v-if="!plan.features?.webSearch && !plan.features?.thinking && !plan.features?.document"
                class="text-[11px] text-muted-foreground"
              >
                پایه
              </span>
            </div>
          </td>

          <!-- Default column -->
          <td data-label="پیش‌فرض" class="text-center">
            <span
              v-if="plan.isDefault"
              class="px-2 py-0.5 text-[11px] font-bold rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20"
            >
              پیش‌فرض
            </span>
            <span v-else class="text-muted-foreground text-xs">-</span>
          </td>

          <!-- Active column -->
          <td data-label="وضعیت فعال" class="text-center">
            <div class="flex justify-center">
              <BaseToggle
                :model-value="plan.isActive"
                @update:model-value="handleToggleActive(plan)"
              />
            </div>
          </td>

          <!-- Actions column -->
          <td data-label="عملیات" class="text-center">
            <div class="flex items-center justify-center gap-1">
              <button
                class="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                title="ویرایش طرح"
                @click="openEditModal(plan)"
              >
                <Edit2 :size="14" />
              </button>
              <button
                v-if="!plan.isDefault"
                class="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
                title="حذف طرح"
                @click="openDeleteConfirm(plan)"
              >
                <Trash2 :size="14" />
              </button>
            </div>
          </td>
        </template>
      </AdminTable>
    </div>

    <!-- Modals -->
    <PlanEditorModal
      :open="isEditorModalOpen"
      :plan="editingPlan"
      :is-saving="isSaving"
      @close="isEditorModalOpen = false"
      @save="handleSavePlan"
    />

    <DeleteConfirmModal
      :open="isDeleteModalOpen"
      title="حذف طرح اشتراک"
      confirm-text="حذف طرح"
      eyebrow="طرح‌های اشتراک"
      :description="`آیا از حذف طرح «${deletingPlan?.name}» مطمئن هستید؟ کاربران دارای این طرح دسترسی خود را حفظ خواهند کرد اما این طرح دیگر قابل خرید نخواهد بود.`"
      :is-loading="isSaving"
      @close="isDeleteModalOpen = false"
      @confirm="handleDeletePlan"
    />
  </div>
</template>
