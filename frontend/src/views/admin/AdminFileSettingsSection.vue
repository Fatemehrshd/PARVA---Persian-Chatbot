<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { HardDrive, Save, RotateCcw, ShieldCheck, Clock } from '@lucide/vue'
import BaseButton from '../../components/ui/BaseButton.vue'
import { adminService } from '../../services/admin.service'
import { useUiStore } from '../../stores/ui'

const uiStore = useUiStore()
const isLoading = ref(false)
const isSaving = ref(false)
const errorMessage = ref('')

const form = ref({
  fileMaxSizeMb: 20,
  fileMaxTotalSizeMb: 50,
  fileMaxCount: 5,
  excelMaxRows: 5000,
  fileProcessingTimeoutSec: 120,
})

async function loadSettings() {
  isLoading.value = true
  errorMessage.value = ''
  try {
    const data = await adminService.getSettings()
    if (data) {
      form.value = {
        fileMaxSizeMb: data.fileMaxSizeMb || 20,
        fileMaxTotalSizeMb: data.fileMaxTotalSizeMb || 50,
        fileMaxCount: data.fileMaxCount || 5,
        excelMaxRows: data.excelMaxRows || 5000,
        fileProcessingTimeoutSec: data.fileProcessingTimeoutSec || 120,
      }
    }
  } catch (err: any) {
    errorMessage.value = err?.message || 'خطا در دریافت تنظیمات آپلود فایل'
  } finally {
    isLoading.value = false
  }
}

async function handleSave() {
  isSaving.value = true
  errorMessage.value = ''
  try {
    await adminService.updateSettings({
      fileMaxSizeMb: Number(form.value.fileMaxSizeMb),
      fileMaxTotalSizeMb: Number(form.value.fileMaxTotalSizeMb),
      fileMaxCount: Number(form.value.fileMaxCount),
      excelMaxRows: Number(form.value.excelMaxRows),
      fileProcessingTimeoutSec: Number(form.value.fileProcessingTimeoutSec),
    })
    uiStore.showToast('تنظیمات آپلود فایل با موفقیت در سامانه ذخیره شد.', 'success')
  } catch (err: any) {
    uiStore.showToast(err?.message || 'خطا در ذخیره تنظیمات آپلود فایل', 'error')
  } finally {
    isSaving.value = false
  }
}

function resetDefaults() {
  form.value = {
    fileMaxSizeMb: 20,
    fileMaxTotalSizeMb: 50,
    fileMaxCount: 5,
    excelMaxRows: 5000,
    fileProcessingTimeoutSec: 120,
  }
}

onMounted(loadSettings)
</script>

<template>
  <div class="file-settings-section space-y-6 max-w-4xl">
    <div class="section-toolbar flex items-center justify-between">
      <div>
        <h3 class="text-base font-bold text-foreground">تنظیمات و محدودیت‌های آپلود فایل (File Upload Policies)</h3>
        <p class="text-xs text-muted-foreground mt-0.5">پیکربندی سقف حجم، تعداد مجاز و تایم‌اوت پردازش پس‌زمینه اسناد کاربران</p>
      </div>
    </div>

    <div v-if="errorMessage" class="error-banner p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive">
      {{ errorMessage }}
    </div>

    <form class="space-y-6" @submit.prevent="handleSave">
      <!-- Card 1: Upload Limits -->
      <div class="settings-card p-5 rounded-2xl border border-border bg-card shadow-sm space-y-4">
        <div class="flex items-center gap-2.5 pb-3 border-b border-border">
          <div class="p-2 rounded-lg bg-primary/10 text-primary">
            <HardDrive :size="18" />
          </div>
          <div>
            <h4 class="text-sm font-bold text-foreground">محدودیت‌های حجم و تعداد</h4>
            <span class="text-xs text-muted-foreground">کنترل مصرف پهنای باند و ذخیره‌سازی ابری</span>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <label class="space-y-1.5">
            <span class="font-medium text-foreground block">حداکثر حجم هر فایل (مگابایت)</span>
            <input
              v-model.number="form.fileMaxSizeMb"
              type="number"
              min="1"
              max="200"
              required
              class="w-full p-2.5 rounded-lg border border-border bg-background text-foreground font-mono outline-none focus:border-primary"
              :disabled="isSaving"
            />
            <span class="text-[11px] text-muted-foreground block">پیش‌فرض: ۲۰ مگابایت</span>
          </label>

          <label class="space-y-1.5">
            <span class="font-medium text-foreground block">حداکثر مجموع حجم در هر پیام (مگابایت)</span>
            <input
              v-model.number="form.fileMaxTotalSizeMb"
              type="number"
              min="1"
              max="500"
              required
              class="w-full p-2.5 rounded-lg border border-border bg-background text-foreground font-mono outline-none focus:border-primary"
              :disabled="isSaving"
            />
            <span class="text-[11px] text-muted-foreground block">پیش‌فرض: ۵۰ مگابایت</span>
          </label>

          <label class="space-y-1.5">
            <span class="font-medium text-foreground block">حداکثر تعداد فایل در هر ارسال</span>
            <input
              v-model.number="form.fileMaxCount"
              type="number"
              min="1"
              max="20"
              required
              class="w-full p-2.5 rounded-lg border border-border bg-background text-foreground font-mono outline-none focus:border-primary"
              :disabled="isSaving"
            />
            <span class="text-[11px] text-muted-foreground block">پیش‌فرض: ۵ فایل هم‌زمان</span>
          </label>
        </div>
      </div>

      <!-- Card 2: Document Processing & Timeouts -->
      <div class="settings-card p-5 rounded-2xl border border-border bg-card shadow-sm space-y-4">
        <div class="flex items-center gap-2.5 pb-3 border-b border-border">
          <div class="p-2 rounded-lg bg-blue-500/10 text-blue-500">
            <Clock :size="18" />
          </div>
          <div>
            <h4 class="text-sm font-bold text-foreground">تنظیمات پردازش اسناد و جداول اکسل</h4>
            <span class="text-xs text-muted-foreground">کنترل مصرف CPU و حافظه رم در فرآیند استخراج متون</span>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <label class="space-y-1.5">
            <span class="font-medium text-foreground block">سقف سطرهای قابل پردازش اکسل (CSV / XLSX)</span>
            <input
              v-model.number="form.excelMaxRows"
              type="number"
              min="100"
              max="50000"
              step="500"
              required
              class="w-full p-2.5 rounded-lg border border-border bg-background text-foreground font-mono outline-none focus:border-primary"
              :disabled="isSaving"
            />
            <span class="text-[11px] text-muted-foreground block">سطرهای فراتر از این سقف در متن پیام خلاصه می‌شوند.</span>
          </label>

          <label class="space-y-1.5">
            <span class="font-medium text-foreground block">مهلت زمانی پردازش فایل (تایم‌اوت به ثانیه)</span>
            <input
              v-model.number="form.fileProcessingTimeoutSec"
              type="number"
              min="10"
              max="600"
              required
              class="w-full p-2.5 rounded-lg border border-border bg-background text-foreground font-mono outline-none focus:border-primary"
              :disabled="isSaving"
            />
            <span class="text-[11px] text-muted-foreground block">پس از این مدت در صورت عدم اتمام، وضعیت خطا ثبت می‌شود.</span>
          </label>
        </div>
      </div>

      <!-- Card 3: Storage Engine & Cleanup Policy -->
      <div class="settings-card p-5 rounded-2xl border border-border bg-card shadow-sm space-y-4">
        <div class="flex items-center gap-2.5 pb-3 border-b border-border">
          <div class="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
            <ShieldCheck :size="18" />
          </div>
          <div>
            <h4 class="text-sm font-bold text-foreground">خط‌مشی ماندگاری فایل‌ها و پاکسازی امن</h4>
            <span class="text-xs text-muted-foreground">قوانین ذخیره‌سازی فایل‌های چت و فایل‌های موقت</span>
          </div>
        </div>

        <div class="space-y-3 text-xs leading-relaxed text-muted-foreground">
          <div class="p-3.5 rounded-xl bg-secondary/60 border border-border space-y-1.5">
            <strong class="text-foreground block text-xs font-semibold">۱. فایل‌های متصل به گفتگو (دائمی و ماندگار):</strong>
            <p>
              هر فایلی که کاربر در صفحه چت ارسال کند (حتی بدون نوشتن متن پیام)، به پیام کاربر پیوند خورده و به صورت دائمی در ذخیره‌ساز ابری (MinIO S3) نگهداری می‌شود و مشمول حذف خودکار نمی‌گردد.
            </p>
          </div>

          <div class="p-3.5 rounded-xl bg-secondary/60 border border-border space-y-1.5">
            <strong class="text-foreground block text-xs font-semibold">۲. پاکسازی خودکار فایل‌های رها شده (۴۸ ساعته):</strong>
            <p>
              تنها در صورتی که کاربری فایلی را آپلود کند اما پنجره چت را بدون ارسال پیام ببندد، فایل به عنوان «معلق و بی‌صاحب» علامت‌گذاری شده و پس از ۴۸ ساعت توسط کران‌جاب پاکسازی امن حذف می‌شود تا دیسک هدر نرود.
            </p>
          </div>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="form-actions flex items-center justify-between pt-2">
        <BaseButton variant="ghost" size="md" type="button" @click="resetDefaults" :disabled="isSaving">
          <RotateCcw :size="14" />
          <span>بازنشانی به مقادیر پیش‌فرض</span>
        </BaseButton>

        <BaseButton variant="primary" size="md" type="submit" :loading="isSaving" :disabled="isSaving">
          <Save :size="15" />
          <span>ذخیره تغییرات تنظیمات فایل</span>
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
