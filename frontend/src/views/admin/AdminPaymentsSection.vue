<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { CheckCircle2, CreditCard, UserCheck } from '@lucide/vue'
import AdminTable, { type TableColumn } from '../../components/admin/AdminTable.vue'
import AdminTableSkeleton from '../../components/admin/AdminTableSkeleton.vue'
import { paymentService } from '../../services/payment.service'
import { useUiStore } from '../../stores/ui'
import type { Payment } from '../../types'

const uiStore = useUiStore()

const payments = ref<Payment[]>([])
const isLoading = ref(false)
const page = ref(1)
const limit = ref(10)
const searchQuery = ref('')
const searchField = ref('user.email')
const stats = ref<{
  totalRevenue: number
  successfulCount: number
  subscriptionsByPlan: Array<{ planId: string; planName: string; count: number }>
}>({
  totalRevenue: 0,
  successfulCount: 0,
  subscriptionsByPlan: [],
})

const columns: TableColumn[] = [
  { key: 'user', label: 'کاربر پرداخت‌کننده', width: '220px', sortable: true },
  { key: 'plan', label: 'طرح خریداری‌شده', width: '150px', sortable: true, align: 'center' },
  { key: 'amount', label: 'مبلغ پرداختی', width: '150px', sortable: true, align: 'center' },
  { key: 'status', label: 'وضعیت پرداخت', width: '120px', sortable: true, align: 'center' },
  { key: 'refId', label: 'کد پیگیری / شناسه', width: '200px', sortable: false, align: 'center' },
  { key: 'createdAt', label: 'تاریخ و زمان', width: '160px', sortable: true, align: 'center' },
]

async function loadPayments() {
  isLoading.value = true
  try {
    const params: any = {
      page: page.value,
      limit: limit.value,
    }
    if (searchQuery.value.trim()) {
      params.search = searchQuery.value.trim()
      if (searchField.value) params.searchField = searchField.value
    }

    const res = await paymentService.getAllPayments(params)
    payments.value = res.items || []
    if (res.stats) {
      stats.value = res.stats
    }
  } catch (err: any) {
    uiStore.showToast(err.message || 'خطا در دریافت لیست تراکنش‌ها', 'error')
  } finally {
    isLoading.value = false
  }
}

function handlePageChange(newPage: number) {
  if (newPage === page.value) return
  page.value = newPage
  loadPayments()
}

function handlePageSizeChange(newSize: number) {
  if (newSize === limit.value && page.value === 1) return
  limit.value = newSize
  page.value = 1
  loadPayments()
}

let searchTimer: ReturnType<typeof setTimeout> | null = null

function handleSearch(query: string, field?: string) {
  searchQuery.value = query
  searchField.value = field || searchField.value || 'user.email'
  page.value = 1
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    loadPayments()
  }, 250)
}

onMounted(loadPayments)

function formatDate(iso?: string): string {
  if (!iso) return '-'
  try {
    return new Date(iso).toLocaleString('fa-IR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <h2 class="text-lg font-bold">تراکنش‌های مالی و گزارش پرداخت‌ها</h2>
      <p class="text-xs text-muted-foreground mt-0.5">مشاهده لاگ کلیه تراکنش‌های بانکی، وضعیت تایید و کدهای پیگیری</p>
    </div>

    <!-- KPI Summary Cards -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <!-- Total Revenue -->
      <div class="p-4 rounded-xl border border-border bg-card shadow-sm space-y-1">
        <div class="flex items-center justify-between text-muted-foreground text-xs font-medium">
          <span>مجموع کل درآمد</span>
          <CreditCard :size="18" class="text-emerald-500" />
        </div>
        <div class="text-xl font-bold font-mono text-emerald-500">
          {{ Number(Math.floor(stats.totalRevenue / 10)).toLocaleString('fa-IR') }} <span class="text-xs font-sans text-muted-foreground">تومان</span>
        </div>
        <div class="text-[11px] text-muted-foreground font-mono">
          {{ Number(stats.totalRevenue).toLocaleString('fa-IR') }} ریال
        </div>
      </div>

      <!-- Successful Transactions -->
      <div class="p-4 rounded-xl border border-border bg-card shadow-sm space-y-1">
        <div class="flex items-center justify-between text-muted-foreground text-xs font-medium">
          <span>تراکنش‌های موفق</span>
          <CheckCircle2 :size="18" class="text-primary" />
        </div>
        <div class="text-xl font-bold font-mono text-foreground">
          {{ Number(stats.successfulCount).toLocaleString('fa-IR') }} <span class="text-xs font-sans text-muted-foreground">تراکنش</span>
        </div>
        <div class="text-[11px] text-muted-foreground">
          از مجموع {{ Number(payments.length).toLocaleString('fa-IR') }} تراکنش ثبت‌شده
        </div>
      </div>

      <!-- Subscriptions Breakdown -->
      <div class="p-4 rounded-xl border border-border bg-card shadow-sm space-y-1 sm:col-span-2 lg:col-span-1">
        <div class="flex items-center justify-between text-muted-foreground text-xs font-medium">
          <span>تعداد اشتراک‌ها به تفکیک طرح</span>
          <UserCheck :size="18" class="text-amber-500" />
        </div>
        <div class="flex flex-wrap gap-2 pt-1">
          <div
            v-for="item in stats.subscriptionsByPlan"
            :key="item.planId || item.planName"
            class="px-2 py-1 rounded-lg border border-border/60 bg-accent/40 text-xs flex items-center gap-1.5"
          >
            <span class="font-medium text-foreground">{{ item.planName }}:</span>
            <span class="font-bold font-mono text-primary">{{ Number(item.count).toLocaleString('fa-IR') }}</span>
          </div>
          <div v-if="stats.subscriptionsByPlan.length === 0" class="text-xs text-muted-foreground">
            اشتراک فعالی ثبت نشده است.
          </div>
        </div>
      </div>
    </div>

    <div class="mb-4 flex flex-col sm:flex-row gap-3">
      <div class="search-field-wrapper flex-1 flex gap-2">
        <select
          v-model="searchField"
          class="search-field-select px-3 py-2 bg-card border border-border rounded-lg text-sm text-foreground"
          @change="handleSearch(searchQuery, searchField)"
        >
          <option value="user.displayName">نام کاربر</option>
          <option value="user.email">ایمیل کاربر</option>
          <option value="plan.name">نام طرح</option>
          <option value="status">وضعیت پرداخت</option>
          <option value="refId">کد پیگیری</option>
          <option value="authority">شناسه مرجع</option>
        </select>
        <div class="search-input-box flex-1 relative">
          <input
            v-model="searchQuery"
            type="text"
            class="search-text-input w-full pr-9 pl-3 py-2 bg-card border border-border rounded-lg text-sm text-foreground"
            placeholder="جستجو در تراکنش‌ها..."
            @input="handleSearch(searchQuery, searchField)"
          />
        </div>
      </div>
    </div>

    <!-- Table -->
    <div class="border border-border rounded-xl bg-card overflow-hidden">
      <AdminTableSkeleton v-if="isLoading" :columns="columns.length" :rows="4" />
      <AdminTable
        v-else
        :columns="columns"
        :items="payments"
        paginated
        :page-size="limit"
        :page-sizes="[10, 25, 50]"
        empty-text="هیچ تراکنشی ثبت نشده است."
        @update:page="handlePageChange"
        @update:pageSize="handlePageSizeChange"
      >
        <template #row="{ item: payment }">
          <!-- User column -->
          <td data-label="کاربر">
            <div class="flex flex-col text-right">
              <span class="font-bold text-sm text-foreground">{{ payment.user?.displayName || 'بدون نام' }}</span>
              <span class="text-xs text-muted-foreground font-mono" dir="ltr">{{ payment.user?.email || payment.userId }}</span>
            </div>
          </td>

          <!-- Plan column -->
          <td data-label="طرح اشتراک" class="text-center">
            <span class="font-semibold text-xs text-primary">{{ payment.plan?.name || 'پلن اشتراک' }}</span>
          </td>

          <!-- Amount column -->
          <td data-label="مبلغ" class="text-center">
            <span class="font-bold text-xs font-mono">
              {{ Number(payment.amount).toLocaleString('fa-IR') }} ریال
            </span>
          </td>

          <!-- Status column -->
          <td data-label="وضعیت" class="text-center">
            <span
              v-if="payment.status === 'SUCCESS'"
              class="px-2 py-0.5 text-[11px] font-bold rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
            >
              موفق
            </span>
            <span
              v-else-if="payment.status === 'PENDING'"
              class="px-2 py-0.5 text-[11px] font-medium rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20"
            >
              در انتظار
            </span>
            <span
              v-else-if="payment.status === 'CANCELLED'"
              class="px-2 py-0.5 text-[11px] font-medium rounded-full bg-slate-500/10 text-slate-400 border border-slate-500/20"
            >
              لغو شده
            </span>
            <span
              v-else-if="payment.status === 'FAILED'"
              class="px-2 py-0.5 text-[11px] font-medium rounded-full bg-destructive/10 text-destructive border border-destructive/20"
            >
              ناموفق
            </span>
            <span v-else class="text-xs text-muted-foreground">{{ payment.status }}</span>
          </td>

          <!-- Ref ID column -->
          <td data-label="شناسه پیگیری / مرجع" class="text-center">
            <div class="flex flex-col items-center">
              <span v-if="payment.refId" class="text-xs font-mono font-medium" dir="ltr">{{ payment.refId }}</span>
              <span v-else-if="payment.authority" class="text-[11px] text-muted-foreground font-mono" dir="ltr">{{ payment.authority }}</span>
              <span v-else class="text-xs text-muted-foreground">-</span>
            </div>
          </td>

          <!-- Date column -->
          <td data-label="تاریخ" class="text-center">
            <span class="text-xs text-muted-foreground">{{ formatDate(payment.createdAt) }}</span>
          </td>
        </template>
      </AdminTable>
    </div>
  </div>
</template>
