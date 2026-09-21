<script setup lang="ts">
import { useUiStore } from '../../stores/ui'

const uiStore = useUiStore()
</script>

<template>
  <div
    class="fixed top-4 right-0 sm:right-4 z-[9999] flex flex-col gap-2 pointer-events-none transition-all duration-300 w-full max-w-sm px-4"
    :dir="uiStore.direction"
  >
    <transition-group
      enter-active-class="transform ease-out duration-300 transition"
      enter-from-class="translate-y-[-10px] opacity-0 scale-95"
      enter-to-class="translate-y-0 opacity-100 scale-100"
      leave-active-class="transition ease-in duration-200"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-for="toast in uiStore.toasts"
        :key="toast.id"
        class="pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl border shadow-xl backdrop-blur-md text-xs sm:text-sm font-medium transition-all"
        :class="[
          toast.type === 'error'
            ? 'bg-rose-50 text-rose-950 border-rose-200/80 dark:bg-rose-950/80 dark:text-rose-100 dark:border-rose-800/60'
            : toast.type === 'success'
            ? 'bg-emerald-50 text-emerald-950 border-emerald-200/80 dark:bg-emerald-950/80 dark:text-emerald-100 dark:border-emerald-800/60'
            : toast.type === 'warning'
            ? 'bg-amber-50 text-amber-950 border-amber-200/80 dark:bg-amber-950/80 dark:text-amber-100 dark:border-amber-800/60'
            : 'bg-card/95 text-foreground border-border/80 dark:bg-card/90 dark:text-foreground dark:border-border'
        ]"
      >
        <!-- Icon -->
        <span class="flex-shrink-0 mt-0.5" :class="[
          toast.type === 'error' ? 'text-rose-600 dark:text-rose-400' :
          toast.type === 'success' ? 'text-emerald-600 dark:text-emerald-400' :
          toast.type === 'warning' ? 'text-amber-600 dark:text-amber-400' :
          'text-primary'
        ]">
          <svg v-if="toast.type === 'error'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="15" y1="9" x2="9" y2="15"/>
            <line x1="9" y1="9" x2="15" y2="15"/>
          </svg>
          <svg v-else-if="toast.type === 'success'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
            <polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
          <svg v-else-if="toast.type === 'warning'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="16" x2="12" y2="12"/>
            <line x1="12" y1="8" x2="12.01" y2="8"/>
          </svg>
        </span>

        <!-- Message -->
        <div class="flex-1 leading-snug break-words">
          {{ toast.message }}
        </div>

        <!-- Dismiss button -->
        <button
          @click="uiStore.removeToast(toast.id)"
          class="flex-shrink-0 p-1 rounded-md opacity-70 hover:opacity-100 transition-opacity"
          aria-label="Close"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    </transition-group>
  </div>
</template>

