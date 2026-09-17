<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import {
  PanelRightClose,
  PanelRightOpen,
  Search,
  SquarePen,
  MessageCircleDashed,
  MessageSquare,
  Pencil,
  Trash2,
  ChevronUp,
  LogIn,
} from '@lucide/vue'
import { useUiStore } from '../../stores/ui'
import { useChatStore } from '../../stores/chat'
import { useAuthStore } from '../../stores/auth'
import { useThemeLogo } from '../../composables/useThemeLogo'
import ProfileMenu from './ProfileMenu.vue'
import EditConversationModal from '../chat/EditConversationModal.vue'
import DeleteConversationModal from '../chat/DeleteConversationModal.vue'
import LogoutModal from '../auth/LogoutModal.vue'
import SearchModal from '../chat/SearchModal.vue'
import ProfileModal from './ProfileModal.vue'
import type { Conversation } from '../../types'

const router = useRouter()
const uiStore = useUiStore()
const chatStore = useChatStore()
const authStore = useAuthStore()

const { activeLogo } = useThemeLogo()

const editingConversation = ref<Conversation | null>(null)
const isEditModalOpen = ref(false)

const deletingConversation = ref<Conversation | null>(null)
const isDeleteModalOpen = ref(false)

const isLogoutModalOpen = ref(false)
const isSearchModalOpen = ref(false)
const isProfileModalOpen = ref(false)
const profileMenuOpen = ref(false)

// Sidebar toggle icons for RTL layout (sidebar sits on the right)
const SidebarCollapseIcon = PanelRightClose
const SidebarExpandIcon = PanelRightOpen

// Disable "New Chat" when user is already on an empty (fresh) conversation
const isOnEmptyChat = computed(() =>
  chatStore.currentConversationId !== null && chatStore.messages.length === 0 && !chatStore.isStreaming
)

// ──────────────────────────────────────────
// Navigation actions
// ──────────────────────────────────────────
async function handleNewChat() {
  if (isOnEmptyChat.value) return
  const newId = await chatStore.createNewConversation()
  if (newId) router.push(`/chat/${newId}`)
}

function handleSelect(id: string) {
  chatStore.selectConversation(id)
  if (router.currentRoute.value.params.id !== id) {
    router.push(`/chat/${id}`)
  }
}

// ──────────────────────────────────────────
// Edit / Delete modals
// ──────────────────────────────────────────
function openEditModal(event: Event, conv: Conversation) {
  event.stopPropagation()
  editingConversation.value = conv
  isEditModalOpen.value = true
}

async function handleSaveTitle(id: string, newTitle: string) {
  try {
    await chatStore.updateConversationTitle(id, newTitle)
    isEditModalOpen.value = false
    editingConversation.value = null
    uiStore.showToast('عنوان ویرایش شد.', 'success')
  } catch (err: any) {
    uiStore.showToast(err?.message || 'خطا در ویرایش عنوان گفتگو', 'error')
  }
}

function openDeleteModal(event: Event, conv: Conversation) {
  event.stopPropagation()
  deletingConversation.value = conv
  isDeleteModalOpen.value = true
}

async function handleConfirmDelete(id: string) {
  try {
    await chatStore.deleteConversation(id)
    isDeleteModalOpen.value = false
    deletingConversation.value = null
    if (chatStore.currentConversationId) {
      router.push(`/chat/${chatStore.currentConversationId}`)
    } else {
      router.push('/')
    }
    uiStore.showToast('گفتگو حذف شد.', 'success')
  } catch (err: any) {
    uiStore.showToast(err?.message || 'خطا در حذف گفتگو', 'error')
  }
}

// ──────────────────────────────────────────
// Profile menu
// ──────────────────────────────────────────
function toggleProfileMenu() {
  profileMenuOpen.value = !profileMenuOpen.value
}

function handleDocumentClick(e: MouseEvent) {
  if (!profileMenuOpen.value) return
  const target = e.target as HTMLElement
  if (
    !target.closest('.profile-menu-panel') &&
    !target.closest('.profile-trigger')
  ) {
    profileMenuOpen.value = false
  }
}

onMounted(() => document.addEventListener('click', handleDocumentClick, true))
onBeforeUnmount(() => document.removeEventListener('click', handleDocumentClick, true))

function openSettings() {
  uiStore.openSettings()
  profileMenuOpen.value = false
}

function openProfile() {
  isProfileModalOpen.value = true
  profileMenuOpen.value = false
}

function openAdminPanel() {
  profileMenuOpen.value = false
  router.push('/admin/models')
}

function openLogoutModal() {
  isLogoutModalOpen.value = true
  profileMenuOpen.value = false
}

async function handleConfirmLogout() {
  try {
    await authStore.logout()
    isLogoutModalOpen.value = false
    router.push('/login')
    uiStore.showToast('با موفقیت خارج شدید.', 'info')
  } catch (err: any) {
    uiStore.showToast(err?.message || 'خطا در خروج از حساب', 'error')
  }
}

const userInitial = computed(() => {
  if (authStore.user?.displayName) return authStore.user.displayName.charAt(0).toUpperCase()
  if (authStore.user?.email) return authStore.user.email.charAt(0).toUpperCase()
  return 'U'
})
</script>

<template>
  <!-- ═══════════════════════════════════════════
       Mobile Backdrop
  ═══════════════════════════════════════════ -->
  <div
    v-if="uiStore.sidebarOpen"
    class="sidebar-backdrop"
    @click="uiStore.sidebarOpen = false"
  />

  <aside :class="['app-sidebar', { 'is-collapsed': !uiStore.sidebarOpen }]">

    <!-- ═══════════════════════════════════
         EXPANDED STATE
    ═══════════════════════════════════ -->
    <div v-if="uiStore.sidebarOpen" class="sidebar-expanded">

      <!-- Top: Collapse + Brand -->
      <div class="sb-top-row">
        <button
          class="sb-icon-btn"
          title="بستن نوار کناری"
          @click="uiStore.toggleSidebar"
        >
          <component :is="SidebarCollapseIcon" :size="17" />
        </button>
        <div class="sb-brand">
          <span class="sb-brand-name" dir="ltr">PARVA</span>
        </div>
      </div>

      <!-- Actions: Search / New Chat / Temp Chat — stacked vertically -->
      <nav class="sb-actions">
        <button class="sb-action-row" @click="isSearchModalOpen = true" title="جستجو (Ctrl+K)">
          <Search :size="16" class="sb-action-icon" />
          <span class="sb-action-label">جستجو</span>
        </button>

        <button
          class="sb-action-row sb-action-row--primary new-chat-btn"
          :class="{ 'sb-action-row--disabled': isOnEmptyChat }"
          :disabled="isOnEmptyChat"
          @click="handleNewChat"
          title="گفتگوی جدید"
        >
          <SquarePen :size="16" class="sb-action-icon" />
          <span class="sb-action-label">گفتگوی جدید</span>
        </button>

        <button class="sb-action-row" title="گفتگوی موقت">
          <MessageCircleDashed :size="16" class="sb-action-icon" />
          <span class="sb-action-label">موقت</span>
        </button>
      </nav>

      <!-- Divider -->
      <div class="sb-divider" />

      <!-- Chat History -->
      <div class="sb-chat-list">
        <p class="sb-section-label">گفتگوهای اخیر</p>

        <div class="sb-conversations">
          <!-- Loading skeleton state -->
          <div v-if="chatStore.isLoadingConversations && chatStore.conversations.length === 0" class="sb-skeleton-wrap">
            <div v-for="i in 5" :key="i" class="sb-skeleton-row">
              <div class="sb-skeleton-icon"></div>
              <div class="sb-skeleton-text"></div>
            </div>
          </div>

          <template v-else>
            <div
              v-for="conv in chatStore.conversations"
              :key="conv.id"
              :class="['sb-conv-item', { 'is-active': conv.id === chatStore.currentConversationId }]"
              @click="handleSelect(conv.id)"
            >
              <!-- Streaming indicator: pulsing dot when this conv is streaming in background -->
              <span
                v-if="chatStore.getConvIsStreaming(conv.id)"
                class="sb-conv-streaming-dot"
                title="در حال دریافت پاسخ..."
              />
              <MessageSquare v-else :size="13" class="sb-conv-icon" />
              <span class="sb-conv-title">{{ conv.title }}</span>

              <div class="sb-conv-actions">
                <button
                  class="sb-conv-btn"
                  @click="openEditModal($event, conv)"
                  title="ویرایش"
                >
                  <Pencil :size="11" />
                </button>
                <button
                  class="sb-conv-btn sb-conv-btn--danger"
                  @click="openDeleteModal($event, conv)"
                  title="حذف"
                >
                  <Trash2 :size="11" />
                </button>
              </div>
            </div>

            <!-- Load more conversations pagination button -->
            <button
              v-if="chatStore.hasMoreConversations"
              class="sb-load-more-btn"
              :disabled="chatStore.isLoadingConversations"
              @click="chatStore.loadMoreConversations"
            >
              <span v-if="chatStore.isLoadingConversations" class="sb-loading-spinner"></span>
              <span v-else>بارگذاری گفتگوهای بیشتر...</span>
            </button>

            <p v-if="chatStore.conversations.length === 0" class="sb-empty-hint">
              هنوز گفتگویی ندارید
            </p>
          </template>
        </div>
      </div>

      <!-- ─── Footer: Profile & Settings ─── -->
      <div class="sb-footer">
      

        <template v-if="authStore.isAuthenticated">
          <!-- Direct Admin Panel Link (Admin Only) -->
          
          <!-- Profile popup menu -->
          <ProfileMenu
            v-if="profileMenuOpen"
            @close="profileMenuOpen = false"
            @open-profile="openProfile"
            @open-settings="openSettings"
            @open-admin-panel="openAdminPanel"
            @open-logout="openLogoutModal"
          />

          <!-- Profile trigger button -->
          <button
            class="sb-profile-btn profile-trigger"
            :class="{ 'is-open': profileMenuOpen }"
            @click="toggleProfileMenu"
          >
            <img v-if="authStore.user?.avatarUrl" :src="authStore.user.avatarUrl" alt="" class="sb-avatar sb-avatar-image" />
            <div v-else class="sb-avatar">{{ userInitial }}</div>
            <div class="sb-user-info">
              <span class="sb-user-name">{{ authStore.user?.displayName || authStore.user?.email }}</span>
            </div>
            <ChevronUp :size="13" class="sb-chevron" :class="{ 'is-flipped': !profileMenuOpen }" />
          </button>
        </template>

        <router-link v-else to="/login" class="sb-login-btn">
          <LogIn :size="15" />
          <span>ورود / عضویت</span>
        </router-link>
      </div>
    </div>

    <!-- ═══════════════════════════════════
         COLLAPSED STATE (icon-only)
    ═══════════════════════════════════ -->
    <div v-else class="sidebar-collapsed">

      <!-- Logo in collapsed state -->
      <div class="sb-collapsed-logo" title="پروا">
        <img :src="activeLogo" alt="پروا" class="sb-brand-logo-img" />
      </div>

      <!-- Expand button -->
      <button
        class="sb-icon-btn sb-icon-btn--lg"
        title="باز کردن نوار کناری"
        @click="uiStore.toggleSidebar"
      >
        <component :is="SidebarExpandIcon" :size="17" />
      </button>

      <!-- Search -->
      <button class="sb-icon-btn sb-icon-btn--lg" @click="isSearchModalOpen = true" title="جستجو (Ctrl+K)">
        <Search :size="17" />
      </button>

      <!-- New Chat -->
      <button
        class="sb-icon-btn sb-icon-btn--lg sb-icon-btn--primary"
        :class="{ 'sb-icon-btn--disabled': isOnEmptyChat }"
        :disabled="isOnEmptyChat"
        @click="handleNewChat"
        title="گفتگوی جدید"
      >
        <SquarePen :size="17" />
      </button>

      <!-- Temporary Chat -->
      <button class="sb-icon-btn sb-icon-btn--lg" title="گفتگوی موقت">
        <MessageCircleDashed :size="17" />
      </button>

      <!-- Spacer -->
      <div class="sb-spacer" />

      <!-- Profile (collapsed) -->
      <div class="sb-collapsed-profile flex flex-col gap-2 items-center" v-if="authStore.isAuthenticated">
        <!-- Direct Admin Icon Link (collapsed) -->
        
        <!-- Profile popup (positioned to the left of icon in RTL) -->
        <div v-if="profileMenuOpen" class="sb-collapsed-menu-wrapper">
          <ProfileMenu
            @close="profileMenuOpen = false"
            @open-profile="openProfile"
            @open-settings="openSettings"
            @open-admin-panel="openAdminPanel"
            @open-logout="openLogoutModal"
          />
        </div>

        <button
          class="sb-avatar-btn profile-trigger"
          @click="toggleProfileMenu"
          :title="authStore.user?.displayName || 'پروفایل'"
        >
          <img v-if="authStore.user?.avatarUrl" :src="authStore.user.avatarUrl" alt="" class="sb-avatar sb-avatar-image" />
          <div v-else class="sb-avatar">{{ userInitial }}</div>
        </button>
      </div>
    </div>

  </aside>

  <!-- ─── Modals ─── -->
  <EditConversationModal
    :is-open="isEditModalOpen"
    :conversation="editingConversation"
    @close="isEditModalOpen = false"
    @save="handleSaveTitle"
  />
  <DeleteConversationModal
    :is-open="isDeleteModalOpen"
    :conversation="deletingConversation"
    @close="isDeleteModalOpen = false"
    @confirm="handleConfirmDelete"
  />
  <LogoutModal
    :is-open="isLogoutModalOpen"
    @close="isLogoutModalOpen = false"
    @confirm="handleConfirmLogout"
  />
  <SearchModal
    :is-open="isSearchModalOpen"
    @close="isSearchModalOpen = false"
  />
  <ProfileModal
    :is-open="isProfileModalOpen"
    @close="isProfileModalOpen = false"
  />
</template>

<style scoped>
/* ════════════════════════════════════════
   BACKDROP (mobile)
════════════════════════════════════════ */
.sidebar-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(2px);
  z-index: 30;
}
@media (min-width: 768px) { .sidebar-backdrop { display: none; } }

/* ════════════════════════════════════════
   SIDEBAR SHELL
════════════════════════════════════════ */
.app-sidebar {
  width: var(--sidebar-width, 260px);
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: var(--background);
  border-inline-end: 1px solid var(--border);
  flex-shrink: 0;
  overflow: hidden;
}

/* Mobile drawer behavior (< 768px) */
@media (max-width: 767px) {
  .app-sidebar {
    position: fixed !important;
    top: 0;
    bottom: 0;
    inset-inline-start: 0;
    width: min(76vw, 235px) !important;
    z-index: 50;
    transform: translateX(-100%) !important;
    transition: transform 280ms cubic-bezier(0.4, 0, 0.2, 1) !important;
    box-shadow: none;
  }

  .sidebar-expanded {
    width: 100% !important;
  }

  html[dir="rtl"] .app-sidebar {
    transform: translateX(100%) !important;
  }

  /* When open on mobile — slide in */
  .app-sidebar:not(.is-collapsed),
  html[dir="rtl"] .app-sidebar:not(.is-collapsed) {
    transform: translateX(0) !important;
    box-shadow: 0 0 40px rgba(0, 0, 0, 0.7) !important;
  }
}

/* Desktop layout (>= 768px): part of normal layout flow, no transform */
@media (min-width: 768px) {
  .app-sidebar {
    position: relative;
    z-index: 20;
    transform: none !important;
    transition: width 280ms cubic-bezier(0.4, 0, 0.2, 1);
  }

  /* Desktop collapsed: shrink width to icon-only */
  .app-sidebar.is-collapsed {
    width: var(--sidebar-collapsed-width, 56px);
  }
}

/* ════════════════════════════════════════
   EXPANDED LAYOUT
════════════════════════════════════════ */
.sidebar-expanded {
  width: var(--sidebar-width, 260px);
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 10px 0;
  overflow: hidden;
}

/* Top row */
.sb-top-row {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 2px 12px 10px;
  flex-shrink: 0;
}

.sb-brand {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 8px;
  pointer-events: none;
}

.sb-brand-logo {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.sb-brand-logo-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.sb-brand-name {
  font-family: var(--font-brand);
  font-size: 19px;
  font-weight: 700;
  color: var(--foreground);
  letter-spacing: 0.08em;
  white-space: nowrap;
}

/* ────────────── Action Buttons ────────────── */
.sb-actions {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 0 8px;
  flex-shrink: 0;
}

.sb-action-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 10px;
  border-radius: var(--radius-sm, 8px);
  background: transparent;
  border: none;
  color: var(--secondary-foreground, #A0A0B8);
  font-size: 13px;
  font-weight: 500;
  font-family: var(--font-sans);
  cursor: pointer;
  transition: background-color 150ms ease, color 150ms ease;
  width: 100%;
  text-align: start;
}

.sb-action-row:hover {
  background-color: var(--surface-alt, var(--secondary));
  color: var(--foreground);
}

.sb-action-icon {
  flex-shrink: 0;
  color: var(--muted-foreground);
  transition: color 150ms ease;
}

.sb-action-row:hover .sb-action-icon {
  color: var(--primary);
}

/* Primary action (New Chat) — subtle tint */
.sb-action-row--primary {
  color: var(--foreground);
}

.sb-action-row--primary .sb-action-icon {
  color: var(--primary);
}

.sb-action-row--primary:hover {
  background-color: color-mix(in srgb, var(--primary) 12%, transparent);
  color: var(--primary);
}

.sb-action-label {
  flex: 1;
}

/* Disabled state */
.sb-action-row--disabled,
.sb-action-row--disabled:hover,
.sb-icon-btn--disabled,
.sb-icon-btn--disabled:hover {
  opacity: 0.35;
  cursor: not-allowed;
}

/* ────────────── Divider ────────────── */
.sb-divider {
  height: 1px;
  background: var(--border);
  margin: 8px 12px;
  flex-shrink: 0;
}

/* ────────────── Chat List ────────────── */
.sb-chat-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0 8px;
  display: flex;
  flex-direction: column;
}

.sb-chat-list::-webkit-scrollbar { width: 3px; }
.sb-chat-list::-webkit-scrollbar-thumb { background: transparent; border-radius: 3px; }
.sb-chat-list:hover::-webkit-scrollbar-thumb { background: var(--border); }

.sb-section-label {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--muted-foreground);
  padding: 4px 4px 6px;
  letter-spacing: 0.06em;
  flex-shrink: 0;
}

.sb-conversations {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.sb-conv-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 8px;
  border-radius: var(--radius-sm, 8px);
  cursor: pointer;
  color: var(--secondary-foreground, #A0A0B8);
  transition: background-color 150ms ease, color 150ms ease;
  position: relative;
}

.sb-conv-item:hover {
  background-color: var(--surface-alt, var(--secondary));
  color: var(--foreground);
}

.sb-conv-item.is-active {
  background-color: var(--surface-alt, var(--secondary));
  color: var(--foreground);
  font-weight: 500;
}

.sb-conv-icon {
  flex-shrink: 0;
  color: var(--muted-foreground);
}

.sb-conv-title {
  flex: 1;
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sb-conv-actions {
  display: flex;
  gap: 2px;
  opacity: 0;
  transition: opacity 150ms ease;
  flex-shrink: 0;
}

.sb-conv-item:hover .sb-conv-actions,
.sb-conv-item.is-active .sb-conv-actions {
  opacity: 1;
}

.sb-conv-btn {
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  border: none;
  background: transparent;
  cursor: pointer;
  color: var(--muted-foreground);
  transition: background-color 150ms ease, color 150ms ease;
}

.sb-conv-btn:hover {
  background-color: var(--card);
  color: var(--foreground);
}

.sb-conv-btn--danger:hover {
  background-color: rgba(239, 68, 68, 0.15);
  color: #f87171;
}

.sb-empty-hint {
  font-size: 12px;
  color: var(--muted-foreground);
  text-align: center;
  padding: 20px 8px;
}

/* ────────────── Skeleton Loader & Pagination ────────────── */
.sb-skeleton-wrap {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 4px 0;
}

.sb-skeleton-row {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 36px;
  padding: 0 10px;
  border-radius: var(--radius-md, 8px);
  background: color-mix(in srgb, var(--muted) 40%, transparent);
  animation: sb-pulse 1.6s ease-in-out infinite;
}

.sb-skeleton-icon {
  width: 14px;
  height: 14px;
  border-radius: 4px;
  background: color-mix(in srgb, var(--muted-foreground) 25%, transparent);
  flex-shrink: 0;
}

.sb-skeleton-text {
  flex: 1;
  height: 12px;
  border-radius: 4px;
  background: color-mix(in srgb, var(--muted-foreground) 20%, transparent);
}

@keyframes sb-pulse {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 0.9; }
}

.sb-load-more-btn {
  width: 100%;
  padding: 7px 10px;
  margin-top: 6px;
  font-size: 11.5px;
  font-weight: 500;
  color: var(--muted-foreground);
  background: color-mix(in srgb, var(--muted) 35%, transparent);
  border: 1px dashed var(--border);
  border-radius: var(--radius-md, 8px);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}

.sb-load-more-btn:hover:not(:disabled) {
  background: color-mix(in srgb, var(--primary) 10%, transparent);
  color: var(--primary);
  border-color: var(--primary);
}

.sb-load-more-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.sb-loading-spinner {
  width: 13px;
  height: 13px;
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ────────────── Footer ────────────── */
.sb-footer {
  flex-shrink: 0;
  padding: 8px 10px 10px;
  border-top: 1px solid var(--border);
  position: relative;
  margin-top: auto;
}

.sb-footer-settings-btn {
  margin-bottom: 5px;
  border-radius: var(--radius-sm, 8px);
}

.sb-footer-theme-tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 6px;
  background-color: var(--surface-alt, var(--secondary));
  color: var(--muted-foreground);
  border: 1px solid var(--border);
  transition: all 150ms ease;
}

.sb-footer-settings-btn:hover .sb-footer-theme-tag {
  color: var(--primary);
  border-color: var(--primary);
}

/* Profile trigger */
.sb-profile-btn {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  border-radius: var(--radius-sm, 8px);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: background-color 150ms ease;
}

.sb-profile-btn:hover,
.sb-profile-btn.is-open {
  background-color: var(--surface-alt, var(--secondary));
}

.sb-avatar {
  width: 32px;
  height: 32px;
  flex: 0 0 32px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--primary), var(--primary-hover, #839BFF));
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.sb-avatar-image {
  object-fit: cover;
}

.sb-user-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  text-align: start;
}

.sb-user-name {
  font-size: 12px;
  font-weight: 500;
  color: var(--foreground);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sb-user-role {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--primary);
}

.sb-chevron {
  color: var(--muted-foreground);
  flex-shrink: 0;
  transition: transform 200ms ease;
}

.sb-chevron.is-flipped {
  transform: rotate(180deg);
}

.sb-login-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 9px 10px;
  border-radius: var(--radius-sm, 8px);
  background-color: var(--surface-alt, var(--secondary));
  color: var(--foreground);
  font-size: 13px;
  font-weight: 500;
  text-decoration: none;
  transition: background-color 150ms ease;
}

.sb-login-btn:hover {
  background-color: color-mix(in srgb, var(--primary) 12%, var(--surface-alt, var(--secondary)));
}

/* ════════════════════════════════════════
   COLLAPSED LAYOUT
════════════════════════════════════════ */
.sidebar-collapsed {
  width: var(--sidebar-collapsed-width, 56px);
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10px 0 12px;
  gap: 4px;
}

.sb-collapsed-logo {
  width: 32px;
  height: 32px;
  margin-bottom: 6px;
  flex-shrink: 0;
}

.sb-spacer { flex: 1; }

/* Icon buttons */
.sb-icon-btn {
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm, 8px);
  border: none;
  background: transparent;
  color: var(--secondary-foreground, #A0A0B8);
  cursor: pointer;
  transition: background-color 150ms ease, color 150ms ease;
  flex-shrink: 0;
}

.sb-icon-btn:hover {
  background-color: var(--surface-alt, var(--secondary));
  color: var(--foreground);
}

.sb-icon-btn--lg {
  width: 40px;
  height: 40px;
}

.sb-icon-btn--primary {
  color: var(--primary);
  background-color: color-mix(in srgb, var(--primary) 12%, transparent);
}

.sb-icon-btn--primary:hover {
  background-color: var(--primary);
  color: #fff;
}

/* Collapsed profile */
.sb-collapsed-profile {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  padding-top: 8px;
  border-top: 1px solid var(--border);
}

.sb-avatar-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: none;
  background: transparent;
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: box-shadow 150ms ease;
}

.sb-avatar-btn:hover {
  box-shadow: 0 0 0 2px var(--ring);
}

/* Collapsed profile menu wrapper — appears to the right of the sidebar (outside of it) */
.sb-collapsed-menu-wrapper {
  position: fixed;
  bottom: 60px;
  /* LTR: right of sidebar at 56px + 8px gap */
  inset-inline-start: calc(var(--sidebar-collapsed-width, 56px) + 8px);
  width: 210px;
  z-index: 200;
}

.sb-collapsed-menu-wrapper .profile-menu-panel {
  position: static;
  box-shadow:
    0 4px 24px rgba(0, 0, 0, 0.35),
    0 1px 4px rgba(0, 0, 0, 0.2);
}

/* ════════════════════════════════════════
   STREAMING DOT — background conv indicator
════════════════════════════════════════ */
.sb-conv-streaming-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  min-width: 8px;
  border-radius: 50%;
  background-color: var(--primary);
  animation: stream-pulse 1.1s ease-in-out infinite;
  flex-shrink: 0;
}

@keyframes stream-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%       { opacity: 0.4; transform: scale(0.75); }
}

/* ════════════════════════════════════════
   ADMIN DIRECT LINK
════════════════════════════════════════ */
.sb-admin-direct-link {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  margin-bottom: 6px;
  border-radius: 9px;
  background-color: rgba(245, 158, 11, 0.08);
  border: 1px solid rgba(245, 158, 11, 0.22);
  color: var(--foreground);
  font-size: 12px;
  font-weight: 500;
  text-decoration: none;
  transition: all 150ms ease;
  cursor: pointer;
}

.sb-admin-direct-link:hover {
  background-color: rgba(245, 158, 11, 0.16);
  border-color: rgba(245, 158, 11, 0.45);
}

.sb-admin-link-text {
  flex: 1;
}

.sb-admin-badge {
  font-size: 9px;
  font-weight: 700;
  padding: 1px 4.5px;
  border-radius: 4px;
  background-color: #f59e0b;
  color: #111;
}

.sb-admin-icon-btn {
  color: #f59e0b;
  background-color: rgba(245, 158, 11, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.25);
}

.sb-admin-icon-btn:hover {
  background-color: rgba(245, 158, 11, 0.2);
  color: #f59e0b;
}

</style>
