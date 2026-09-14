<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useUiStore } from '../../stores/ui'
import { useChatStore } from '../../stores/chat'
import { useAuthStore } from '../../stores/auth'
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

async function handleNewChat() {
  const newId = await chatStore.createNewConversation()
  if (newId) {
    router.push(`/chat/${newId}`)
  }
}

function handleSelect(id: string) {
  chatStore.selectConversation(id)
  if (router.currentRoute.value.params.id !== id) {
    router.push(`/chat/${id}`)
  }
}

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
    uiStore.showToast(
      uiStore.direction === 'rtl' ? 'عنوان گفتگو با موفقیت ویرایش شد.' : 'Conversation title updated successfully.',
      'success'
    )
  } catch (err: any) {
    uiStore.showToast(
      err?.message || (uiStore.direction === 'rtl' ? 'خطا در ویرایش عنوان گفتگو' : 'Failed to update conversation title'),
      'error'
    )
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
    uiStore.showToast(
      uiStore.direction === 'rtl' ? 'گفتگو با موفقیت حذف شد.' : 'Conversation deleted successfully.',
      'success'
    )
  } catch (err: any) {
    uiStore.showToast(
      err?.message || (uiStore.direction === 'rtl' ? 'خطا در حذف گفتگو' : 'Failed to delete conversation'),
      'error'
    )
  }
}

function openLogoutModal() {
  isLogoutModalOpen.value = true
}

async function handleConfirmLogout() {
  try {
    await authStore.logout()
    isLogoutModalOpen.value = false
    router.push('/login')
    uiStore.showToast(
      uiStore.direction === 'rtl' ? 'با موفقیت از حساب کاربری خارج شدید.' : 'Successfully logged out.',
      'info'
    )
  } catch (err: any) {
    uiStore.showToast(
      err?.message || (uiStore.direction === 'rtl' ? 'خطا در خروج از حساب' : 'Logout failed'),
      'error'
    )
  }
}

const userInitial = computed(() => {
  if (authStore.user?.displayName) return authStore.user.displayName.charAt(0).toUpperCase()
  if (authStore.user?.email) return authStore.user.email.charAt(0).toUpperCase()
  return 'U'
})
</script>

<template>
  <!-- Mobile Backdrop -->
  <div 
    v-if="uiStore.sidebarOpen"
    class="sidebar-backdrop md:hidden"
    @click="uiStore.sidebarOpen = false"
  ></div>

  <aside :class="['app-sidebar', { collapsed: !uiStore.sidebarOpen }]">
    <div class="sidebar-inner">
      <!-- Logo & Brand Header -->
      <div class="brand-section">
        <div class="brand-logo">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2C6.477 2 2 6.477 2 12C2 17.523 6.477 22 12 22C17.523 22 22 17.523 22 12C22 6.477 17.523 2 12 2Z" fill="#ffffff" fill-opacity="0.2"/>
            <path d="M12 6V18M6 12H18" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round"/>
          </svg>
        </div>
        <div class="brand-info">
          <span class="brand-title">NeuralChat</span>
          <span class="brand-badge font-mono">v1.0.0</span>
        </div>
      </div>

      <!-- New Chat Button -->
      <div class="new-chat-wrapper">
        <button class="new-chat-btn" @click="handleNewChat">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          <span>{{ uiStore.direction === 'rtl' ? 'گفتگوی جدید' : 'New Chat' }}</span>
        </button>
      </div>

      <!-- Chat History Section -->
      <div class="chat-list-section">
        <div class="section-label font-mono">
          {{ uiStore.direction === 'rtl' ? 'گفتگوهای اخیر' : 'RECENT CHATS' }}
        </div>

        <div class="chat-items-container">
          <div
            v-for="conv in chatStore.conversations"
            :key="conv.id"
            :class="['chat-item', { active: conv.id === chatStore.currentConversationId }]"
            @click="handleSelect(conv.id)"
          >
            <svg class="chat-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
            <span class="chat-title">{{ conv.title }}</span>

            <div class="chat-actions">
              <button
                class="action-chat-btn edit-chat-btn"
                @click="openEditModal($event, conv)"
                :title="uiStore.direction === 'rtl' ? 'ویرایش عنوان گفتگو' : 'Edit conversation title'"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
                </svg>
              </button>

              <button
                class="action-chat-btn delete-chat-btn"
                @click="openDeleteModal($event, conv)"
                :title="uiStore.direction === 'rtl' ? 'حذف گفتگو' : 'Delete chat'"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                  <line x1="10" y1="11" x2="10" y2="17"/>
                  <line x1="14" y1="11" x2="14" y2="17"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Bottom User Block -->
      <div class="sidebar-footer">
        <template v-if="authStore.isAuthenticated">
          <div class="user-card">
            <div class="user-avatar">
              {{ userInitial }}
            </div>
            <div class="user-details">
              <span class="user-name">{{ authStore.user?.displayName || authStore.user?.email }}</span>
              <span v-if="authStore.isAdmin" class="user-role font-mono">Admin</span>
            </div>
          </div>
          <button
            class="logout-footer-btn"
            @click="openLogoutModal"
            :title="uiStore.direction === 'rtl' ? 'خروج از حساب کاربری' : 'Sign out'"
            aria-label="Logout"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            <span>{{ uiStore.direction === 'rtl' ? 'خروج از حساب' : 'Sign Out' }}</span>
          </button>
        </template>
        <template v-else>
          <router-link to="/login" class="footer-login-btn">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
              <polyline points="10 17 15 12 10 7"/>
              <line x1="15" y1="12" x2="3" y2="12"/>
            </svg>
            <span>{{ uiStore.direction === 'rtl' ? 'ورود / عضویت' : 'Sign In / Register' }}</span>
          </router-link>
        </template>
      </div>
    </div>
  </aside>

  <!-- Edit & Delete Modals -->
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

  <!-- Logout Confirmation Modal -->
  <LogoutModal
    :is-open="isLogoutModalOpen"
    @close="isLogoutModalOpen = false"
    @confirm="handleConfirmLogout"
  />
</template>

<style scoped>
.sidebar-backdrop {
  position: fixed;
  top: var(--header-height);
  inset-inline: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(2px);
  z-index: 30; /* Below sidebar (40) and header (50) */
}

@media (min-width: 768px) {
  .sidebar-backdrop {
    display: none;
  }
}

.app-sidebar {
  width: var(--sidebar-width);
  height: 100%;
  background-color: var(--background);
  border-inline-end: 1px solid var(--border);
  transition: width 300ms ease-in-out, transform 300ms ease-in-out;
  flex-shrink: 0;
  overflow: hidden;
  position: absolute;
  top: 0;
  bottom: 0;
  inset-inline-start: 0;
  z-index: 40;
}

@media (min-width: 768px) {
  .app-sidebar {
    position: relative;
    z-index: 20;
  }
}

.app-sidebar.collapsed {
  width: 0;
  border-inline-end: none;
}

.sidebar-inner {
  width: var(--sidebar-width);
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 12px;
}

.brand-section {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 8px 14px;
}

.brand-logo {
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm);
  background-color: var(--primary);
  display: flex;
  align-items: center;
  justify-content: center;
}

.brand-info {
  display: flex;
  align-items: center;
  gap: 6px;
}

.brand-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--foreground);
  letter-spacing: -0.01em;
}

.brand-badge {
  font-size: 10px;
  padding: 1px 5px;
  background-color: var(--secondary);
  color: var(--muted-foreground);
  border-radius: 4px;
}

.new-chat-wrapper {
  margin-bottom: 16px;
}

.new-chat-btn {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background-color: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  font-size: 13px;
  font-weight: 500;
  color: var(--foreground);
}

.new-chat-btn:hover {
  background-color: var(--secondary);
  border-color: var(--muted-foreground);
}

.chat-list-section {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.section-label {
  font-size: 10px;
  color: var(--muted-foreground);
  padding: 4px 8px 8px;
  letter-spacing: 0.05em;
}

.chat-items-container {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.chat-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  color: var(--secondary-foreground);
  transition: all 150ms ease;
  position: relative;
}

.chat-item:hover {
  background-color: var(--secondary);
  color: var(--foreground);
}

.chat-item.active {
  background-color: var(--secondary);
  color: var(--foreground);
  font-weight: 500;
}

.chat-icon {
  flex-shrink: 0;
  color: var(--muted-foreground);
}

.chat-title {
  flex: 1;
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chat-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  opacity: 0;
  transition: opacity 150ms ease;
  flex-shrink: 0;
}

.chat-item:hover .chat-actions,
.chat-item.active .chat-actions {
  opacity: 1;
}

.action-chat-btn {
  width: 24px;
  height: 24px;
  border-radius: 5px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid transparent;
  background-color: transparent;
  cursor: pointer;
  transition: all 150ms ease;
}

/* Light Mode Defaults */
.action-chat-btn.edit-chat-btn {
  color: #64748b;
}

.action-chat-btn.edit-chat-btn:hover {
  background-color: #ffffff;
  color: #0f172a;
  border-color: #cbd5e1;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.action-chat-btn.delete-chat-btn {
  color: #94a3b8;
}

.action-chat-btn.delete-chat-btn:hover {
  background-color: #fee2e2;
  color: #dc2626;
  border-color: #fca5a5;
  box-shadow: 0 1px 3px rgba(239, 68, 68, 0.15);
}

/* Dark Mode Overrides */
:global(.dark) .action-chat-btn.edit-chat-btn,
:global([data-theme="dark"]) .action-chat-btn.edit-chat-btn {
  color: #9ca3af;
}

:global(.dark) .action-chat-btn.edit-chat-btn:hover,
:global([data-theme="dark"]) .action-chat-btn.edit-chat-btn:hover {
  background-color: #1e202d;
  color: #f3f4f6;
  border-color: #3b4261;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
}

:global(.dark) .action-chat-btn.delete-chat-btn,
:global([data-theme="dark"]) .action-chat-btn.delete-chat-btn {
  color: #9ca3af;
}

:global(.dark) .action-chat-btn.delete-chat-btn:hover,
:global([data-theme="dark"]) .action-chat-btn.delete-chat-btn:hover {
  background-color: rgba(239, 68, 68, 0.18);
  color: #f87171;
  border-color: rgba(239, 68, 68, 0.4);
  box-shadow: 0 1px 4px rgba(239, 68, 68, 0.2);
}

.sidebar-footer {
  padding-top: 12px;
  border-top: 1px solid var(--border);
  margin-top: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.user-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 8px;
  border-radius: var(--radius);
  background-color: var(--card);
  border: 1px solid var(--border);
}

.user-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--primary), #a78bfa);
  color: #ffffff;
  font-weight: bold;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.user-details {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  flex: 1;
}

.logout-footer-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 7px 12px;
  border-radius: var(--radius);
  background-color: transparent;
  border: 1px solid var(--border);
  color: var(--muted-foreground);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 150ms ease;
}

.logout-footer-btn:hover {
  color: #ef4444;
  background-color: rgba(239, 68, 68, 0.08);
  border-color: rgba(239, 68, 68, 0.25);
}

:global(.dark) .logout-footer-btn:hover,
:global([data-theme="dark"]) .logout-footer-btn:hover {
  color: #f87171;
  background-color: rgba(239, 68, 68, 0.16);
  border-color: rgba(239, 68, 68, 0.35);
}

.user-name {
  font-size: 12px;
  font-weight: 500;
  color: var(--foreground);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-role {
  font-size: 10px;
  color: var(--primary);
}

.footer-login-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: var(--radius);
  background-color: var(--secondary);
  border: 1px solid var(--border);
  font-size: 12px;
  color: var(--foreground);
}

.footer-login-btn:hover {
  border-color: var(--primary);
}
</style>
