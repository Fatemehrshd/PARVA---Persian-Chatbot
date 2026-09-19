<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { Plus, Tag, Search, Edit3, Trash2, CheckCircle, XCircle } from '@lucide/vue'
import AdminTable, { type TableColumn } from '../../components/admin/AdminTable.vue'
import AdminTableSkeleton from '../../components/admin/AdminTableSkeleton.vue'
import BaseButton from '../../components/ui/BaseButton.vue'
import CouponEditorModal from '../../components/admin/modals/CouponEditorModal.vue'
import { paymentService } from '../../services/payment.service'
import { useUiStore } from '../../stores/ui'
import type { Coupon, CreateCouponRequest, UpdateCouponRequest } from '../../types'

const uiStore = useUiStore()

const coupons = ref<Coupon[]>([])
const isLoading = ref(false)
const searchQuery = ref('')
const activeFilter = ref<string>('all')
const page = ref(1)
const totalPages = ref(1)
const totalCount = ref(0)

const isModalOpen = ref(false)
const selectedCoupon = ref<Coupon | null>(null)
const isSaving = ref(false)

const isDeleteModalOpen = ref(false)
const couponToDelete = ref<Coupon | null>(null)
const isDeleting = ref(false)

const columns: TableColumn[] = [
  { key: 'code', label: 'کد تخفیف', width: '200px', sortable: false },
  { key: 'discount', label: 'میزان تخفیف', width: '180px', sortable: false, align: 'center' },
  { key: 'conditions', label: 'شرایط و محدودیت‌ها', width: '200px', sortable: false, align: 'center' },
  { key: 'usage', label: 'میزان استفاده', width: '160px', sortable: false, align: 'center' },
  { key: 'status', label: 'وضعیت', width: '100px', sortable: false, align: 'center' },
  { key: 'actions', label: 'عملیات', width: '120px', sortable: false, align: 'center' },
]

async function loadCoupons() {
  isLoading.value = true
  try {
    const filterIsActive = activeFilter.value === 'all' ? undefined : activeFilter.value === 'active'
    const res = await paymentService.adminGetCoupons({
      page: page.value,
      limit: 10,
      search: searchQuery.value.trim() || undefined,
      isActive: filterIsActive,
    })
    coupons.value = res.items || []
    totalPages.value = res.totalPages || 1
    totalCount.value = res.total || 0
  } catch (err: any) {
    uiStore.showToast(err.message || 'خطا در دریافت لیست کدهای تخفیف', 'error')
  } finally {
    isLoading.value = false
  }
}

let searchTimer: any = null
function onSearchInput() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    page.value = 1
    loadCoupons()
  }, 300)
}

watch(activeFilter, () => {
  page.value = 1
  loadCoupons()
})

onMounted(loadCoupons)

function openCreateModal() {
  selectedCoupon.value = null
  isModalOpen.value = true
}

function openEditModal(coupon: Coupon) {
  selectedCoupon.value = coupon
  isModalOpen.value = true
}

async function handleSave(data: CreateCouponRequest | UpdateCouponRequest) {
  isSaving.value = true
  try {
    if (selectedCoupon.value) {
      await paymentService.adminUpdateCoupon(selectedCoupon.value.id, data as UpdateCouponRequest)
      uiStore.showToast('کد تخفیف با موفقیت بروزرسانی شد.', 'success')
    } else {
      await paymentService.adminCreateCoupon(data as CreateCouponRequest)
      uiStore.showToast('کد تخفیف جدید با موفقیت ایجاد شد.', 'success')
    }
    isModalOpen.value = false
    loadCoupons()
  } catch (err: any) {
    uiStore.showToast(err.message || 'خطا در ذخیره کد تخفیف', 'error')
  } finally {
    isSaving.value = false
  }
}

function openDeleteModal(coupon: Coupon) {
  couponToDelete.value = coupon
  isDeleteModalOpen.value = true
}

async function handleDelete() {
  if (!couponToDelete.value) return
  isDeleting.value = true
  try {
    await paymentService.adminDeleteCoupon(couponToDelete.value.id)
    uiStore.showToast('کد تخفیف با موفقیت حذف شد.', 'success')
    isDeleteModalOpen.value = false
    couponToDelete.value = null
    loadCoupons()
  } catch (err: any) {
    uiStore.showToast(err.message || 'خطا در حذف کد تخفیف', 'error')
  } finally {
    isDeleting.value = false
  }
}

function formatDate(iso?: string | null): string {
  if (!iso) return 'بدون محدودیت'
  try {
    return new Date(iso).toLocaleString('fa-IR', {
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
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h2 class="text-lg font-bold flex items-center gap-2">
          <Tag :size="20" class="text-primary" />
          مدیریت کدهای تخفیف
        </h2>
        <p class="text-xs text-muted-foreground mt-0.5">
          تعریف کوپن‌های درصدی یا ثابت برای طرح‌های اشتراک، تعیین سقف استفاده و تاریخ انقضا
        </p>
      </div>
      <BaseButton variant="primary" size="sm" @click="openCreateModal">
        <Plus :size="16" class="ml-1.5" />
        ایجاد کد تخفیف جدید
      </BaseButton>
    </div>

    <!-- Filters & Search -->
    <div class="flex flex-col sm:flex-row gap-3">
      <div class="relative flex-1">
        <Search :size="16" class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="جستجو در کدها و توضیحات..."
          class="w-full pr-9 pl-3 py-2 bg-card border border-border rounded-lg text-sm focus:border-primary outline-none text-foreground"
          @input="onSearchInput"
        />
      </div>
      <select
        v-model="activeFilter"
        class="px-3 py-2 bg-card border border-border rounded-lg text-sm focus:border-primary outline-none text-foreground min-w-[140px]"
      >
        <option value="all">همه وضعیت‌ها</option>
        <option value="active">فقط فعال</option>
        <option value="inactive">فقط غیرفعال</option>
      </select>
    </div>

    <!-- Table -->
    <div v-if="isLoading" class="bg-card border border-border rounded-xl p-4">
      <AdminTableSkeleton :rows="5" />
    </div>

    <div v-else class="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
      <AdminTable
        :columns="columns"
        :items="coupons"
        empty-text="هیچ کد تخفیفی یافت نشد."
      >
        <template #row="{ item: row }">
          <td data-label="کد تخفیف">
            <div class="text-right">
              <div class="flex items-center gap-2">
                <span class="font-mono font-bold text-xs px-2.5 py-1 rounded bg-primary/10 text-primary border border-primary/20">
                  {{ row.code }}
                </span>
              </div>
              <div v-if="row.description" class="text-xs text-muted-foreground mt-1 line-clamp-1">
                {{ row.description }}
              </div>
            </div>
          </td>

          <td data-label="میزان تخفیف" class="text-center font-medium text-xs">
            <span v-if="row.discountType === 'PERCENTAGE'" class="text-emerald-500 font-bold font-mono text-sm">
              {{ Number(row.discountValue).toLocaleString('fa-IR') }}٪
            </span>
            <span v-else class="text-emerald-500 font-bold font-mono">
              {{ Number(Math.floor(row.discountValue / 10)).toLocaleString('fa-IR') }} تومان
            </span>
            <div v-if="row.maxDiscountAmount && row.discountType === 'PERCENTAGE'" class="text-[11px] text-muted-foreground font-mono">
              سقف: {{ Number(Math.floor(row.maxDiscountAmount / 10)).toLocaleString('fa-IR') }} تومان
            </div>
          </td>

          <td data-label="شرایط و محدودیت‌ها" class="text-center text-xs space-y-0.5">
            <div v-if="row.minOrderAmount" class="text-muted-foreground">
              حداقل سفارش: <span class="font-mono text-foreground">{{ Number(Math.floor(row.minOrderAmount / 10)).toLocaleString('fa-IR') }} تومان</span>
            </div>
            <div class="text-muted-foreground">
              انقضا: <span class="font-mono text-foreground">{{ formatDate(row.expiresAt) }}</span>
            </div>
          </td>

          <td data-label="میزان استفاده" class="text-center text-xs space-y-1">
            <div class="font-mono font-bold">
              {{ Number(row.usedCount).toLocaleString('fa-IR') }}
              <span class="text-muted-foreground font-sans text-[11px]">
                / {{ row.usageLimit ? Number(row.usageLimit).toLocaleString('fa-IR') : 'نامحدود' }}
              </span>
            </div>
            <div class="text-[10px] text-muted-foreground">
              سقف هر کاربر: {{ Number(row.perUserLimit).toLocaleString('fa-IR') }}
            </div>
          </td>

          <td data-label="وضعیت" class="text-center">
            <div class="flex justify-center">
              <span
                v-if="row.isActive"
                class="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
              >
                <CheckCircle :size="12" />
                فعال
              </span>
              <span
                v-else
                class="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20"
              >
                <XCircle :size="12" />
                غیرفعال
              </span>
            </div>
          </td>

          <td data-label="عملیات" class="text-center">
            <div class="flex items-center justify-center gap-1">
              <button
                class="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                title="ویرایش"
                @click="openEditModal(row)"
              >
                <Edit3 :size="15" />
              </button>
              <button
                class="p-1.5 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors"
                title="حذف"
                @click="openDeleteModal(row)"
              >
                <Trash2 :size="15" />
              </button>
            </div>
          </td>
        </template>
      </AdminTable>

      <!-- Pagination -->
      <div
        v-if="totalPages > 1"
        class="px-4 py-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground"
      >
        <span>
          صفحه {{ Number(page).toLocaleString('fa-IR') }} از {{ Number(totalPages).toLocaleString('fa-IR') }}
          ({{ Number(totalCount).toLocaleString('fa-IR') }} کد ثبت‌شده)
        </span>
        <div class="flex items-center gap-2">
          <BaseButton
            variant="secondary"
            size="sm"
            :disabled="page <= 1"
            @click="page--; loadCoupons()"
          >
            قبلی
          </BaseButton>
          <BaseButton
            variant="secondary"
            size="sm"
            :disabled="page >= totalPages"
            @click="page++; loadCoupons()"
          >
            بعدی
          </BaseButton>
        </div>
      </div>
    </div>

    <!-- Create / Edit Modal -->
    <CouponEditorModal
      :open="isModalOpen"
      :coupon="selectedCoupon"
      :is-saving="isSaving"
      @close="isModalOpen = false"
      @save="handleSave"
    />

    <!-- Delete Confirmation Modal -->
    <div
      v-if="isDeleteModalOpen"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      @click.self="isDeleteModalOpen = false"
    >
      <div class="bg-card border border-border rounded-xl p-6 max-w-sm w-full space-y-4 shadow-xl text-right">
        <h3 class="text-base font-bold text-foreground">حذف کد تخفیف</h3>
        <p class="text-xs text-muted-foreground leading-relaxed">
          آیا از حذف کد تخفیف «<strong class="text-foreground font-mono">{{ couponToDelete?.code }}</strong>» اطمینان دارید؟ این عملیات غیرقابل بازگشت است.
        </p>
        <div class="flex items-center justify-end gap-2 pt-2">
          <BaseButton
            variant="secondary"
            size="sm"
            :disabled="isDeleting"
            @click="isDeleteModalOpen = false"
          >
            انصراف
          </BaseButton>
          <BaseButton
            variant="danger"
            size="sm"
            :disabled="isDeleting"
            @click="handleDelete"
          >
            {{ isDeleting ? 'در حال حذف...' : 'حذف قطعی' }}
          </BaseButton>
        </div>
      </div>
    </div>
  </div>
</template>
