<script setup lang="ts">
import { ref } from 'vue'
import { useUiStore } from '../../stores/ui'

defineProps<{
  isOpen: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'confirm'): void
}>()

const uiStore = useUiStore()
const isLoggingOut = ref(false)

async function handleConfirm() {
  isLoggingOut.value = true
  try {
    emit('confirm')
  } finally {
    isLoggingOut.value = false
  }
}
</script>

<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
    @click.self="emit('close')"
    :dir="uiStore.direction"
  >
    <div class="w-full max-w-md bg-card border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col scale-in-95 duration-200">
      <!-- Header -->
      <div class="px-6 py-4 border-b border-border flex items-center justify-between bg-destructive/10">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-full bg-destructive/20 text-destructive flex items-center justify-center flex-shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </div>
          <h3 class="text-base font-semibold text-foreground">
            خروج از حساب کاربری
          </h3>
        </div>

        <button
          @click="emit('close')"
          class="text-muted-foreground hover:text-foreground hover:bg-secondary p-1.5 rounded-md transition-colors"
          aria-label="بستن"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <!-- Body -->
      <div class="p-6 space-y-2">
        <p class="text-sm font-medium text-foreground">
          آیا برای خروج از حساب کاربری خود اطمینان دارید؟
        </p>
        <p class="text-xs text-muted-foreground">
          برای دسترسی مجدد به تاریخچه گفتگوها و امکانات پلتفرم باید دوباره وارد حساب کاربری شوید.
        </p>
      </div>

      <!-- Footer Actions -->
      <div class="px-6 py-4 border-t border-border bg-secondary/30 flex items-center justify-between gap-3 w-full">
        <button
          type="button"
          @click="handleConfirm"
          :disabled="isLoggingOut"
          class="px-4 py-2 rounded-lg bg-destructive hover:bg-destructive/90 text-destructive-foreground text-xs sm:text-sm font-medium transition-colors inline-flex items-center gap-2 shadow-sm"
        >
          <svg v-if="isLoggingOut" class="animate-spin -ml-1 mr-1 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>تأیید و خروج</span>
        </button>

        <button
          type="button"
          @click="emit('close')"
          :disabled="isLoggingOut"
          class="px-4 py-2 rounded-lg border border-border bg-secondary hover:bg-secondary/80 text-secondary-foreground text-xs sm:text-sm font-medium transition-colors"
        >
          انصراف
        </button>
      </div>
    </div>
  </div>
</template>

