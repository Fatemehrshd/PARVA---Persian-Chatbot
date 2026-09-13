<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useModelsStore } from '../stores/models'
import { useUiStore } from '../stores/ui'

const router = useRouter()
const modelsStore = useModelsStore()
const uiStore = useUiStore()

const newName = ref('')
const newProvider = ref('anthropic')
const newApiIdentifier = ref('')
const isAdding = ref(false)

onMounted(async () => {
  await modelsStore.fetchModels()
})

async function handleAddModel() {
  if (!newName.value.trim() || !newApiIdentifier.value.trim()) return

  await modelsStore.addModel({
    name: newName.value.trim(),
    provider: newProvider.value,
    apiIdentifier: newApiIdentifier.value.trim(),
    isActive: true
  })

  newName.value = ''
  newApiIdentifier.value = ''
  isAdding.value = false
}

function handleMakeDefault(id: string) {
  modelsStore.makeDefault(id)
}

function handleDelete(id: string) {
  modelsStore.removeModel(id)
}
</script>

<template>
  <div class="admin-page">
    <div class="admin-container">
      <div class="admin-header">
        <div>
          <h1 class="page-title">
            {{ uiStore.direction === 'rtl' ? 'مدیریت مدل‌های هوش مصنوعی' : 'AI Models Panel' }}
          </h1>
          <p class="page-subtitle">
            {{ uiStore.direction === 'rtl' ? 'پیکربندی مدل‌ها و تعیین مدل پیش‌فرض سامانه' : 'Configure platform models and fallback default' }}
          </p>
        </div>
        <button class="back-btn" @click="router.push('/')">
          {{ uiStore.direction === 'rtl' ? '← بازگشت به چت' : '← Back to Chat' }}
        </button>
      </div>

      <!-- Models List -->
      <div class="models-grid">
        <div
          v-for="model in modelsStore.models"
          :key="model.id"
          class="model-card"
        >
          <div class="card-header">
            <div class="title-with-badge">
              <h3 class="model-name">{{ model.name }}</h3>
              <span v-if="model.isDefault" class="default-chip font-mono">
                {{ uiStore.direction === 'rtl' ? 'پیش‌فرض' : 'DEFAULT' }}
              </span>
            </div>
            <span class="provider-pill font-mono">{{ model.provider }}</span>
          </div>

          <div class="card-meta font-mono">
            <span class="label">API ID:</span>
            <span class="value">{{ model.apiIdentifier }}</span>
          </div>

          <div class="card-actions">
            <button
              v-if="!model.isDefault"
              class="btn-default"
              @click="handleMakeDefault(model.id)"
            >
              {{ uiStore.direction === 'rtl' ? 'تنظیم به عنوان پیش‌فرض' : 'Make Default' }}
            </button>
            <button
              class="btn-delete"
              @click="handleDelete(model.id)"
              :title="uiStore.direction === 'rtl' ? 'حذف مدل' : 'Delete Model'"
            >
              {{ uiStore.direction === 'rtl' ? 'حذف' : 'Delete' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Add Model Form -->
      <div class="add-box">
        <button v-if="!isAdding" class="add-trigger-btn" @click="isAdding = true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          <span>{{ uiStore.direction === 'rtl' ? 'افزودن مدل جدید' : 'Add New Model' }}</span>
        </button>

        <form v-else class="add-form" @submit.prevent="handleAddModel">
          <h2 class="form-heading font-mono">
            {{ uiStore.direction === 'rtl' ? 'مشخصات مدل جدید' : 'NEW MODEL REGISTRATION' }}
          </h2>
          <div class="inputs-grid">
            <div class="form-group">
              <label class="form-label">Name</label>
              <input v-model="newName" type="text" required class="form-input" placeholder="e.g. Claude 3.5 Sonnet" />
            </div>
            <div class="form-group">
              <label class="form-label">Provider</label>
              <select v-model="newProvider" class="form-input">
                <option value="anthropic">anthropic</option>
                <option value="openai">openai</option>
                <option value="google">google</option>
                <option value="local">local</option>
              </select>
            </div>
            <div class="form-group span-2">
              <label class="form-label">API Identifier</label>
              <input v-model="newApiIdentifier" type="text" required class="form-input font-mono" placeholder="claude-3-5-sonnet-20241022" />
            </div>
          </div>
          <div class="actions-row">
            <button type="button" class="btn-cancel" @click="isAdding = false">
              {{ uiStore.direction === 'rtl' ? 'انصراف' : 'Cancel' }}
            </button>
            <button type="submit" class="btn-submit">
              {{ uiStore.direction === 'rtl' ? 'افزودن' : 'Submit Model' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped>
.admin-page {
  width: 100vw;
  min-height: 100vh;
  background-color: var(--background);
  color: var(--foreground);
  overflow-y: auto;
  padding: 32px 16px;
}

.admin-container {
  max-width: 800px;
  margin: 0 auto;
}

.admin-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 32px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border);
}

.page-title {
  font-size: 22px;
  font-weight: 700;
  color: var(--foreground);
  margin-bottom: 4px;
}

.page-subtitle {
  font-size: 13px;
  color: var(--muted-foreground);
}

.back-btn {
  padding: 6px 12px;
  background-color: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: 13px;
  color: var(--primary);
}

.models-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.model-card {
  background-color: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.title-with-badge {
  display: flex;
  align-items: center;
  gap: 8px;
}

.model-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--foreground);
}

.default-chip {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 4px;
  background-color: rgba(124, 106, 247, 0.15);
  color: var(--primary);
  border: 1px solid var(--primary);
}

.provider-pill {
  font-size: 11px;
  padding: 2px 8px;
  background-color: var(--secondary);
  color: var(--secondary-foreground);
  border-radius: 4px;
}

.card-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.card-meta .label {
  color: var(--muted-foreground);
}

.card-meta .value {
  color: var(--foreground);
}

.card-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--border);
}

.btn-default {
  padding: 4px 10px;
  background-color: var(--secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: 12px;
  color: var(--secondary-foreground);
}

.btn-default:hover {
  color: var(--foreground);
  border-color: var(--primary);
}

.btn-delete {
  padding: 4px 10px;
  background-color: transparent;
  color: #ef4444;
  border-radius: var(--radius-sm);
  font-size: 12px;
}

.btn-delete:hover {
  background-color: rgba(239, 68, 68, 0.1);
}

.add-box {
  margin-top: 24px;
}

.add-trigger-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background-color: var(--card);
  border: 1px dashed var(--border);
  border-radius: var(--radius);
  font-size: 13px;
  color: var(--secondary-foreground);
  width: 100%;
  justify-content: center;
}

.add-trigger-btn:hover {
  border-color: var(--primary);
  color: var(--foreground);
}

.add-form {
  background-color: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 20px;
}

.form-heading {
  font-size: 11px;
  color: var(--muted-foreground);
  margin-bottom: 16px;
}

.inputs-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 16px;
}

.span-2 {
  grid-column: span 2;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-label {
  font-size: 12px;
  color: var(--secondary-foreground);
}

.form-input {
  width: 100%;
  padding: 8px 12px;
  font-size: 13px;
}

.actions-row {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.btn-cancel {
  padding: 8px 16px;
  font-size: 13px;
  color: var(--muted-foreground);
}

.btn-submit {
  padding: 8px 18px;
  background-color: var(--primary);
  color: var(--primary-foreground);
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 500;
}
</style>
