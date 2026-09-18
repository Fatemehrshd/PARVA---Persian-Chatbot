<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Sparkles, Save, Coins, Globe } from '@lucide/vue'
import BaseButton from '../../components/ui/BaseButton.vue'
import { adminService } from '../../services/admin.service'
import { useUiStore } from '../../stores/ui'

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
              v-model.number="form.globalTokenLimit"
              type="number"
              min="0"
              required
              class="w-full p-2.5 rounded-lg border border-border bg-background text-foreground font-mono outline-none focus:border-primary"
              :disabled="isSaving"
            />
            <span class="text-[11px] text-muted-foreground block">اگر کاربری سقف اختصاصی نداشته باشد، این سقف اعمال می‌شود.</span>
          </label>

          <label class="space-y-1.5">
            <span class="font-medium text-foreground block">نرخ هر ۱۰۰۰ توکن به دلار ($ USD)</span>
            <input
              v-model.number="form.tokenRatePer1000"
              type="number"
              min="0.1"
              step="0.1"
              required
              class="w-full p-2.5 rounded-lg border border-border bg-background text-foreground font-mono outline-none focus:border-primary"
              :disabled="isSaving"
            />
            <span class="text-[11px] text-muted-foreground block">برای همگام‌سازی مبالغ شارژ دلاری و سقف توکن در پنل ادمین.</span>
          </label>
        </div>
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
            <span>باقی‌مانده: {{ webSearchRemaining.toLocaleString() }} از {{ webSearchQuota.toLocaleString() }} کوئری</span>
            <span v-if="webSearchLow" class="font-medium text-amber-600 dark:text-amber-400">اعتبار رو به اتمام است</span>
          </div>
          <div class="h-2 overflow-hidden rounded-full bg-muted">
            <div class="h-full rounded-full bg-emerald-500 transition-all" :style="{ width: webSearchPercent + '%' }"></div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-2">
            <label class="space-y-1.5">
              <span class="font-medium text-foreground block">سقف کل اعتبار وب‌سرچ</span>
              <input
                v-model.number="form.webSearchQuotaTotal"
                type="number"
                min="0"
                class="w-full p-2.5 rounded-lg border border-border bg-background text-foreground font-mono outline-none focus:border-primary"
                :disabled="isSaving"
              />
            </label>
            <label class="space-y-1.5">
              <span class="font-medium text-foreground block">اعتبار مصرف‌شده</span>
              <input
                v-model.number="form.webSearchUsedCredits"
                type="number"
                min="0"
                class="w-full p-2.5 rounded-lg border border-border bg-background text-foreground font-mono outline-none focus:border-primary"
                :disabled="isSaving"
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
  </div>
</template>

<style scoped>
.mono {
  font-family: var(--font-mono, monospace);
  direction: ltr;
}
</style>
