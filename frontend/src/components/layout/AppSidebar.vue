<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import {
  PanelLeftClose,
  PanelLeftOpen,
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
import ProfileMenu from './ProfileMenu.vue'
import EditConversationModal from '../chat/EditConversationModal.vue'
import DeleteConversationModal from '../chat/DeleteConversationModal.vue'
import LogoutModal from '../auth/LogoutModal.vue'
import type { Conversation } from '../../types'

const router = useRouter()
const uiStore = useUiStore()
const chatStore = useChatStore()
const authStore = useAuthStore()

const editingConversation = ref<Conversation | null>(null)
const isEditModalOpen = ref(false)

const deletingConversation = ref<Conversation | null>(null)
const isDeleteModalOpen = ref(false)

const isLogoutModalOpen = ref(false)
const profileMenuOpen = ref(false)

const isRtl = computed(() => uiStore.direction === 'rtl')

// ──────────────────────────────────────────
// Navigation actions
// ──────────────────────────────────────────
async function handleNewChat() {
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
    uiStore.showToast(isRtl.value ? 'عنوان ویرایش شد.' : 'Title updated.', 'success')
  } catch (err: any) {
    uiStore.showToast(err?.message || 'Failed to update title', 'error')
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
    uiStore.showToast(isRtl.value ? 'گفتگو حذف شد.' : 'Conversation deleted.', 'success')
  } catch (err: any) {
    uiStore.showToast(err?.message || 'Failed to delete conversation', 'error')
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

function openAdminPanel() {
  uiStore.openAdminModels()
  profileMenuOpen.value = false
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
    uiStore.showToast(isRtl.value ? 'با موفقیت خارج شدید.' : 'Signed out.', 'info')
  } catch (err: any) {
    uiStore.showToast(err?.message || 'Logout failed', 'error')
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

      <!-- Top: Brand + Collapse -->
      <div class="sb-top-row">
        <div class="sb-brand">
          <div class="sb-brand-logo">
            <span class="sb-brand-initial">N</span>
          </div>
          <span class="sb-brand-name">NeuralChat</span>
        </div>
        <button
          class="sb-icon-btn"
          :title="isRtl ? 'بستن نوار کناری' : 'Collapse sidebar'"
          @click="uiStore.toggleSidebar"
        >
          <PanelLeftClose :size="17" />
        </button>
      </div>

      <!-- Actions: Search / New Chat / Temp Chat — stacked vertically -->
      <nav class="sb-actions">
        <button class="sb-action-row" :title="isRtl ? 'جستجو' : 'Search chats'">
          <Search :size="16" class="sb-action-icon" />
          <span class="sb-action-label">{{ isRtl ? 'جستجو' : 'Search' }}</span>
        </button>

        <button class="sb-action-row sb-action-row--primary" @click="handleNewChat" :title="isRtl ? 'گفتگوی جدید' : 'New chat'">
          <SquarePen :size="16" class="sb-action-icon" />
          <span class="sb-action-label">{{ isRtl ? 'گفتگوی جدید' : 'New chat' }}</span>
        </button>

        <button class="sb-action-row" :title="isRtl ? 'گفتگوی موقت' : 'Temporary chat'">
          <MessageCircleDashed :size="16" class="sb-action-icon" />
          <span class="sb-action-label">{{ isRtl ? 'موقت' : 'Temporary' }}</span>
        </button>
      </nav>

      <!-- Divider -->
      <div class="sb-divider" />

      <!-- Chat History -->
      <div class="sb-chat-list">
        <p class="sb-section-label">{{ isRtl ? 'گفتگوهای اخیر' : 'RECENT' }}</p>

        <div class="sb-conversations">
          <div
            v-for="conv in chatStore.conversations"
            :key="conv.id"
            :class="['sb-conv-item', { 'is-active': conv.id === chatStore.currentConversationId }]"
            @click="handleSelect(conv.id)"
          >
            <MessageSquare :size="13" class="sb-conv-icon" />
            <span class="sb-conv-title">{{ conv.title }}</span>

            <div class="sb-conv-actions">
              <button
                class="sb-conv-btn"
                @click="openEditModal($event, conv)"
                :title="isRtl ? 'ویرایش' : 'Edit'"
              >
                <Pencil :size="11" />
              </button>
              <button
                class="sb-conv-btn sb-conv-btn--danger"
                @click="openDeleteModal($event, conv)"
                :title="isRtl ? 'حذف' : 'Delete'"
              >
                <Trash2 :size="11" />
              </button>
            </div>
          </div>

          <p v-if="chatStore.conversations.length === 0" class="sb-empty-hint">
            {{ isRtl ? 'هنوز گفتگویی ندارید' : 'No conversations yet' }}
          </p>
        </div>
      </div>

      <!-- ─── Footer: Profile ─── -->
      <div class="sb-footer">
        <template v-if="authStore.isAuthenticated">
          <!-- Profile popup menu -->
          <ProfileMenu
            v-if="profileMenuOpen"
            @close="profileMenuOpen = false"
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
            <div class="sb-avatar">{{ userInitial }}</div>
            <div class="sb-user-info">
              <span class="sb-user-name">{{ authStore.user?.displayName || authStore.user?.email }}</span>
              <span v-if="authStore.isAdmin" class="sb-user-role">Admin</span>
            </div>
            <ChevronUp :size="13" class="sb-chevron" :class="{ 'is-flipped': !profileMenuOpen }" />
          </button>
        </template>

        <router-link v-else to="/login" class="sb-login-btn">
          <LogIn :size="15" />
          <span>{{ isRtl ? 'ورود / عضویت' : 'Sign In' }}</span>
        </router-link>
      </div>
    </div>

    <!-- ═══════════════════════════════════
         COLLAPSED STATE (icon-only)
    ═══════════════════════════════════ -->
    <div v-else class="sidebar-collapsed">

      <!-- Expand button -->
      <button
        class="sb-icon-btn sb-icon-btn--lg"
        :title="isRtl ? 'باز کردن نوار کناری' : 'Expand sidebar'"
        @click="uiStore.toggleSidebar"
      >
        <PanelLeftOpen :size="17" />
      </button>

      <!-- Search -->
      <button class="sb-icon-btn sb-icon-btn--lg" :title="isRtl ? 'جستجو' : 'Search'">
        <Search :size="17" />
      </button>

      <!-- New Chat -->
      <button
        class="sb-icon-btn sb-icon-btn--lg sb-icon-btn--primary"
        @click="handleNewChat"
        :title="isRtl ? 'گفتگوی جدید' : 'New chat'"
      >
        <SquarePen :size="17" />
      </button>

      <!-- Temporary Chat -->
      <button class="sb-icon-btn sb-icon-btn--lg" :title="isRtl ? 'گفتگوی موقت' : 'Temporary'">
        <MessageCircleDashed :size="17" />
      </button>

      <!-- Spacer -->
      <div class="sb-spacer" />

      <!-- Profile (collapsed) -->
      <div class="sb-collapsed-profile" v-if="authStore.isAuthenticated">
        <!-- Profile popup (positioned to the right of icon in LTR, left in RTL) -->
        <div v-if="profileMenuOpen" class="sb-collapsed-menu-wrapper">
          <ProfileMenu
            @close="profileMenuOpen = false"
            @open-settings="openSettings"
            @open-admin-panel="openAdminPanel"
            @open-logout="openLogoutModal"
          />
        </div>

        <button
          class="sb-avatar-btn profile-trigger"
          @click="toggleProfileMenu"
          :title="authStore.user?.displayName || 'Profile'"
        >
          <div class="sb-avatar">{{ userInitial }}</div>
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
  transition: width 280ms cubic-bezier(0.4, 0, 0.2, 1);
  flex-shrink: 0;
  overflow: hidden;
  position: absolute;
  inset-block: 0;
  inset-inline-start: 0;
  z-index: 40;
}

@media (min-width: 768px) {
  .app-sidebar { position: relative; z-index: 20; }
}

.app-sidebar.is-collapsed {
  width: var(--sidebar-collapsed-width, 56px);
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
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 2px 12px 10px;
  flex-shrink: 0;
}

.sb-brand {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sb-brand-logo {
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm, 8px);
  background: var(--primary);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.sb-brand-initial {
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  line-height: 1;
}

.sb-brand-name {
  font-size: 14px;
  font-weight: 700;
  color: var(--foreground);
  letter-spacing: -0.01em;
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

/* ────────────── Footer ────────────── */
.sb-footer {
  flex-shrink: 0;
  padding: 8px 10px 10px;
  border-top: 1px solid var(--border);
  position: relative;
  margin-top: auto;
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
  width: 30px;
  height: 30px;
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

/* Collapsed profile menu wrapper — slides out to the right of the sidebar */
.sb-collapsed-menu-wrapper {
  position: absolute;
  bottom: 0;
  inset-inline-end: calc(-1 * (180px + 12px));
  width: 200px;
}

.sb-collapsed-menu-wrapper :deep(.profile-menu-panel) {
  position: static;
  box-shadow:
    0 4px 24px rgba(0, 0, 0, 0.35),
    0 1px 4px rgba(0, 0, 0, 0.2);
}
</style>
