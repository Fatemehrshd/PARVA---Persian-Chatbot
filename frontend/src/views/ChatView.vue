<script setup lang="ts">
import { onMounted } from 'vue'
import AppHeader from '../components/layout/AppHeader.vue'
import AppSidebar from '../components/layout/AppSidebar.vue'
import MessageList from '../components/chat/MessageList.vue'
import ChatComposer from '../components/chat/ChatComposer.vue'
import ModelsModal from '../components/admin/ModelsModal.vue'
import { useChatStore } from '../stores/chat'
import { useModelsStore } from '../stores/models'

const chatStore = useChatStore()
const modelsStore = useModelsStore()

onMounted(async () => {
  await modelsStore.fetchModels()
  await chatStore.loadConversations()
})
</script>

<template>
  <div class="chat-layout">
    <!-- Top Bar -->
    <AppHeader />

    <!-- Main Workspace Container -->
    <div class="workspace-body">
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
  background-color: var(--background);
}
</style>
