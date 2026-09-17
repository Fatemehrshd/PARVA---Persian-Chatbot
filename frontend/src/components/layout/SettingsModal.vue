<script setup lang="ts">
import { useRouter } from 'vue-router'
import {
  Settings,
  Palette,
  Moon,
  Sun,
  ShieldCheck,
  Check,
  X,
  ChevronLeft,
  Sparkles,
} from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { useUiStore } from '../../stores/ui'
import { useAuthStore } from '../../stores/auth'

const router = useRouter()
const uiStore = useUiStore()
const authStore = useAuthStore()

function navigateToAdmin() {
  uiStore.closeSettings()
  router.push('/admin/models')
}
</script>

<template>
  <div
    v-if="uiStore.settingsModalOpen"
    class="settings-modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4"
    @click.self="uiStore.closeSettings"
    dir="rtl"
  >
    <div
      class="settings-modal-dialog w-full max-w-lg bg-card text-foreground border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-dialog-title"
    >
      <!-- Header -->
      <div class="px-6 py-4 border-b border-border flex items-center justify-between bg-surface-alt">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-sm">
            <Settings :size="18" />
          </div>
          <div>
            <h2 id="settings-dialog-title" class="text-base sm:text-lg font-semibold text-foreground leading-tight">
              تنظیمات
            </h2>
          </div>
        </div>

        <button
          @click="uiStore.closeSettings"
          class="text-muted-foreground hover:text-foreground hover:bg-secondary p-2 rounded-lg transition-colors cursor-pointer"
          title="بستن"
          aria-label="Close"
        >
          <X :size="18" />
        </button>
      </div>

      <!-- Content -->
      <div class="p-6 flex flex-col gap-6 overflow-y-auto max-h-[calc(85vh-130px)]">
        
        <!-- ═══════════════════════════════════════════
             Theme Selection (Dark / Light)
        ═══════════════════════════════════════════ -->
        <div class="flex flex-col gap-3.5">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <Palette :size="16" class="text-primary" />
              <label class="text-sm font-semibold text-foreground">
                تم و رنگ‌بندی 
              </label>
            </div>
          </div>

          <!-- Cards Grid -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            
            <!-- Dark Theme Card -->
            <button
              type="button"
              @click="uiStore.setTheme('dark')"
              :class="[
                'theme-card group relative text-start flex flex-col rounded-xl border p-3 transition-all duration-200 cursor-pointer overflow-hidden',
                uiStore.theme === 'dark'
                  ? 'border-primary ring-2 ring-primary/40 bg-primary/[0.06] shadow-md shadow-primary/5'
                  : 'border-border/80 bg-secondary/30 hover:border-muted-foreground/40 hover:bg-secondary/50'
              ]"
              :aria-pressed="uiStore.theme === 'dark'"
            >
              <!-- Mockup Graphic: Dark -->
              <div class="mockup-frame bg-[#0d0f18] border border-[#202336] rounded-lg p-2.5 mb-3 flex flex-col gap-1.5 shadow-inner select-none pointer-events-none">
                <!-- Mock Top bar -->
                <div class="flex items-center justify-between pb-1 border-b border-[#1b1e2e]">
                  <div class="flex items-center gap-1">
                    <span class="w-1.5 h-1.5 rounded-full bg-[#f87171]/70" />
                    <span class="w-1.5 h-1.5 rounded-full bg-[#fbbf24]/70" />
                    <span class="w-1.5 h-1.5 rounded-full bg-[#34d399]/70" />
                  </div>
                  <span class="w-8 h-1 rounded-full bg-[#202436]" />
                </div>
                <!-- Mock Body -->
                <div class="flex gap-2 items-start py-0.5">
                  <div class="w-2.5 h-full flex flex-col gap-1 opacity-40">
                    <div class="w-2 h-2 rounded bg-primary" />
                    <div class="w-2 h-1 rounded bg-[#202436]" />
                  </div>
                  <div class="flex-1 flex flex-col gap-1.5">
                    <!-- User bubble -->
                    <div class="self-end bg-[#252a45] rounded px-1.5 py-0.5 text-[8px] text-[#93a2e0] max-w-[75%]">
                      سلام، راهنمایی کن
                    </div>
                    <!-- Assistant bubble -->
                    <div class="self-start bg-[#161826] border border-[#23263b] rounded px-1.5 py-0.5 text-[8px] text-[#ccd0e6] max-w-[85%] flex items-center gap-1">
                      <span class="w-1.5 h-1.5 rounded-full bg-primary inline-block flex-shrink-0" />
                      <span>در خدمتم!</span>
                    </div>
                  </div>
                </div>
                <!-- Mock Composer -->
                <div class="mt-0.5 bg-[#141624] border border-[#24283d] rounded-full h-3 flex items-center px-2 justify-between">
                  <span class="w-10 h-0.5 rounded-full bg-[#2a2f47]" />
                  <span class="w-1.5 h-1.5 rounded-full bg-primary" />
                </div>
              </div>

              <!-- Card Label & Info -->
              <div class="flex items-center justify-between gap-2 mt-auto">
                <div class="flex items-center gap-2 min-w-0">
                  <div class="w-7 h-7 rounded-lg bg-[#1a1d2e] border border-[#2c314f] text-primary flex items-center justify-center flex-shrink-0">
                    <Moon :size="14" />
                  </div>
                  <div class="min-w-0">
                    <div class="text-xs sm:text-sm font-semibold text-foreground flex items-center gap-1.5">
                      <span>حالت تیره</span>
                    </div>
                  </div>
                </div>

                <!-- Radio Check Indicator -->
                <div
                  :class="[
                    'w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-colors',
                    uiStore.theme === 'dark'
                      ? 'bg-primary text-primary-foreground'
                      : 'border border-border text-transparent'
                  ]"
                >
                  <Check :size="12" stroke-width="3" />
                </div>
              </div>
            </button>

            <!-- Light Theme Card -->
            <button
              type="button"
              @click="uiStore.setTheme('light')"
              :class="[
                'theme-card group relative text-start flex flex-col rounded-xl border p-3 transition-all duration-200 cursor-pointer overflow-hidden',
                uiStore.theme === 'light'
                  ? 'border-primary ring-2 ring-primary/40 bg-primary/[0.06] shadow-md shadow-primary/5'
                  : 'border-border/80 bg-secondary/30 hover:border-muted-foreground/40 hover:bg-secondary/50'
              ]"
              :aria-pressed="uiStore.theme === 'light'"
            >
              <!-- Mockup Graphic: Light -->
              <div class="mockup-frame bg-[#F5F3EE] border border-[#ded8c4] rounded-lg p-2.5 mb-3 flex flex-col gap-1.5 shadow-inner select-none pointer-events-none">
                <!-- Mock Top bar -->
                <div class="flex items-center justify-between pb-1 border-b border-[#e5dfce]">
                  <div class="flex items-center gap-1">
                    <span class="w-1.5 h-1.5 rounded-full bg-[#f87171]/70" />
                    <span class="w-1.5 h-1.5 rounded-full bg-[#fbbf24]/70" />
                    <span class="w-1.5 h-1.5 rounded-full bg-[#34d399]/70" />
                  </div>
                  <span class="w-8 h-1 rounded-full bg-[#ded9c7]" />
                </div>
                <!-- Mock Body -->
                <div class="flex gap-2 items-start py-0.5">
                  <div class="w-2.5 h-full flex flex-col gap-1 opacity-40">
                    <div class="w-2 h-2 rounded bg-[#1B2F6E]" />
                    <div class="w-2 h-1 rounded bg-[#dcd7c4]" />
                  </div>
                  <div class="flex-1 flex flex-col gap-1.5">
                    <!-- User bubble -->
                    <div class="self-end bg-[#1B2F6E]/10 rounded px-1.5 py-0.5 text-[8px] text-[#1B2F6E] max-w-[75%] font-medium">
                      سلام، راهنمایی کن
                    </div>
                    <!-- Assistant bubble -->
                    <div class="self-start bg-white border border-[#ded8c4] rounded px-1.5 py-0.5 text-[8px] text-[#2c3046] max-w-[85%] flex items-center gap-1 shadow-xs">
                      <span class="w-1.5 h-1.5 rounded-full bg-[#1B2F6E] inline-block flex-shrink-0" />
                      <span>در خدمتم!</span>
                    </div>
                  </div>
                </div>
                <!-- Mock Composer -->
                <div class="mt-0.5 bg-white border border-[#ded8c4] rounded-full h-3 flex items-center px-2 justify-between">
                  <span class="w-10 h-0.5 rounded-full bg-[#d0caba]" />
                  <span class="w-1.5 h-1.5 rounded-full bg-[#1B2F6E]" />
                </div>
              </div>

              <!-- Card Label & Info -->
              <div class="flex items-center justify-between gap-2 mt-auto">
                <div class="flex items-center gap-2 min-w-0">
                  <div class="w-7 h-7 rounded-lg bg-[#fef8e7] border border-[#fae2a6] text-amber-600 flex items-center justify-center flex-shrink-0">
                    <Sun :size="14" />
                  </div>
                  <div class="min-w-0">
                    <div class="text-xs sm:text-sm font-semibold text-foreground flex items-center gap-1.5">
                      <span>حالت روشن</span>
                    </div>
                  </div>
                </div>

                <!-- Radio Check Indicator -->
                <div
                  :class="[
                    'w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-colors',
                    uiStore.theme === 'light'
                      ? 'bg-primary text-primary-foreground'
                      : 'border border-border text-transparent'
                  ]"
                >
                  <Check :size="12" stroke-width="3" />
                </div>
              </div>
            </button>

          </div>
        </div>

        <!-- ═══════════════════════════════════════════
             Admin Panel Access (Admin Only)
        ═══════════════════════════════════════════ -->
        <div v-if="authStore.isAdmin" class="flex flex-col gap-2 pt-3 border-t border-border">
          <div class="flex items-center gap-2">
            <ShieldCheck :size="16" class="text-primary" />
            <label class="text-sm font-semibold text-foreground">
              مدیریت و پیکربندی سامانه
            </label>
          </div>

          <button
            type="button"
            @click="navigateToAdmin"
            class="flex items-center justify-between py-2.5 px-4 rounded-xl border border-primary/30 bg-surface-alt hover:bg-secondary text-primary text-xs sm:text-sm font-medium transition-all shadow-xs group cursor-pointer"
          >
            <div class="flex items-center gap-2.5">
              <Sparkles :size="15" class="text-primary group-hover:rotate-12 transition-transform" />
              <span>ورود به پنل مدیریت مدل‌های هوش مصنوعی</span>
            </div>
            <ChevronLeft :size="16" class="opacity-70 group-hover:opacity-100 group-hover:translate-x-[-2px] transition-all" />
          </button>
        </div>

      </div>

      <!-- Footer -->
      <div class="px-6 py-3.5 border-t border-border bg-surface-alt flex items-center justify-end">
        <Button @click="uiStore.closeSettings">
          تأیید
        </Button>
      </div>

    </div>
  </div>
</template>

<style scoped>
.settings-modal-dialog {
  background-color: var(--card);
  color: var(--foreground);
  border-color: var(--border);
}

.theme-card:hover {
  transform: translateY(-1px);
}

.theme-card:active {
  transform: translateY(0);
}

.mockup-frame {
  height: 94px;
}
</style>

