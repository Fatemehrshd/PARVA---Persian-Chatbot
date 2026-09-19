<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Sparkles, Save, Coins, Globe, Users, Edit } from '@lucide/vue'
import BaseButton from '../../components/ui/BaseButton.vue'
import AdminTable from '../../components/admin/AdminTable.vue'
import ModelAccessBadge from '../../components/admin/ModelAccessBadge.vue'
import RoleTokenLimitModal from '../../components/admin/modals/RoleTokenLimitModal.vue'
import { adminService } from '../../services/admin.service'
import { useUiStore } from '../../stores/ui'
import { normalizeNumericInput, numericInputValue } from '../../utils/numberInput'
import type { ModelAccessLevel, ModelAccessMap } from '../../types'

const uiStore = useUiStore()
const isLoading = ref(false)
const isSaving = ref(false)
const errorMessage = ref('')

const form = ref({
  globalTokenLimit: 0,
  tokenRatePer1000: 10,
  systemPrompt: '',
  webSearchQuotaTotal: 2500,
  webSearchUsedCredits: 0,
})

// سقف توکن به ازای هر نقش (داینامیک — نقش‌های آینده هم خودکار نمایش داده می‌شوند)
const roles = ref<string[]>([])
const roleTokenLimits = ref<Record<string, number>>({})
const roleQuotas = ref<Record<string, { tokenLimit: number | null; messageLimit: number | null; resetHours: number | null }>>({})
const taskMultipliers = ref<Record<string, number>>({})
/** نقش → سطوح دسترسی مدل مجاز؛ admin همیشه همه سطوح را دارد. */
const modelAccess = ref<ModelAccessMap>({})

const isRoleModalOpen = ref(false)
const isSavingRole = ref(false)
const editingRole = ref<{ role: string; label: string; limit: number | null; messageLimit: number | null; resetHours: number | null; commercialAccess: boolean } | null>(null)

const roleColumns = [
  { key: 'role', label: 'نقش' },
  { key: 'limit', label: 'سقف توکن', align: 'center' as const },
  { key: 'messageLimit', label: 'حداکثر پیام در دوره', align: 'center' as const },
  { key: 'resetHours', label: 'دوره ریست', align: 'center' as const },
  { key: 'modelAccess', label: 'دسترسی مدل تجاری', align: 'center' as const },
  { key: 'actions', label: 'عملیات', align: 'center' as const },
]

function roleLabel(role: string): string {
  if (role === 'admin') return 'مدیر سیستم'
  if (role === 'user') return 'کاربر عادی'
  return role
}

interface RoleRow {
  role: string
  label: string
  limit: number | null
  messageLimit: number | null
  resetHours: number | null
}

const roleRows = computed<RoleRow[]>(() =>
  roles.value.map((role) => ({
    role,
    label: roleLabel(role),
    limit: roleQuotas.value[role]?.tokenLimit ?? roleTokenLimits.value[role] ?? null,
    messageLimit: roleQuotas.value[role]?.messageLimit ?? null,
    resetHours: roleQuotas.value[role]?.resetHours ?? 6,
  }))
)

function formatRoleLimit(limit: number | null): string {
  if (limit === null || limit === undefined || limit <= 0) return 'سقف سراسری'
  return `${Number(limit).toLocaleString('fa-IR')} توکن`
}

function formatMessageLimit(limit: number | null): string {
  if (limit === null || limit === undefined || limit <= 0) return 'نامحدود'
  return Number(limit).toLocaleString('fa-IR')
}

function formatResetHours(hours: number | null): string {
  if (hours === null || hours === undefined || hours <= 0) return 'بدون ریست'
  return `هر ${Number(hours).toLocaleString('fa-IR')} ساعت`
}

function formatPersianNumber(value: number, fractionDigits = 0): string {
  return value.toLocaleString('fa-IR', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })
}

function effectiveMultiplierRate(type: string): string {
  const rate = (Number(form.value.tokenRatePer1000) || 10) * (Number(taskMultipliers.value[type]) || 1)
  return formatPersianNumber(rate, 2)
}

function normalizeMultiplierInput(value: string): number | undefined {
  const normalized = normalizeNumericInput(value).trim()
  if (!normalized) return undefined
  const parsed = Number(normalized)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

type NumericFormField = 'globalTokenLimit' | 'tokenRatePer1000' | 'webSearchQuotaTotal' | 'webSearchUsedCredits'

function updateNumberField(field: NumericFormField, event: Event) {
  const value = numericInputValue((event.target as HTMLInputElement).value)
  form.value[field] = value ?? 0
}

function updateTaskMultiplier(type: string, event: Event) {
  const input = event.target as HTMLInputElement
  const value = normalizeMultiplierInput(input.value)
  if (value === undefined) delete taskMultipliers.value[type]
  else taskMultipliers.value[type] = value
}

function openRoleModal(row: RoleRow) {
  editingRole.value = {
    ...row,
    commercialAccess: (modelAccess.value[row.role] || []).includes('commercial'),
  }
  isRoleModalOpen.value = true
}

/** نمایش سطح دسترسی نقش در جدول: admin همه، بقیه بر اساس تنظیمات. */
function formatModelAccess(role: string): string {
  if (role === 'admin') return 'کامل'
  return (modelAccess.value[role] || []).includes('commercial') ? 'عمومی + تجاری' : 'عمومی'
}

async function handleSaveRoleLimit(data: {
  role: string
  quota: { tokenLimit: number | null; messageLimit: number | null; resetHours: number | null }
  commercialAccess?: boolean
}) {
  if (!editingRole.value) return
  isSavingRole.value = true
  const role = data.role
  const nextAccess: ModelAccessLevel[] = data.commercialAccess
    ? ['public', 'commercial']
    : ['public']
  // Optimistic: update the table before the request resolves, revert on failure.
  const previousAccess = modelAccess.value[role]
  const previousQuota = roleQuotas.value[role]
  modelAccess.value = { ...modelAccess.value, [role]: nextAccess }
  roleQuotas.value = { ...roleQuotas.value, [role]: { ...data.quota } }
  try {
    await adminService.updateSettings({
      roleQuotas: { [role]: data.quota },
      modelAccess: { [role]: nextAccess },
    })
    uiStore.showToast(`تنظیمات نقش «${editingRole.value.label}» با موفقیت بهروزرسانی شد.`, 'success')
    isRoleModalOpen.value = false
    await loadSettings()
  } catch (err: any) {
    if (previousAccess === undefined) delete modelAccess.value[role]
    else modelAccess.value = { ...modelAccess.value, [role]: previousAccess }
    if (previousQuota === undefined) delete roleQuotas.value[role]
    else roleQuotas.value = { ...roleQuotas.value, [role]: previousQuota }
    uiStore.showToast(err?.message || 'خطا در ذخیره تنظیمات نقش', 'error')
  } finally {
    isSavingRole.value = false
  }
}

const webSearchQuota = computed(() => Number(form.value.webSearchQuotaTotal) || 2500)
const webSearchUsed = computed(() => Math.max(0, Number(form.value.webSearchUsedCredits) || 0))
const webSearchRemaining = computed(() => Math.max(0, webSearchQuota.value - webSearchUsed.value))
const webSearchPercent = computed(() =>
  webSearchQuota.value > 0 ? Math.round((webSearchRemaining.value / webSearchQuota.value) * 100) : 0
)
const webSearchLow = computed(
  () => webSearchQuota.value > 0 && webSearchRemaining.value / webSearchQuota.value < 0.1
)

async function loadSettings() {
  isLoading.value = true
  errorMessage.value = ''
  try {
    const data = await adminService.getSettings()
    if (data) {
      form.value = {
        globalTokenLimit: data.globalTokenLimit || 0,
        tokenRatePer1000: data.tokenRatePer1000 || 10,
        systemPrompt: data.systemPrompt || '',
        webSearchQuotaTotal: (data as any).webSearchUsage?.total ?? 2500,
        webSearchUsedCredits: (data as any).webSearchUsage?.used ?? 0,
      }
      roles.value = ((data as any).roles as string[]) || ['user', 'admin']
      roleTokenLimits.value = ((data as any).roleTokenLimits as Record<string, number>) || {}
      roleQuotas.value = ((data as any).roleQuotas as typeof roleQuotas.value) || {}
      taskMultipliers.value = ((data as any).taskMultipliers as Record<string, number>) || {}
      modelAccess.value = ((data as any).modelAccess as ModelAccessMap) || {}
    }
  } catch (err: any) {
    errorMessage.value = err?.message || 'خطا در بارگذاری تنظیمات سیستم'
  } finally {
    isLoading.value = false
  }
}

async function handleSave() {
  isSaving.value = true
  errorMessage.value = ''
  try {
    await adminService.updateSettings({
      globalTokenLimit: Number(form.value.globalTokenLimit),
      tokenRatePer1000: Number(form.value.tokenRatePer1000),
      systemPrompt: form.value.systemPrompt.trim(),
      webSearchQuotaTotal: Number(form.value.webSearchQuotaTotal) || 2500,
      webSearchUsedCredits: Math.max(0, Number(form.value.webSearchUsedCredits) || 0),
      taskMultipliers: taskMultipliers.value,
    })
    uiStore.showToast('تنظیمات پرامپت، وب‌سرچ و سقف سراسری با موفقیت به‌روزرسانی شد.', 'success')
  } catch (err: any) {
    uiStore.showToast(err?.message || 'خطا در ذخیره تنظیمات', 'error')
  } finally {
    isSaving.value = false
  }
}

onMounted(loadSettings)
</script>

<template>
  <div class="prompts-section space-y-6 max-w-4xl">
    <div class="section-toolbar flex items-center justify-between">
      <div>
        <h3 class="text-base font-bold text-foreground">دستورالعمل سیستم و سقف سراسری توکن (System Policies)</h3>
        <p class="text-xs text-muted-foreground mt-0.5">پیکربندی هویت پیش‌فرض مدل‌ها، سقف مصرف عمومی کاربران و نرخ محاسبه اعتبار دلاری</p>
      </div>
    </div>

    <div v-if="errorMessage" class="error-banner p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive">
      {{ errorMessage }}
    </div>

    <form class="space-y-6" @submit.prevent="handleSave">
      <!-- Card 1: Token Quota & Dollar Rate -->
      <div class="settings-card p-5 rounded-2xl border border-border bg-card shadow-sm space-y-4">
        <div class="flex items-center gap-2.5 pb-3 border-b border-border">
          <div class="p-2 rounded-lg bg-primary/10 text-primary">
            <Coins :size="18" />
          </div>
          <div>
            <h4 class="text-sm font-bold text-foreground">سقف سراسری و نرخ برابری توکن</h4>
            <span class="text-xs text-muted-foreground">مدیریت مالی و سیاست‌های کنترل سهمیه کاربران عادی</span>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <label class="space-y-1.5">
            <span class="font-medium text-foreground block">سقف سراسری توکن برای کاربران عادی (0 = نامحدود)</span>
            <input
              :value="form.globalTokenLimit"
              type="text"
              inputmode="numeric"
              min="0"
              required
              class="w-full p-2.5 rounded-lg border border-border bg-background text-foreground font-mono outline-none focus:border-primary"
              :disabled="isSaving"
              @input="updateNumberField('globalTokenLimit', $event)"
            />
            <span class="text-[11px] text-muted-foreground block">اگر کاربری سقف اختصاصی نداشته باشد، ابتدا سقف نقش او و در غیر این صورت این سقف سراسری اعمال می‌شود.</span>
          </label>

          <label class="space-y-1.5">
            <span class="font-medium text-foreground block">نرخ هر ۱۰۰۰ توکن به دلار ($ USD)</span>
            <input
              :value="form.tokenRatePer1000"
              type="text"
              inputmode="decimal"
              min="0.1"
              step="0.1"
              required
              class="w-full p-2.5 rounded-lg border border-border bg-background text-foreground font-mono outline-none focus:border-primary"
              :disabled="isSaving"
              @input="updateNumberField('tokenRatePer1000', $event)"
            />
            <span class="text-[11px] text-muted-foreground block">برای همگام‌سازی مبالغ شارژ دلاری و سقف توکن در پنل ادمین.</span>
          </label>
        </div>
      </div>

      <!-- Card: Per-Role Token Limits -->
      <div class="settings-card p-5 rounded-2xl border border-border bg-card shadow-sm space-y-4">
        <div class="flex items-center gap-2.5 pb-3 border-b border-border">
          <div class="p-2 rounded-lg bg-rose-500/10 text-rose-500">
            <Coins :size="18" />
          </div>
          <div>
            <h4 class="text-sm font-bold text-foreground">ضریب هزینه بر اساس نوع کار</h4>
            <span class="text-xs text-muted-foreground">نرخ مؤثر هر نوع کار از نرخ عادی و ضریب آن محاسبه می‌شود.</span>
          </div>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <label v-for="item in [{ key: 'image', label: 'کار با تصویر' }, { key: 'document', label: 'کار با سند' }, { key: 'thinking', label: 'تفکر عمیق' }]" :key="item.key" class="space-y-1.5">
            <span class="font-medium text-foreground block">{{ item.label }}</span>
            <input :value="taskMultipliers[item.key] ?? ''" type="text" inputmode="decimal" autocomplete="off" placeholder="۱.۰" class="w-full p-2.5 rounded-lg border border-border bg-background text-foreground font-mono outline-none focus:border-primary" :disabled="isSaving" @input="updateTaskMultiplier(item.key, $event)" />
            <span class="text-[11px] text-muted-foreground block">نرخ مؤثر: ${{ effectiveMultiplierRate(item.key) }} / ۱۰۰۰ توکن</span>
          </label>
        </div>
      </div>

      <!-- Card: Per-Role Token Limits -->
      <div class="settings-card p-5 rounded-2xl border border-border bg-card shadow-sm space-y-4">
        <div class="flex items-center gap-2.5 pb-3 border-b border-border">
          <div class="p-2 rounded-lg bg-sky-500/10 text-sky-500">
            <Users :size="18" />
          </div>
          <div>
            <h4 class="text-sm font-bold text-foreground">سقف توکن به ازای نقش کاربر</h4>
            <span class="text-xs text-muted-foreground">تعیین سقف مصرف سراسری برای همه‌ی کاربران هر نقش — کاربر با سقف اختصاصی همیشه از سقف خودش پیروی می‌کند</span>
          </div>
        </div>

        <AdminTable :columns="roleColumns" :items="roleRows" emptyText="نقشی برای نمایش یافت نشد.">
          <template #row="{ item }">
            <!-- نقش -->
            <td data-label="نقش">
              <span class="tag text-xs px-2.5 py-1 rounded-md font-medium bg-muted text-muted-foreground border border-border">
                {{ item.label }}
              </span>
            </td>

            <!-- سقف توکن -->
            <td data-label="سقف توکن" class="mono font-semibold text-xs text-foreground text-center">
              {{ formatRoleLimit(item.limit) }}
            </td>

            <!-- حداکثر پیام در دوره -->
            <td data-label="حداکثر پیام در دوره" class="mono font-semibold text-xs text-foreground text-center">
              {{ formatMessageLimit(item.messageLimit) }}
            </td>

            <!-- دوره ریست -->
            <td data-label="دوره ریست" class="mono font-semibold text-xs text-foreground text-center">
              {{ formatResetHours(item.resetHours) }}
            </td>

            <!-- دسترسی مدل تجاری -->
            <td data-label="دسترسی مدل تجاری" class="text-center">
              <ModelAccessBadge :level="item.role === 'admin' ? 'private' : (modelAccess[item.role] || []).includes('commercial') ? 'commercial' : 'public'">
                {{ formatModelAccess(item.role) }}
              </ModelAccessBadge>
            </td>

            <!-- عملیات -->
            <td data-label="عملیات" class="text-center">
              <BaseButton variant="ghost" size="sm" @click="openRoleModal(item)" title="ویرایش سقف توکن">
                <Edit :size="14" />
              </BaseButton>
            </td>
          </template>
        </AdminTable>
      </div>

      <!-- Card: Serper Web Search Quota -->
      <div class="settings-card p-5 rounded-2xl border border-border bg-card shadow-sm space-y-4">
        <div class="flex items-center gap-2.5 pb-3 border-b border-border">
          <div class="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
            <Globe :size="18" />
          </div>
          <div>
            <h4 class="text-sm font-bold text-foreground">اعتبار جستجوی وب (Serper API)</h4>
            <span class="text-xs text-muted-foreground">مدیریت سهمیه و رصد اعتبار سرویس جستجوی وب زنده</span>
          </div>
        </div>

        <div class="space-y-3">
          <div class="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>باقی‌مانده: {{ formatPersianNumber(webSearchRemaining) }} از {{ formatPersianNumber(webSearchQuota) }} کوئری</span>
            <span v-if="webSearchLow" class="font-medium text-amber-600 dark:text-amber-400">اعتبار رو به اتمام است</span>
          </div>
          <div class="h-2 overflow-hidden rounded-full bg-muted">
            <div class="h-full rounded-full bg-emerald-500 transition-all" :style="{ width: webSearchPercent + '%' }"></div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-2">
            <label class="space-y-1.5">
              <span class="font-medium text-foreground block">سقف کل اعتبار وب‌سرچ</span>
              <input
                :value="form.webSearchQuotaTotal"
                type="text"
                inputmode="numeric"
                min="0"
                class="w-full p-2.5 rounded-lg border border-border bg-background text-foreground font-mono outline-none focus:border-primary"
                :disabled="isSaving"
                @input="updateNumberField('webSearchQuotaTotal', $event)"
              />
            </label>
            <label class="space-y-1.5">
              <span class="font-medium text-foreground block">اعتبار مصرف‌شده</span>
              <input
                :value="form.webSearchUsedCredits"
                type="text"
                inputmode="numeric"
                min="0"
                class="w-full p-2.5 rounded-lg border border-border bg-background text-foreground font-mono outline-none focus:border-primary"
                :disabled="isSaving"
                @input="updateNumberField('webSearchUsedCredits', $event)"
              />
            </label>
          </div>
        </div>
      </div>

      <!-- Card 2: System Prompt -->
      <div class="settings-card p-5 rounded-2xl border border-border bg-card shadow-sm space-y-4">
        <div class="flex items-center gap-2.5 pb-3 border-b border-border">
          <div class="p-2 rounded-lg bg-amber-500/10 text-amber-500">
            <Sparkles :size="18" />
          </div>
          <div>
            <h4 class="text-sm font-bold text-foreground">دستورالعمل سیستم (System Prompt)</h4>
            <span class="text-xs text-muted-foreground">شخصیت، لحن پاسخ‌دهی و قوانین حاکم بر دستیار هوش مصنوعی</span>
          </div>
        </div>

        <label class="space-y-1.5 block text-xs">
          <textarea
            v-model="form.systemPrompt"
            rows="7"
            class="w-full p-3.5 rounded-xl border border-border bg-background text-foreground font-sans leading-relaxed outline-none focus:border-primary"
            placeholder="دستورالعمل‌های حاکم بر رفتار هوش مصنوعی را به زبان فارسی وارد کنید..."
            :disabled="isSaving"
          />
          <span class="text-[11px] text-muted-foreground block">
            این دستورالعمل به عنوان اولین پیام سیستمی (System Instruction) در ابتدای تمام گفتگوها تزریق می‌گردد.
          </span>
        </label>
      </div>

      <!-- Submit Button -->
      <div class="form-actions flex items-center justify-end pt-2">
        <BaseButton variant="primary" size="md" type="submit" :loading="isSaving" :disabled="isSaving">
          <Save :size="15" />
          <span>ذخیره پرامپت و سقف سراسری</span>
        </BaseButton>
      </div>
    </form>

    <!-- Role Token Limit Edit Modal -->
    <RoleTokenLimitModal
      :open="isRoleModalOpen"
      :role="editingRole?.role || ''"
      :roleLabel="editingRole?.label || ''"
      :currentLimit="editingRole?.limit ?? null"
      :currentMessageLimit="editingRole?.messageLimit ?? null"
      :currentResetHours="editingRole?.resetHours ?? 6"
      :commercialAccess="editingRole?.commercialAccess ?? false"
      :isCommercialAccessLocked="editingRole?.role === 'admin'"
      :tokenRatePer1000="Number(form.tokenRatePer1000) || 10"
      :isSaving="isSavingRole"
      @close="isRoleModalOpen = false"
      @save="handleSaveRoleLimit"
    />
  </div>
</template>

<style scoped>
.mono {
  font-family: var(--font-mono, monospace);
  direction: ltr;
}
</style>
