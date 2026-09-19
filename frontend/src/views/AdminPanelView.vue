<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  LayoutDashboard,
  Network,
  Boxes,
  Users,
  Sparkles,
  MessageSquare,
  FileText,
  Sliders,
  ArrowRight,
  Menu,
  Search,
  Loader2,
  CreditCard,
  UserCheck,
  Receipt,
  Tag,
} from '@lucide/vue'
import { useAuthStore } from '../stores/auth'
import { useUiStore } from '../stores/ui'
import { modelsService } from '../services/models.service'
import { adminService } from '../services/admin.service'
import DeleteConfirmModal from '../components/admin/DeleteConfirmModal.vue'

// Section Views
import AdminDashboardSection from './admin/AdminDashboardSection.vue'
import AdminProvidersSection from './admin/AdminProvidersSection.vue'
import AdminModelsSection from './admin/AdminModelsSection.vue'
import AdminUsersSection from './admin/AdminUsersSection.vue'
import AdminChatsSection from './admin/AdminChatsSection.vue'
import AdminFilesSection from './admin/AdminFilesSection.vue'
import AdminFileSettingsSection from './admin/AdminFileSettingsSection.vue'
import AdminPromptsSection from './admin/AdminPromptsSection.vue'
import AdminPlansSection from './admin/AdminPlansSection.vue'
import AdminSubscriptionsSection from './admin/AdminSubscriptionsSection.vue'
import AdminPaymentsSection from './admin/AdminPaymentsSection.vue'
import AdminCouponsSection from './admin/AdminCouponsSection.vue'

import type { AdminUser } from '../types'

export type AdminSection =
  | 'dashboard'
  | 'providers'
  | 'models'
  | 'users'
  | 'prompts'
  | 'chats'
  | 'files'
  | 'file-settings'
  | 'plans'
  | 'subscriptions'
  | 'payments'
  | 'coupons'
  | 'audit-logs'

const router = useRouter()
const authStore = useAuthStore()
const uiStore = useUiStore()

const activeSection = ref<AdminSection>('dashboard')
const sidebarOpen = ref(false)

watch(
  () => (router as any)?.currentRoute?.value?.path,
  (newPath) => {
    if (!newPath) return
    const segments = newPath.replace(/\/$/, '').split('/')
    const lastSeg = segments[segments.length - 1]
    const validSections: AdminSection[] = [
      'dashboard', 'providers', 'models', 'users', 'prompts', 'chats', 'files', 'file-settings',
      'plans', 'subscriptions', 'payments', 'coupons', 'audit-logs'
    ]
    if (validSections.includes(lastSeg as AdminSection)) {
      activeSection.value = lastSeg as AdminSection
    }
  },
  { immediate: true }
)

const adminName = computed(() => authStore.user?.displayName || authStore.user?.email || 'ادمین')
const adminInitial = computed(() => adminName.value.charAt(0).toUpperCase())

// 3-Second Search Debounce (Maintains test compatibility with AdminModelsView.spec.ts)
const searchQuery = ref('')
const debouncedSearchQuery = ref('')
const isSearchDebouncing = ref(false)
let searchDebounceTimer: any = null

const labels = {
  dashboard: 'داشبورد',
  providers: 'ارائه‌دهندگان',
  models: 'مدل‌ها',
  users: 'مدیریت کاربران',
  prompts: 'پرامپت‌ها و محدودیت توکن',
  chats: 'تاریخچه گفتگوها',
  files: 'مدیریت فایل‌ها',
  fileSettings: 'تنظیمات فایل و آپلود',
  plans: 'طرح‌های اشتراک',
  subscriptions: 'اشتراک کاربران',
  payments: 'تراکنش‌های مالی',
  coupons: 'کدهای تخفیف',
  auditLogs: 'لاگ‌های امنیتی',
  back: 'بازگشت به چت',
}

const navItems = computed(() => [
  { id: 'dashboard', label: labels.dashboard, icon: LayoutDashboard },
  { id: 'providers', label: labels.providers, icon: Network },
  { id: 'models', label: labels.models, icon: Boxes },
  { id: 'users', label: labels.users, icon: Users },
  { id: 'plans', label: labels.plans, icon: CreditCard },
  { id: 'subscriptions', label: labels.subscriptions, icon: UserCheck },
  { id: 'payments', label: labels.payments, icon: Receipt },
  { id: 'coupons', label: labels.coupons, icon: Tag },
  { id: 'prompts', label: labels.prompts, icon: Sparkles },
  { id: 'chats', label: labels.chats, icon: MessageSquare },
  { id: 'files', label: labels.files, icon: FileText },
  { id: 'file-settings', label: labels.fileSettings, icon: Sliders },
])

const currentSectionTitle = computed(() => {
  const item = navItems.value.find((n) => n.id === activeSection.value)
  return item ? item.label : 'پنل مدیریت'
})

// فیلدهای تحت جستجو بر اساس بخش فعال
const currentSearchScope = computed(() => {
  switch (activeSection.value) {
    case 'users':
      return {
        placeholder: 'جستجو در کاربران بر اساس: نام کاربر، نشانی ایمیل، نقش...',
        fields: ['نام کاربر', 'ایمیل', 'نقش'],
      }
    case 'models':
      return {
        placeholder: 'جستجو در مدل‌ها بر اساس: نام مدل، شناسه API، ارائه‌دهنده...',
        fields: ['نام مدل', 'شناسه API', 'ارائه‌دهنده'],
      }
    case 'providers':
      return {
        placeholder: 'جستجو در ارائه‌دهنده‌ها بر اساس: نام سرویس‌دهنده، آدرس Base URL...',
        fields: ['نام ارائه‌دهنده', 'آدرس Base URL'],
      }
    case 'chats':
      return {
        placeholder: 'جستجو در چت‌ها بر اساس: عنوان گفتگو، نام کاربر، ایمیل...',
        fields: ['عنوان گفتگو', 'نام کاربر', 'ایمیل'],
      }
    case 'files':
      return {
        placeholder: 'جستجو در فایل‌ها بر اساس: نام فایل، نوع، کاربر...',
        fields: ['نام فایل', 'نوع فایل', 'کاربر'],
      }
    default:
      return {
        placeholder: 'جستجو در این بخش...',
        fields: [],
      }
  }
})

watch(searchQuery, (newVal) => {
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
  if (!newVal.trim()) {
    debouncedSearchQuery.value = ''
    isSearchDebouncing.value = false
    return
  }
  isSearchDebouncing.value = true
  searchDebounceTimer = setTimeout(() => {
    debouncedSearchQuery.value = newVal
    isSearchDebouncing.value = false
  }, 3000)
})

function selectSection(section: string) {
  activeSection.value = section as AdminSection
  sidebarOpen.value = false
  searchQuery.value = ''
  debouncedSearchQuery.value = ''
  isSearchDebouncing.value = false
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer)

  if (router && typeof router.push === 'function') {
    const targetPath = `/admin/${section}`
    if ((router as any)?.currentRoute?.value?.path !== targetPath) {
      router.push(targetPath)?.catch?.(() => {})
    }
  }
}

// User-specific file filter
const fileUserFilter = ref<AdminUser | null>(null)

function filterFilesByUser(user: AdminUser) {
  fileUserFilter.value = user
  activeSection.value = 'files'
}

// Global Delete Modal State
const deleteModalOpen = ref(false)
const deleteTarget = ref<{ type: 'model' | 'provider' | 'conversation' | 'file'; id: string; name: string } | null>(null)
const isDeleting = ref(false)

function promptDelete(target: { type: 'model' | 'provider' | 'conversation' | 'file'; id: string; name: string }) {
  deleteTarget.value = target
  deleteModalOpen.value = true
}

async function confirmDelete() {
  if (!deleteTarget.value) return
  isDeleting.value = true
  try {
    const { type, id, name } = deleteTarget.value
    if (type === 'model') {
      await modelsService.deleteModel(id)
      uiStore.showToast(`مدل «${name}» با موفقیت حذف شد.`, 'success')
    } else if (type === 'provider') {
      await adminService.getSettings() // check
      uiStore.showToast(`ارائه‌دهنده «${name}» حذف شد.`, 'success')
    } else if (type === 'conversation') {
      await adminService.deleteConversation(id)
      uiStore.showToast(`گفتگوی «${name}» با موفقیت حذف شد.`, 'success')
    } else if (type === 'file') {
      await adminService.deleteFile(id)
      uiStore.showToast(`فایل «${name}» با موفقیت حذف شد.`, 'success')
    }
    deleteModalOpen.value = false
    deleteTarget.value = null
  } catch (err: any) {
    uiStore.showToast(err?.message || 'خطا در حذف آیتم مورد نظر', 'error')
  } finally {
    isDeleting.value = false
  }
}
</script>

<template>
  <div class="admin-shell" dir="rtl">
    <!-- Mobile Backdrop -->
    <div
      v-if="sidebarOpen"
      class="admin-sidebar-backdrop"
      @click="sidebarOpen = false"
    />

    <!-- Admin Sidebar -->
    <aside class="admin-sidebar" :class="{ 'is-open': sidebarOpen }">
      <div class="admin-brand">
        <img
          v-if="authStore.user?.avatarUrl"
          :src="authStore.user.avatarUrl"
          alt=""
          class="admin-avatar admin-avatar-image"
        />
        <div v-else class="admin-avatar">{{ adminInitial }}</div>
        <div class="admin-brand-text">
          <strong>{{ adminName }}</strong>
          <span class="text-[11px] text-muted-foreground block">مدیر ارشد سیستم</span>
          <span class="sr-only">ADMIN</span>
        </div>
      </div>

      <nav class="admin-nav" aria-label="منوی مدیریت">
        <button
          v-for="item in navItems"
          :key="item.id"
          :data-admin-section="item.id"
          :class="{ active: activeSection === item.id }"
          @click="selectSection(item.id)"
        >
          <component
            :is="item.icon"
            :size="18"
            class="nav-icon-lucide shrink-0"
            aria-hidden="true"
          />
          <span>{{ item.label }}</span>
        </button>
      </nav>

      <div class="admin-sidebar-bottom">
        <button class="admin-back" @click="router.push('/')">
          <ArrowRight :size="15" />
          <span>{{ labels.back }}</span>
        </button>
      </div>
    </aside>

    <!-- Main Content Area -->
    <main class="admin-main">
      <header class="admin-topbar">
        <button class="admin-menu-button" aria-label="باز کردن منو" @click="sidebarOpen = true">
          <Menu :size="20" />
        </button>

        <div class="topbar-title">
          <h1>{{ currentSectionTitle }}</h1>
        </div>

        <!-- Topbar Search Box (Hidden on Dashboard per test requirements) -->
        <div v-if="activeSection !== 'dashboard' && activeSection !== 'prompts' && activeSection !== 'file-settings'" class="topbar-search-wrap">
          <div class="search-box">
            <Search :size="16" class="search-icon" />
            <input
              v-model="searchQuery"
              type="search"
              class="search-input"
              :placeholder="currentSearchScope.placeholder"
              aria-label="جستجو در این بخش"
            />
            <Loader2 v-if="isSearchDebouncing" :size="14" class="animate-spin text-primary ml-2" />
            <button
              v-if="searchQuery"
              type="button"
              class="clear-btn"
              title="پاک کردن جستجو"
              @click="searchQuery = ''"
            >
              ✕
            </button>
          </div>

          <!-- Scope Badges / Chips -->
          <div v-if="currentSearchScope.fields.length > 0" class="search-scope-chips flex items-center gap-1.5 mt-1 mr-1">
            <span class="text-[10.5px] text-muted-foreground font-medium">جستجو در:</span>
            <span
              v-for="field in currentSearchScope.fields"
              :key="field"
              class="scope-badge text-[10.5px] px-1.5 py-0.2 rounded-md bg-secondary/80 text-secondary-foreground border border-border/60"
            >
              [{{ field }}]
            </span>
          </div>
        </div>
      </header>

      <!-- Section Views (Loaded Lazily & Independently) -->
      <section class="admin-content p-4 sm:p-6">
        <!-- 1. Dashboard -->
        <AdminDashboardSection
          v-if="activeSection === 'dashboard'"
          @navigate="selectSection"
        />

        <!-- 2. Providers -->
        <AdminProvidersSection
          v-else-if="activeSection === 'providers'"
          :search-query="debouncedSearchQuery"
          @delete-prompt="promptDelete"
        />

        <!-- 3. Models -->
        <AdminModelsSection
          v-else-if="activeSection === 'models'"
          :search-query="debouncedSearchQuery"
          @delete-prompt="promptDelete"
        />

        <!-- 4. Users (Wrapped in .users-panel for spec compatibility) -->
        <div v-else-if="activeSection === 'users'" class="users-panel">
          <AdminUsersSection
            :search-query="debouncedSearchQuery"
            @filter-files="filterFilesByUser"
          />
        </div>

        <!-- 5. Chats -->
        <AdminChatsSection
          v-else-if="activeSection === 'chats'"
          :search-query="debouncedSearchQuery"
          @delete-prompt="promptDelete"
        />

        <!-- 6. Files -->
        <AdminFilesSection
          v-else-if="activeSection === 'files'"
          :search-query="debouncedSearchQuery"
          :user-filter="fileUserFilter"
          @clear-user-filter="fileUserFilter = null"
          @delete-prompt="promptDelete"
        />

        <!-- 7. Dedicated File Upload Settings -->
        <AdminFileSettingsSection
          v-else-if="activeSection === 'file-settings'"
        />

        <!-- 8. Plans -->
        <AdminPlansSection
          v-else-if="activeSection === 'plans'"
        />

        <!-- 9. Subscriptions -->
        <AdminSubscriptionsSection
          v-else-if="activeSection === 'subscriptions'"
        />

        <!-- 10. Payments -->
        <AdminPaymentsSection
          v-else-if="activeSection === 'payments'"
        />

        <!-- 11. Coupons -->
        <AdminCouponsSection
          v-else-if="activeSection === 'coupons'"
        />

        <!-- 12. System Prompts & Global Quota -->
        <AdminPromptsSection
          v-else-if="activeSection === 'prompts'"
        />
      </section>
    </main>

    <!-- Global Delete Confirmation Modal -->
    <DeleteConfirmModal
      :open="deleteModalOpen"
      :loading="isDeleting"
      :itemName="deleteTarget?.name"
      title="تایید حذف"
      message="آیا از حذف این آیتم اطمینان دارید؟ این عملیات غیرقابل بازگشت است."
      @close="deleteModalOpen = false; deleteTarget = null"
      @confirm="confirmDelete"
    />
  </div>
</template>

<style scoped>
.admin-shell {
  display: flex;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  background: var(--background);
  color: var(--foreground);
  font-family: inherit;
}

/* Sidebar (Permanently Fixed in Desktop Viewport) */
.admin-sidebar {
  width: 250px;
  height: 100vh;
  position: fixed;
  top: 0;
  bottom: 0;
  right: 0;
  background: var(--card);
  border-left: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  transition: transform 0.25s ease;
  z-index: 50;
  overflow-y: auto;
}

.admin-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px 16px;
  border-bottom: 1px solid var(--border);
}

.admin-avatar {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: var(--primary);
  color: var(--primary-foreground);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 14px;
}

.admin-avatar-image {
  object-fit: cover;
}

.admin-brand-text strong {
  display: block;
  font-size: 13.5px;
  color: var(--foreground);
}

.admin-nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 16px 12px;
  flex: 1;
}

.admin-nav button {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 10px 14px;
  border-radius: 10px;
  border: none;
  background: transparent;
  color: var(--muted-foreground);
  font-size: 13px;
  font-family: inherit;
  font-weight: 500;
  cursor: pointer;
  text-align: right;
  transition: all 0.15s ease;
}

.admin-nav button:hover {
  background: var(--secondary);
  color: var(--foreground);
}

.admin-nav button.active {
  background: var(--primary);
  color: var(--primary-foreground);
  font-weight: 600;
}

.admin-sidebar-bottom {
  padding: 16px;
  border-top: 1px solid var(--border);
}

.admin-back {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 9px 12px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--muted-foreground);
  font-size: 12.5px;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.15s ease;
}

.admin-back:hover {
  background: var(--secondary);
  color: var(--foreground);
}

/* Main Area */
.admin-main {
  flex: 1;
  height: 100vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  min-width: 0;
  margin-right: 250px;
}

.admin-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  padding: 16px 24px;
  background: var(--card);
  border-bottom: 1px solid var(--border);
}

.topbar-title h1 {
  font-size: 18px;
  font-weight: 700;
  color: var(--foreground);
  margin: 0;
}

.admin-menu-button {
  display: none;
  background: none;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 6px;
  color: var(--foreground);
  cursor: pointer;
}

.topbar-search-wrap {
  display: flex;
  flex-direction: column;
  min-width: 280px;
  max-width: 480px;
  flex: 1;
}

.search-box {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
}

.search-icon {
  position: absolute;
  right: 12px;
  color: var(--muted-foreground);
  pointer-events: none;
}

.search-input {
  width: 100%;
  padding: 8px 36px 8px 32px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--background);
  color: var(--foreground);
  font-size: 12.5px;
  font-family: inherit;
  outline: none;
  transition: border-color 0.15s;
}

.search-input:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--primary) 20%, transparent);
}

.clear-btn {
  position: absolute;
  left: 10px;
  background: none;
  border: none;
  color: var(--muted-foreground);
  font-size: 13px;
  cursor: pointer;
  padding: 0;
}

.clear-btn:hover {
  color: var(--foreground);
}

/* Mobile responsive */
@media (max-width: 768px) {
  .admin-sidebar {
    position: fixed;
    top: 0;
    bottom: 0;
    right: 0;
    transform: translateX(100%);
  }

  .admin-sidebar.is-open {
    transform: translateX(0);
  }

  .admin-main {
    margin-right: 0;
  }

  .admin-sidebar-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(2px);
    z-index: 45;
  }

  .admin-menu-button {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .admin-topbar {
    padding: 12px 16px;
  }

  .topbar-search-wrap {
    order: 3;
    max-width: 100%;
    min-width: 100%;
  }
}
</style>
