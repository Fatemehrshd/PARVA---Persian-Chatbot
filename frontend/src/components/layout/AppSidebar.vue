<script setup lang="ts">
import { computed } from 'vue'
import { useUiStore } from '../../stores/ui'
import { useChatStore } from '../../stores/chat'
import { useAuthStore } from '../../stores/auth'

const uiStore = useUiStore()
const chatStore = useChatStore()
const authStore = useAuthStore()

function handleNewChat() {
  chatStore.createNewConversation()
}

function handleSelect(id: string) {
  chatStore.selectConversation(id)
}

function handleDelete(event: Event, id: string) {
  event.stopPropagation()
  chatStore.deleteConversation(id)
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
          <span class="brand-badge font-mono">v0.1</span>
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

            <button
              class="delete-chat-btn"
              @click="handleDelete($event, conv.id)"
              :title="uiStore.direction === 'rtl' ? 'حذف گفتگو' : 'Delete chat'"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
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
</template>

<style scoped>
.sidebar-backdrop {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(2px);
  z-index: 30; /* Below sidebar (40) but above content */
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

.delete-chat-btn {
  opacity: 0;
  color: var(--muted-foreground);
  padding: 2px 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 150ms ease, color 150ms ease;
}

.chat-item:hover .delete-chat-btn {
  opacity: 1;
}

.delete-chat-btn:hover {
  color: #ef4444;
  background-color: rgba(239, 68, 68, 0.1);
}

.sidebar-footer {
  padding-top: 12px;
  border-top: 1px solid var(--border);
  margin-top: auto;
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
