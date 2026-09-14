<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppHeader from '../components/layout/AppHeader.vue'
import AppSidebar from '../components/layout/AppSidebar.vue'
import MessageList from '../components/chat/MessageList.vue'
import ChatComposer from '../components/chat/ChatComposer.vue'
import ModelsModal from '../components/admin/ModelsModal.vue'
import SettingsModal from '../components/layout/SettingsModal.vue'
import GrokAurora from '../components/ui/GrokAurora.vue'
import NetworkStatusBanner from '../components/chat/NetworkStatusBanner.vue'
import { useChatStore } from '../stores/chat'
import { useModelsStore } from '../stores/models'
import { useUiStore } from '../stores/ui'

const route = useRoute()
const router = useRouter()
const chatStore = useChatStore()
const modelsStore = useModelsStore()
const uiStore = useUiStore()
const isEntering = ref(true)

async function initChat() {
  const routeId = route.params.id as string | undefined
  await modelsStore.fetchModels()
  await chatStore.loadConversations(routeId)

  if (routeId) {
    if (chatStore.currentConversationId !== routeId) {
      await chatStore.selectConversation(routeId)
    }
  } else if (chatStore.currentConversationId) {
    router.replace(`/chat/${chatStore.currentConversationId}`)
  }
}

onMounted(async () => {
  uiStore.initNetworkListeners()
  await initChat()
  setTimeout(() => {
    isEntering.value = false
  }, 3500)
})

// Sync conversation when route param ID changes (e.g. browser back/forward or direct navigation)
watch(
  () => route.params.id,
  async (newId) => {
    if (newId && typeof newId === 'string' && newId !== chatStore.currentConversationId) {
      await chatStore.selectConversation(newId)
    }
  }
)

// Sync route when store conversation ID changes (e.g. conversation created or clicked)
watch(
  () => chatStore.currentConversationId,
  (newId) => {
    if (newId && route.params.id !== newId) {
      router.push(`/chat/${newId}`)
    }
  }
)
</script>

<template>
  <div class="chat-layout relative overflow-hidden">
    <!-- Grok Fluid Aurora Animated Background on Entrance -->
    <GrokAurora :intensity="isEntering ? 'vibrant' : 'subtle'" class="transition-opacity duration-1000 z-0" />

    <!-- Top Bar -->
    <AppHeader class="relative z-10" />

    <!-- Network Status Indicator -->
    <NetworkStatusBanner class="relative z-10" />

    <!-- Main Workspace Container -->
    <div class="workspace-body relative z-10">
      <!-- Left / Right Collapsible Sidebar -->
      <AppSidebar />

      <!-- Center Chat Area -->
      <main class="chat-viewport">
        <!-- Message History / Empty State Area -->
        <MessageList />

        <!-- Fixed Bottom Composer Area -->
        <ChatComposer />
      </main>
    </div>

    <!-- Modals -->
    <ModelsModal />
    <SettingsModal />
  </div>
</template>

<style scoped>
.chat-layout {
  display: flex;
  flex-direction: column;
  width: 100vw;
  height: 100vh;
  background-color: var(--background);
  color: var(--foreground);
  overflow: hidden;
}

.workspace-body {
  display: flex;
  flex: 1;
  width: 100%;
  height: calc(100vh - var(--header-height));
  overflow: hidden;
  position: relative;
}

.chat-viewport {
  display: flex;
  flex-direction: column;
  flex: 1;
  height: 100%;
  position: relative;
  overflow: hidden;
  background-color: transparent;
}
</style>
