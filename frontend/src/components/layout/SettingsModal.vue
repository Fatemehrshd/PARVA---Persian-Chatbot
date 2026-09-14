<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useUiStore } from '../../stores/ui'
import { useAuthStore } from '../../stores/auth'

const router = useRouter()
const uiStore = useUiStore()
const authStore = useAuthStore()

function setDirection(dir: 'rtl' | 'ltr') {
  uiStore.direction = dir
}

function navigateToAdmin() {
  uiStore.closeSettings()
  router.push('/admin/models')
}
</script>

<template>
  <div v-if="uiStore.settingsModalOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" @click.self="uiStore.closeSettings" :dir="uiStore.direction">
    <div class="w-full max-w-md bg-card border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col">
      <!-- Header -->
      <div class="px-6 py-4 border-b border-border flex items-center justify-between bg-secondary/30">
        <h2 class="text-lg font-semibold text-foreground">
          {{ uiStore.direction === 'rtl' ? 'تنظیمات' : 'Settings' }}
        </h2>
        <button 
          @click="uiStore.closeSettings" 
          class="text-muted-foreground hover:text-foreground hover:bg-secondary p-1.5 rounded-md transition-colors"
          aria-label="Close"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <!-- Content -->
      <div class="p-6 flex flex-col gap-6">
        <!-- Theme Selection (Dark / Light) -->
        <div class="flex flex-col gap-3">
          <label class="text-sm font-medium text-secondary-foreground">
            {{ uiStore.direction === 'rtl' ? 'تم ظاهری (Theme)' : 'Theme' }}
          </label>
          <div class="grid grid-cols-2 gap-3">
            <button 
              @click="uiStore.setTheme('dark')"
              :class="['flex items-center justify-center gap-2 py-3 px-4 rounded-lg border text-sm font-medium transition-all', uiStore.theme === 'dark' ? 'bg-primary/15 border-primary text-primary shadow-sm font-semibold' : 'bg-secondary border-border text-foreground hover:border-muted-foreground/50']"
            >
              <!-- Moon Icon -->
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
              </svg>
              <span>{{ uiStore.direction === 'rtl' ? 'حالت تیره ' : 'Dark (Grok)' }}</span>
            </button>
            <button 
              @click="uiStore.setTheme('light')"
              :class="['flex items-center justify-center gap-2 py-3 px-4 rounded-lg border text-sm font-medium transition-all', uiStore.theme === 'light' ? 'bg-primary/15 border-primary text-primary shadow-sm font-semibold' : 'bg-secondary border-border text-foreground hover:border-muted-foreground/50']"
            >
              <!-- Sun Icon -->
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="4"/>
                <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
              </svg>
              <span>{{ uiStore.direction === 'rtl' ? 'حالت روشن' : 'Light' }}</span>
            </button>
          </div>
        </div>

        <!-- Language / Direction -->
        <div class="flex flex-col gap-3">
          <label class="text-sm font-medium text-secondary-foreground">
            {{ uiStore.direction === 'rtl' ? 'زبان و چیدمان (Language & Layout)' : 'Language & Layout' }}
          </label>
          <div class="grid grid-cols-2 gap-3">
            <button 
              @click="setDirection('rtl')"
              :class="['flex items-center justify-center gap-2 py-3 px-4 rounded-lg border text-sm font-medium transition-all', uiStore.direction === 'rtl' ? 'bg-primary/10 border-primary text-primary shadow-sm' : 'bg-secondary border-border text-foreground hover:border-muted-foreground/50']"
            >
              <svg v-if="uiStore.direction === 'rtl'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="opacity-80"><path d="M20 6L9 17l-5-5"/></svg>
              فارسی (RTL)
            </button>
            <button 
              @click="setDirection('ltr')"
              :class="['flex items-center justify-center gap-2 py-3 px-4 rounded-lg border text-sm font-medium transition-all', uiStore.direction === 'ltr' ? 'bg-primary/10 border-primary text-primary shadow-sm' : 'bg-secondary border-border text-foreground hover:border-muted-foreground/50']"
            >
              <svg v-if="uiStore.direction === 'ltr'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="opacity-80"><path d="M20 6L9 17l-5-5"/></svg>
              English (LTR)
            </button>
          </div>
          <p class="text-xs text-muted-foreground mt-1">
            {{ uiStore.direction === 'rtl' ? 'تغییر این گزینه، چیدمان کل برنامه را تحت تأثیر قرار می‌دهد.' : 'Changing this will affect the entire layout of the application.' }}
          </p>
        </div>

        <!-- Admin Panel Access (Admin Only) -->
        <div v-if="authStore.isAdmin" class="flex flex-col gap-2 pt-3 border-t border-border">
          <label class="text-sm font-medium text-secondary-foreground">
            {{ uiStore.direction === 'rtl' ? 'مدیریت سامانه (مخصوص ادمین)' : 'Administration' }}
          </label>
          <button 
            @click="navigateToAdmin"
            class="flex items-center justify-between py-2.5 px-4 rounded-lg border border-primary/30 bg-primary/10 hover:bg-primary/20 text-primary text-sm font-medium transition-all"
          >
            <div class="flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                <line x1="8" y1="21" x2="16" y2="21"></line>
                <line x1="12" y1="17" x2="12" y2="21"></line>
              </svg>
              <span>{{ uiStore.direction === 'rtl' ? 'ورود به پنل مدیریت مدل‌ها' : 'Manage AI Models' }}</span>
            </div>
            <span class="text-xs opacity-70">{{ uiStore.direction === 'rtl' ? '←' : '→' }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

