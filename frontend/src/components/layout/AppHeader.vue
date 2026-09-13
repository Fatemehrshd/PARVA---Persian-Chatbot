<script setup lang="ts">
import { ref } from 'vue'
import { useUiStore } from '../../stores/ui'
import { useModelsStore } from '../../stores/models'
import { useAuthStore } from '../../stores/auth'

const uiStore = useUiStore()
const modelsStore = useModelsStore()
const authStore = useAuthStore()

const modelMenuOpen = ref(false)

function toggleModelMenu() {
  modelMenuOpen.value = !modelMenuOpen.value
}

function selectModel(id: string) {
  modelsStore.selectModel(id)
  modelMenuOpen.value = false
}
</script>

<template>
  <header class="h-[var(--header-height)] w-full bg-background border-b border-border flex items-center justify-between px-3 sm:px-4 z-10 shrink-0">
    <!-- Left Section: Sidebar Toggle & Model Selector -->
    <div class="flex items-center gap-2 sm:gap-3">
      <button
        class="w-8 h-8 flex items-center justify-center rounded-md text-secondary-foreground hover:bg-secondary hover:text-foreground transition-colors"
        @click="uiStore.toggleSidebar"
        :title="uiStore.sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'"
        aria-label="Toggle sidebar"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
          <line x1="9" y1="3" x2="9" y2="21"/>
        </svg>
      </button>

      <!-- Model Dropdown -->
      <div class="relative">
        <button 
          class="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 bg-card border border-border rounded-lg text-[12px] sm:text-[13px] font-medium text-foreground hover:bg-secondary hover:border-muted-foreground transition-all" 
          @click="toggleModelMenu"
        >
          <span class="w-1.5 h-1.5 rounded-full bg-primary hidden sm:inline-block"></span>
          <span class="truncate max-w-[80px] sm:max-w-[200px]">{{ modelsStore.selectedModel.name }}</span>
          <svg class="text-muted-foreground flex-shrink-0" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>

        <div v-if="modelMenuOpen" class="absolute top-[calc(100%+6px)] start-0 w-[260px] bg-card border border-border rounded-lg shadow-[0_10px_30px_rgba(0,0,0,0.5)] p-1.5 z-[100]">
          <div class="text-[10px] text-muted-foreground px-2.5 pt-1.5 pb-1 font-mono uppercase">
            {{ uiStore.direction === 'rtl' ? 'انتخاب مدل هوش مصنوعی' : 'Select AI Model' }}
          </div>
          <button
            v-for="model in modelsStore.models"
            :key="model.id"
            :class="[
              'w-full flex items-center justify-between px-2.5 py-2 rounded-md text-start transition-colors',
              model.id === modelsStore.selectedModelId ? 'bg-secondary' : 'hover:bg-secondary/50'
            ]"
            @click="selectModel(model.id)"
          >
            <div class="flex flex-col gap-0.5">
              <span class="text-[13px] font-medium text-foreground">{{ model.name }}</span>
              <span class="text-[11px] text-muted-foreground font-mono">{{ model.provider }} • {{ model.apiIdentifier }}</span>
            </div>
            <span v-if="model.id === modelsStore.selectedModelId" class="text-primary font-bold">✓</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Right Section: Admin Models, Settings, User Profile -->
    <div class="flex items-center gap-1.5 sm:gap-3">
      
      <!-- Settings Button -->
      <button
        class="w-8 h-8 flex items-center justify-center rounded-md text-secondary-foreground hover:bg-secondary hover:text-foreground transition-colors"
        @click="uiStore.openSettings"
        :title="uiStore.direction === 'rtl' ? 'تنظیمات' : 'Settings'"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
        </svg>
      </button>

      <!-- Admin Models link/button -->
      <button
        class="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 bg-secondary border border-border rounded-md text-xs text-secondary-foreground hover:text-foreground hover:border-muted-foreground transition-all"
        @click="uiStore.openAdminModels"
        :title="uiStore.direction === 'rtl' ? 'مدیریت مدل‌ها' : 'Manage Models'"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
          <line x1="8" y1="21" x2="16" y2="21"></line>
          <line x1="12" y1="17" x2="12" y2="21"></line>
        </svg>
        <span class="hidden sm:inline font-medium">{{ uiStore.direction === 'rtl' ? 'مدل‌ها' : 'Models' }}</span>
      </button>

      <!-- Auth State / User Button -->
      <template v-if="authStore.isAuthenticated">
        <div class="flex items-center gap-1.5 sm:gap-2 bg-secondary py-1 ps-1 pe-2 sm:pe-3 rounded-full border border-border">
          <div class="w-6 h-6 rounded-full bg-gradient-to-br from-primary to-purple-400 text-white text-[11px] font-bold flex items-center justify-center shadow-sm">
            {{ authStore.user?.displayName?.charAt(0).toUpperCase() || 'U' }}
          </div>
          <button class="text-muted-foreground flex items-center hover:text-red-500 transition-colors" @click="authStore.logout" :title="uiStore.direction === 'rtl' ? 'خروج' : 'Logout'">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        </div>
      </template>
      <template v-else>
        <router-link to="/login" class="px-2 sm:px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-xs sm:text-sm font-medium hover:bg-primary/90 transition-colors inline-flex items-center justify-center">
          {{ uiStore.direction === 'rtl' ? 'ورود' : 'Sign In' }}
        </router-link>
      </template>
    </div>
  </header>
</template>

<style scoped>
/* Scoped styles removed in favor of Tailwind utility classes */
</style>
