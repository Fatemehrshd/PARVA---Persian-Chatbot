<script setup lang="ts">
import { ref } from 'vue'
import { useUiStore } from '../../stores/ui'
import { useModelsStore } from '../../stores/models'
import { useFormSubmit } from '../../composables/useFormSubmit'
import BaseButton from '../ui/BaseButton.vue'
import BaseToggle from '../ui/BaseToggle.vue'

const uiStore = useUiStore()
const modelsStore = useModelsStore()

const newName = ref('')
const newProvider = ref('openai')
const newApiIdentifier = ref('')
const newBaseUrl = ref('')
const newApiKey = ref('')
const isAdding = ref(false)

const {
  isSubmitting: isRegisteringModel,
  error: addModelError,
  submit: submitAddModel
} = useFormSubmit(
  async () => {
    if (!newName.value.trim() || !newApiIdentifier.value.trim()) return

    await modelsStore.addModel({
      name: newName.value.trim(),
      provider: newProvider.value,
      apiIdentifier: newApiIdentifier.value.trim(),
      baseUrl: newBaseUrl.value.trim() || undefined,
      apiKey: newApiKey.value.trim() || undefined,
      isActive: true
    })
  },
  {
    successMessage: uiStore.direction === 'rtl' ? 'مدل با موفقیت ثبت شد.' : 'Model created successfully.',
    onSuccess: () => {
      newName.value = ''
      newApiIdentifier.value = ''
      newBaseUrl.value = ''
      newApiKey.value = ''
      isAdding.value = false
    }
  }
)

async function handleAddModel() {
  await submitAddModel()
}

async function handleMakeDefault(id: string) {
  try {
    await modelsStore.makeDefault(id)
    uiStore.showToast(uiStore.direction === 'rtl' ? 'مدل پیش‌فرض با موفقیت تغییر یافت.' : 'Default model updated.', 'success')
  } catch (err: any) {
    uiStore.showToast(err?.message || 'خطا در تغییر مدل پیش‌فرض', 'error')
  }
}

async function handleToggleActive(id: string, currentStatus: boolean) {
  try {
    await modelsStore.toggleModelStatus(id, !currentStatus)
  } catch (err: any) {
    uiStore.showToast(err?.message || 'خطا در تغییر وضعیت مدل', 'error')
  }
}

async function handleDelete(id: string) {
  try {
    await modelsStore.removeModel(id)
    uiStore.showToast(uiStore.direction === 'rtl' ? 'مدل با موفقیت حذف شد.' : 'Model deleted.', 'success')
  } catch (err: any) {
    uiStore.showToast(err?.message || 'خطا در حذف مدل', 'error')
  }
}
</script>

<template>
  <div v-if="uiStore.adminModelsModalOpen" class="modal-backdrop" @click.self="uiStore.closeAdminModels">
    <div class="modal-card" :dir="uiStore.direction">
      <div class="modal-header">
        <div class="header-title-group">
          <h2 class="modal-title">
            {{ uiStore.direction === 'rtl' ? 'مدیریت مدل‌های هوش مصنوعی' : 'AI Models Management' }}
          </h2>
          <span class="badge-role font-mono">ADMIN</span>
        </div>
        <button class="close-btn" @click="uiStore.closeAdminModels" aria-label="Close modal">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <!-- Models List -->
      <div class="models-list">
        <div
          v-for="model in modelsStore.models"
          :key="model.id"
          class="model-row"
        >
          <div class="model-info">
            <div class="model-name-row">
              <span class="model-name">{{ model.name }}</span>
              <span v-if="model.isDefault" class="default-badge font-mono">
                {{ uiStore.direction === 'rtl' ? 'پیش‌فرض' : 'DEFAULT' }}
              </span>
            </div>
            <div class="model-meta font-mono">
              <span class="provider-tag">{{ model.provider }}</span>
              <span>{{ model.apiIdentifier }}</span>
            </div>
          </div>

          <div class="model-actions">
            <BaseToggle 
              :model-value="model.isActive" 
              size="sm"
              @update:model-value="handleToggleActive(model.id, model.isActive)"
            />
            <BaseButton
              v-if="!model.isDefault"
              variant="ghost"
              size="sm"
              @click="handleMakeDefault(model.id)"
            >
              {{ uiStore.direction === 'rtl' ? 'پیش‌فرض' : 'Set Default' }}
            </BaseButton>
            <BaseButton
              variant="danger"
              size="sm"
              icon
              :title="uiStore.direction === 'rtl' ? 'حذف مدل' : 'Delete model'"
              @click="handleDelete(model.id)"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
              </svg>
            </BaseButton>
          </div>
        </div>
      </div>

      <!-- Add Model Form Toggle -->
      <div v-if="!isAdding" class="add-section-toggle">
        <BaseButton variant="secondary" size="md" @click="isAdding = true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          <span>{{ uiStore.direction === 'rtl' ? 'افزودن مدل جدید' : 'Add New Model' }}</span>
        </BaseButton>
      </div>

      <!-- Add Model Form -->
      <form v-else class="add-model-form" @submit.prevent="handleAddModel">
        <h3 class="form-title font-mono">
          {{ uiStore.direction === 'rtl' ? 'افزودن مدل جدید' : 'NEW MODEL SPECIFICATION' }}
        </h3>
        <div v-if="addModelError" class="bg-destructive/15 border border-destructive/40 text-destructive px-3 py-2 rounded-lg text-xs mb-3">
          {{ addModelError }}
        </div>
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label">Name</label>
            <input
              v-model="newName"
              type="text"
              required
              :disabled="isRegisteringModel"
              class="form-input"
              placeholder="e.g. Gemini 1.5 Pro"
            />
          </div>
          <div class="form-group">
            <label class="form-label">Provider</label>
            <select v-model="newProvider" class="form-input" :disabled="isRegisteringModel">
              <option value="anthropic">anthropic</option>
              <option value="openai">openai</option>
              <option value="google">google</option>
              <option value="local">local</option>
            </select>
          </div>
          <div class="form-group span-2">
            <label class="form-label">API Identifier</label>
            <input
              v-model="newApiIdentifier"
              type="text"
              required
              :disabled="isRegisteringModel"
              class="form-input font-mono"
              placeholder="e.g. gemini-1.5-pro-latest"
            />
          </div>
          <div class="form-group">
            <label class="form-label">Base URL (Optional)</label>
            <input
              v-model="newBaseUrl"
              type="text"
              :disabled="isRegisteringModel"
              class="form-input font-mono text-xs"
              placeholder="https://api.openai.com/v1"
            />
          </div>
          <div class="form-group">
            <label class="form-label">API Key (Optional)</label>
            <input
              v-model="newApiKey"
              type="password"
              :disabled="isRegisteringModel"
              class="form-input font-mono text-xs"
              placeholder="sk-..."
            />
          </div>
        </div>
        <div class="form-actions flex items-center justify-between w-full">
          <template v-if="uiStore.direction === 'rtl'">
            <BaseButton 
              variant="primary" 
              size="md" 
              type="submit" 
              :loading="isRegisteringModel" 
              :disabled="isRegisteringModel"
            >
              {{ isRegisteringModel ? 'در حال ثبت...' : 'ثبت مدل' }}
            </BaseButton>

            <BaseButton 
              variant="ghost" 
              size="md" 
              type="button" 
              :disabled="isRegisteringModel" 
              @click="isAdding = false"
            >
              انصراف
            </BaseButton>
          </template>

          <template v-else>
            <BaseButton 
              variant="ghost" 
              size="md" 
              type="button" 
              :disabled="isRegisteringModel" 
              @click="isAdding = false"
            >
              Cancel
            </BaseButton>

            <BaseButton 
              variant="primary" 
              size="md" 
              type="submit" 
              :loading="isRegisteringModel" 
              :disabled="isRegisteringModel"
            >
              {{ isRegisteringModel ? 'Adding...' : 'Add Model' }}
            </BaseButton>
          </template>
        </div>
      </form>

      <!-- Link to full admin page -->
      <div class="modal-footer-nav">
        <router-link to="/admin/models" class="full-page-nav-link" @click="uiStore.closeAdminModels">
          {{ uiStore.direction === 'rtl' ? 'مشاهده و تست در صفحه اختصاصی پنل ادمین (/admin/models) ↗' : 'Open Dedicated Admin Page (/admin/models) ↗' }}
        </router-link>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 16px;
}

.modal-card {
  width: 100%;
  max-width: 580px;
  background-color: var(--card);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.header-title-group {
  display: flex;
  align-items: center;
  gap: 10px;
}

.modal-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--foreground);
}

.badge-role {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  background-color: var(--secondary);
  color: var(--primary);
  border: 1px solid var(--border);
}

.close-btn {
  color: var(--muted-foreground);
  padding: 6px;
  border-radius: 8px;
  transition: all 0.15s ease;
  border: 0;
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  color: var(--foreground);
  background-color: var(--secondary);
}

.models-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 280px;
  overflow-y: auto;
  margin-bottom: 16px;
  padding-inline-end: 4px;
}

.model-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  background-color: var(--secondary);
  border: 1px solid var(--border);
  border-radius: 10px;
  transition: background-color 0.15s ease;
}

.model-row:hover {
  background-color: color-mix(in srgb, var(--secondary) 80%, var(--foreground));
}

.model-info {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  flex: 1;
}

.model-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.model-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--foreground);
}

.default-badge {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  background-color: rgba(124, 106, 247, 0.15);
  color: var(--primary);
  border: 1px solid var(--primary);
}

.model-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: var(--muted-foreground);
  flex-wrap: wrap;
}

.provider-tag {
  color: var(--secondary-foreground);
}

.model-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.add-section-toggle {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 16px;
}

.add-model-form {
  margin-top: 16px;
  padding: 16px;
  background-color: var(--secondary);
  border-radius: 10px;
  border: 1px solid var(--border);
}

.form-title {
  font-size: 11px;
  color: var(--muted-foreground);
  margin-bottom: 12px;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 14px;
}

.span-2 {
  grid-column: span 2;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.form-label {
  font-size: 11px;
  color: var(--secondary-foreground);
}

.form-input {
  width: 100%;
  padding: 8px 10px;
  font-size: 13px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--background);
  color: var(--foreground);
  outline: none;
  transition: border-color 0.15s ease;
}

.form-input:focus {
  border-color: var(--primary);
}

.form-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: 8px;
}

.modal-footer-nav {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
  text-align: center;
}

.full-page-nav-link {
  font-size: 12px;
  color: var(--primary);
  text-decoration: none;
  font-weight: 500;
  transition: opacity 150ms ease;
}

.full-page-nav-link:hover {
  text-decoration: underline;
  opacity: 0.9;
}

@media (max-width: 640px) {
  .modal-card {
    max-width: 100%;
    padding: 18px;
  }

  .models-list {
    max-height: 240px;
  }

  .model-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }

  .model-actions {
    width: 100%;
    justify-content: space-between;
  }

  .form-grid {
    grid-template-columns: 1fr;
  }

  .span-2 {
    grid-column: span 1;
  }
}
</style>
