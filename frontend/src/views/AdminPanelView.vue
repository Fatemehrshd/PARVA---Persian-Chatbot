<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useModelsStore } from '../stores/models'
import { useUiStore } from '../stores/ui'
import { useAuthStore } from '../stores/auth'
import { modelsService } from '../services/models.service'
import { adminService } from '../services/admin.service'
import AdminModal from '../components/admin/AdminModal.vue'
import BaseButton from '../components/ui/BaseButton.vue'
import BaseToggle from '../components/ui/BaseToggle.vue'
import { useDisclosure } from '../composables/useDisclosure'
import type { AdminDashboardStats, AdminUser, Model, Provider } from '../types'

// Nav icons — blue for light mode, white for dark mode
import logoBlue from '../assets/logo-blue.png'
import logoWhite from '../assets/logo-white.png'
import providersBlue from '../assets/providers-blue.svg'
import providersWhite from '../assets/providers-white.svg'
import modelsBlue from '../assets/moelel-blue.svg'
import modelsWhite from '../assets/models-white.svg'
import usersBlue from '../assets/users-blue.svg'
import usersWhite from '../assets/users-white.svg'

const router = useRouter()
const modelsStore = useModelsStore()
const uiStore = useUiStore()
const authStore = useAuthStore()

const activeSection = ref<'dashboard' | 'providers' | 'models' | 'users'>('dashboard')
const sidebarOpen = ref(false)
const searchQuery = ref('')
const isAddingModel = ref(false)
const isAddingProvider = ref(false)
const isSaving = ref(false)
const errorMessage = ref('')
const providers = ref<Provider[]>([])
const users = ref<AdminUser[]>([])
const stats = ref<AdminDashboardStats | null>(null)
const editingModel = ref<Model | null>(null)
const editingProvider = ref<Provider | null>(null)
const selectedProvider = ref<Provider | null>(null)
const providerModelsModal = useDisclosure()
const providerModalModelForm = useDisclosure()
const providerModalEditor = useDisclosure()

const modelForm = ref({ name: '', provider: '', providerId: '', apiIdentifier: '', baseUrl: '', apiKey: '', isActive: true })
const providerForm = ref({ name: '', baseUrl: '', apiKey: '', isActive: true })

const labels = computed(() => uiStore.direction === 'rtl' ? {
  dashboard: 'داشبورد', providers: 'ارائه‌دهنده‌ها', models: 'مدل‌ها', users: 'کاربران و مصرف',
  back: 'بازگشت', backToInfo: 'بازگشت', add: 'افزودن', save: 'ذخیره', cancel: 'انصراف', active: 'فعال', inactive: 'غیرفعال',
  noData: 'داده‌ای برای نمایش وجود ندارد.', search: 'جستجو...', edit: 'ویرایش', remove: 'حذف', default: 'پیش‌فرض',
  usersTitle: 'کاربران و میزان مصرف', providersTitle: 'ارائه‌دهنده‌ها', modelsTitle: 'مدل‌های هوش مصنوعی',
  dashboardTitle: 'پنل مدیریت', totalUsers: 'کل کاربران', totalModels: 'کل مدل‌ها', totalProviders: 'کل ارائه‌دهنده‌ها', tokens: 'مصرف توکن',
  addProvider: 'ارائه‌دهنده جدید', addModel: 'مدل جدید', modelName: 'نام مدل', provider: 'ارائه‌دهنده', apiId: 'شناسه API',
  baseUrl: 'Base URL', apiKey: 'API Key', name: 'نام', user: 'کاربر', role: 'نقش', conversations: 'گفتگوها', usedTokens: 'توکن مصرفی',
  setDefault: 'پیش‌فرض این ارائه‌دهنده', disable: 'غیرفعال‌کردن', enable: 'فعال‌کردن', modelCount: 'مدل', status: 'وضعیت'
} : {
  dashboard: 'Dashboard', providers: 'Providers', models: 'Models', users: 'Users & Usage',
  back: 'Back', backToInfo: 'Back to info', add: 'Add', save: 'Save', cancel: 'Cancel', active: 'Active', inactive: 'Inactive',
  noData: 'No data to display.', search: 'Search...', edit: 'Edit', remove: 'Delete', default: 'Default',
  usersTitle: 'Users & Usage', providersTitle: 'Providers', modelsTitle: 'AI Models', dashboardTitle: 'System Overview',
  totalUsers: 'Total users', totalModels: 'Total models', totalProviders: 'Total providers', tokens: 'Token usage',
  addProvider: 'New provider', addModel: 'New model', modelName: 'Model name', provider: 'Provider', apiId: 'API identifier',
  baseUrl: 'Base URL', apiKey: 'API key', name: 'Name', user: 'User', role: 'Role', conversations: 'Conversations', usedTokens: 'Used tokens',
  setDefault: 'Set provider default', disable: 'Disable', enable: 'Enable', modelCount: 'models', status: 'Status'
})

const navItems = computed(() => {
  const isDark = uiStore.theme === 'dark'
  return [
    { id: 'dashboard', label: labels.value.dashboard, icon: isDark ? logoWhite : logoBlue },
    { id: 'providers', label: labels.value.providers, icon: isDark ? providersWhite : providersBlue },
    { id: 'models',    label: labels.value.models,    icon: isDark ? modelsWhite    : modelsBlue    },
    { id: 'users',     label: labels.value.users,     icon: isDark ? usersWhite     : usersBlue     },
  ]
})

const filteredModels = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return modelsStore.models
  return modelsStore.models.filter((model) => [model.name, model.provider, model.apiIdentifier].some((value) => value.toLowerCase().includes(query)))
})
const filteredProviders = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return providers.value
  return providers.value.filter((provider) => provider.name.toLowerCase().includes(query) || (provider.baseUrl || '').toLowerCase().includes(query))
})
const filteredUsers = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return users.value
  return users.value.filter((user) => [user.email, user.displayName || '', user.role].some((value) => value.toLowerCase().includes(query)))
})
const providerModels = (provider: Provider) => modelsStore.models.filter((model) => model.providerId === provider.id || model.provider === provider.name)
const activeModels = computed(() => modelsStore.models.filter((model) => model.isActive).length)

function selectSection(section: typeof activeSection.value) {
  activeSection.value = section
  sidebarOpen.value = false
  searchQuery.value = ''
}

function openModelEditor(model?: Model) {
  activeSection.value = 'models'
  editingModel.value = model || null
  modelForm.value = model ? { name: model.name, provider: model.provider, providerId: model.providerId || '', apiIdentifier: model.apiIdentifier, baseUrl: model.baseUrl || '', apiKey: '', isActive: model.isActive } : { name: '', provider: providers.value[0]?.name || '', providerId: providers.value[0]?.id || '', apiIdentifier: '', baseUrl: '', apiKey: '', isActive: true }
  isAddingModel.value = !model
}
function openProviderEditor(provider?: Provider) {
  editingProvider.value = provider || null
  providerForm.value = provider ? { name: provider.name, baseUrl: provider.baseUrl || '', apiKey: '', isActive: provider.isActive } : { name: '', baseUrl: '', apiKey: '', isActive: true }
  isAddingProvider.value = !provider
}
function openProviderModels(provider: Provider) {
  selectedProvider.value = provider
  providerModelsModal.open()
  providerModalModelForm.close()
  providerModalEditor.close()
  errorMessage.value = ''
}
function closeProviderModels() {
  providerModelsModal.close()
  providerModalModelForm.close()
  providerModalEditor.close()
  selectedProvider.value = null
}
function openProviderModalEditor() {
  if (!selectedProvider.value) return
  editingProvider.value = selectedProvider.value
  providerForm.value = {
    name: selectedProvider.value.name,
    baseUrl: selectedProvider.value.baseUrl || '',
    apiKey: '',
    isActive: selectedProvider.value.isActive,
  }
  providerModalModelForm.close()
  providerModalEditor.open()
}
function openProviderModelForm() {
  if (!selectedProvider.value) return
  modelForm.value = {
    name: '',
    provider: selectedProvider.value.name,
    providerId: selectedProvider.value.id,
    apiIdentifier: '',
    baseUrl: selectedProvider.value.baseUrl || '',
    apiKey: '',
    isActive: true
  }
  editingModel.value = null
  providerModalEditor.close()
  providerModalModelForm.open()
}
function closeForms() {
  isAddingModel.value = false
  isAddingProvider.value = false
  editingModel.value = null
  editingProvider.value = null
  errorMessage.value = ''
}

async function loadData() {
  errorMessage.value = ''
  await Promise.allSettled([
    modelsStore.fetchModels(true),
    modelsService.listProviders().then((data) => { providers.value = Array.isArray(data) ? data : [] }),
    adminService.getDashboardStats().then((data) => { stats.value = data }),
    adminService.listUsers().then((data) => { users.value = Array.isArray(data) ? data : [] })
  ])
}

async function saveProvider() {
  if (!providerForm.value.name.trim()) return
  isSaving.value = true
  errorMessage.value = ''
  try {
    const payload = { name: providerForm.value.name.trim(), baseUrl: providerForm.value.baseUrl.trim() || undefined, apiKey: providerForm.value.apiKey.trim() || undefined, isActive: providerForm.value.isActive }
    const saved = editingProvider.value ? await modelsService.updateProvider(editingProvider.value.id, payload) : await modelsService.createProvider(payload)
    if (editingProvider.value) providers.value = providers.value.map((provider) => provider.id === saved.id ? saved : provider)
    else providers.value.push(saved)
    if (selectedProvider.value?.id === saved.id) selectedProvider.value = saved
    providerModalEditor.close()
    closeForms()
  } catch (error: any) { errorMessage.value = error?.message || 'Could not save provider' } finally { isSaving.value = false }
}

async function removeProvider(provider: Provider) {
  if (!window.confirm(uiStore.direction === 'rtl' ? `حذف ${provider.name} و مدل‌های آن؟` : `Delete ${provider.name} and its models?`)) return
  try { await modelsService.deleteProvider(provider.id); providers.value = providers.value.filter((item) => item.id !== provider.id); await modelsStore.fetchModels(true) } catch (error: any) { errorMessage.value = error?.message || 'Could not delete provider' }
}

async function toggleProvider(provider: Provider) {
  try {
    const updated = await modelsService.updateProviderStatus(provider.id, !provider.isActive)
    providers.value = providers.value.map((item) => item.id === provider.id ? updated : item)
    if (selectedProvider.value?.id === provider.id) selectedProvider.value = updated
  } catch (error: any) { errorMessage.value = error?.message || 'Could not update provider' }
}

async function saveModel() {
  if (!modelForm.value.name.trim() || !modelForm.value.apiIdentifier.trim()) return
  isSaving.value = true
  errorMessage.value = ''
  try {
    const provider = providers.value.find((item) => item.id === modelForm.value.providerId) || providers.value.find((item) => item.name === modelForm.value.provider)
    const payload = { name: modelForm.value.name.trim(), provider: provider?.name || modelForm.value.provider.trim(), providerId: provider?.id || undefined, apiIdentifier: modelForm.value.apiIdentifier.trim(), baseUrl: modelForm.value.baseUrl.trim() || undefined, apiKey: modelForm.value.apiKey.trim() || undefined, isActive: modelForm.value.isActive }
    if (editingModel.value) {
      const updated = await modelsService.updateModel(editingModel.value.id, payload)
      modelsStore.models = modelsStore.models.map((model) => model.id === updated.id ? updated : model)
    } else await modelsStore.addModel(payload)
    if (selectedProvider.value) {
      const provider = providers.value.find((item) => item.id === selectedProvider.value?.id)
      if (provider) selectedProvider.value = provider
      providerModalModelForm.close()
    }
    closeForms()
  } catch (error: any) { errorMessage.value = error?.message || 'Could not save model' } finally { isSaving.value = false }
}

async function removeModel(model: Model) {
  if (!window.confirm(uiStore.direction === 'rtl' ? `حذف ${model.name}؟` : `Delete ${model.name}?`)) return
  try { await modelsStore.removeModel(model.id) } catch (error: any) { errorMessage.value = error?.message || 'Could not delete model' }
}
async function toggleModel(model: Model) {
  try { await modelsStore.toggleModelStatus(model.id, !model.isActive) } catch (error: any) { errorMessage.value = error?.message || 'Could not update model' }
}
async function setPlatformDefault(model: Model) {
  try { await modelsStore.makeDefault(model.id) } catch (error: any) { errorMessage.value = error?.message || 'Could not set default model' }
}
async function toggleUser(user: AdminUser) {
  try { const updated = await adminService.updateUserStatus(user.id, user.isActive === false); users.value = users.value.map((item) => item.id === updated.id ? updated : item) } catch (error: any) { errorMessage.value = error?.message || 'Could not update user' }
}

onMounted(loadData)
</script>

<template>
  <div class="admin-shell" :dir="uiStore.direction">
    <button v-if="sidebarOpen" class="admin-scrim" aria-label="Close navigation" @click="sidebarOpen = false"></button>
    <aside class="admin-sidebar" :class="{ 'is-open': sidebarOpen }">
      <div class="admin-brand">
        <div class="admin-brand-mark">پ</div>
        <div><strong>پروا</strong><span>ADMIN CONSOLE</span></div>
      </div>
      <nav class="admin-nav" aria-label="Admin navigation">
        <button v-for="item in navItems" :key="item.id" :data-admin-section="item.id" :class="{ active: activeSection === item.id }" @click="selectSection(item.id as typeof activeSection.value)">
          <img :src="item.icon" class="nav-icon-img" :alt="item.label" aria-hidden="true" />
          <span>{{ item.label }}</span>
        </button>
      </nav>
      <div class="admin-sidebar-bottom">
        <button class="admin-back" @click="router.push('/')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
          {{ labels.back }}
        </button>
        <span class="admin-user-pill">{{ authStore.user?.email || 'admin' }}</span>
      </div>
    </aside>

    <main class="admin-main">
      <header class="admin-topbar">
        <button class="admin-menu-button" aria-label="Open navigation" @click="sidebarOpen = true">☰</button>
        <div class="topbar-title">
          <p class="eyebrow">PARVA / ADMIN</p>
          <h1>{{ 
            activeSection === 'dashboard' ? labels.dashboardTitle : 
            activeSection === 'providers' ? labels.providersTitle : 
            activeSection === 'models' ? labels.modelsTitle : 
            labels.usersTitle 
          }}</h1>
        </div>
        <div class="topbar-actions">
          <input v-model="searchQuery" class="admin-search search-input" :placeholder="labels.search" />
          <BaseButton variant="ghost" icon size="md" title="Refresh" @click="loadData">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
            </svg>
          </BaseButton>
        </div>
      </header>

      <div v-if="errorMessage" class="admin-alert">{{ errorMessage }}</div>

      <section v-if="activeSection === 'dashboard'" class="admin-content">
        <div class="kpi-grid">
          <article class="kpi-card metric-card"><span>{{ labels.totalUsers }}</span><strong>{{ stats?.totalUsers ?? users.length }}</strong><small>{{ stats?.totalConversations ?? 0 }} {{ labels.conversations }}</small></article>
          <article class="kpi-card metric-card"><span>{{ labels.totalProviders }}</span><strong>{{ stats?.totalProviders ?? providers.length }}</strong><small>{{ stats?.activeProviders ?? providers.filter(p => p.isActive).length }} {{ labels.active }}</small></article>
          <article class="kpi-card metric-card"><span>{{ labels.totalModels }}</span><strong>{{ stats?.totalModels ?? modelsStore.models.length }}</strong><small>{{ stats?.activeModels ?? activeModels }} {{ labels.active }}</small></article>
          <article class="kpi-card metric-card accent"><span>{{ labels.tokens }}</span><strong>{{ (stats?.totalTokensUsed ?? users.reduce((sum, user) => sum + user.usedTokens, 0)).toLocaleString() }}</strong><small>{{ stats?.globalTokenLimit ? `/${stats.globalTokenLimit.toLocaleString()}` : '∞' }}</small></article>
        </div>
        <div class="dashboard-grid">
          <article class="surface-panel">
            <div class="panel-heading">
              <div>
                <p class="eyebrow">SYSTEM STATUS</p>
              </div>
              <BaseButton variant="ghost" size="sm" @click="selectSection('providers')">
                {{ labels.providers }} →
              </BaseButton>
            </div>
            <div class="status-list">
              <div v-for="provider in providers.slice(0, 5)" :key="provider.id" class="status-row">
                <span class="status-dot" :class="{ off: !provider.isActive }"></span>
                <strong>{{ provider.name }}</strong>
                <span>{{ providerModels(provider).length }} {{ labels.modelCount }}</span>
                <em>{{ provider.isActive ? labels.active : labels.inactive }}</em>
              </div>
              <p v-if="!providers.length" class="empty-state">{{ labels.noData }}</p>
            </div>
          </article>

          <article class="surface-panel">
            <div class="panel-heading">
              <div>
                <p class="eyebrow">USAGE</p>
              </div>
              <BaseButton variant="ghost" size="sm" @click="selectSection('users')">
                →
              </BaseButton>
            </div>
            <div class="usage-list">
              <div v-for="user in users.slice(0, 5)" :key="user.id" class="usage-row">
                <span class="avatar-chip">{{ (user.displayName || user.email).charAt(0).toUpperCase() }}</span>
                <div>
                  <strong>{{ user.displayName || user.email }}</strong>
                  <small>{{ user.conversationsCount }} {{ labels.conversations }}</small>
                </div>
                <b>{{ user.usedTokens.toLocaleString() }}</b>
              </div>
              <p v-if="!users.length" class="empty-state">{{ labels.noData }}</p>
            </div>
          </article>
        </div>
        <div class="dashboard-models surface-panel">
          <div class="panel-heading">
            <div>
              <p class="eyebrow">CATALOG</p>
            </div>
            <BaseButton variant="primary" size="sm" @click="openModelEditor()">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              {{ labels.addModel }}
            </BaseButton>
          </div>
          <div class="model-table-wrap">
            <table class="admin-table dashboard-table">
              <thead>
                <tr>
                  <th>{{ labels.modelName }}</th>
                  <th>{{ labels.provider }}</th>
                  <th>{{ labels.apiId }}</th>
                  <th>{{ labels.active }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="model in filteredModels" :key="model.id" class="table-row">
                  <td><strong>{{ model.name }}</strong></td>
                  <td><span class="tag">{{ model.provider }}</span></td>
                  <td class="mono subtext">{{ model.apiIdentifier }}</td>
                  <td><span class="status-dot" :class="{ off: !model.isActive }"></span></td>
                </tr>
              </tbody>
            </table>
            <p v-if="!filteredModels.length" class="empty-state">{{ labels.noData }}</p>
          </div>
        </div>
      </section>

      <section v-else-if="activeSection === 'providers'" class="admin-content">
        <div class="section-toolbar">
          <div>
            <p class="eyebrow">REGISTRY</p>
          </div>
          <BaseButton variant="primary" size="md" @click="openProviderEditor()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            {{ labels.addProvider }}
          </BaseButton>
        </div>

        <form v-if="isAddingProvider || editingProvider" class="form-panel" @submit.prevent="saveProvider">
          <div class="form-grid">
            <label>
              {{ labels.name }}
              <input v-model="providerForm.name" required :disabled="isSaving" />
            </label>
            <label>
              {{ labels.baseUrl }}
              <input v-model="providerForm.baseUrl" class="mono" :disabled="isSaving" />
            </label>
            <label>
              {{ labels.apiKey }}
              <input v-model="providerForm.apiKey" type="password" class="mono" placeholder="sk-..." :disabled="isSaving" />
            </label>
            <label class="toggle-label">
              <span>{{ labels.active }}</span>
              <BaseToggle v-model="providerForm.isActive" size="sm" :disabled="isSaving" />
            </label>
          </div>
          <div class="form-actions">
            <BaseButton variant="ghost" size="md" :disabled="isSaving" @click="closeForms">
              {{ labels.cancel }}
            </BaseButton>
            <BaseButton variant="primary" size="md" type="submit" :loading="isSaving" :disabled="isSaving">
              {{ labels.save }}
            </BaseButton>
          </div>
        </form>

        <div v-if="!isAddingProvider && !editingProvider" class="provider-grid">
          <article v-for="provider in filteredProviders" :key="provider.id" class="provider-card">
            <div class="provider-card-head">
              <div class="provider-name-section">
                <span class="status-dot" :class="{ off: !provider.isActive }"></span>
                <button class="provider-name-button" @click="openProviderModels(provider)">
                  {{ provider.name }}
                </button>
              </div>
            </div>
            <div class="provider-status-row">
              <span class="provider-status-label">{{ labels.status }}</span>
              <span class="provider-status-badge" :class="{ active: provider.isActive }">
                {{ provider.isActive ? labels.active : labels.inactive }}
              </span>
              <span v-if="!provider.baseUrl" class="provider-status-badge provider-status-badge--default">
                {{ uiStore.direction === 'rtl' ? 'پیش‌فرض' : 'Default' }}
              </span>
            </div>
            <p v-if="provider.baseUrl" class="mono provider-url">{{ provider.baseUrl }}</p>
            <div class="card-actions">
              <BaseButton variant="danger" size="sm" @click="removeProvider(provider)">
                {{ labels.remove }}
              </BaseButton>
            </div>
          </article>
        </div>
      </section>

      <section v-else-if="activeSection === 'models'" class="admin-content">
        <div class="section-toolbar">
          <div>
            <p class="eyebrow">CATALOG</p>
          </div>
          <BaseButton variant="primary" size="md" @click="openModelEditor()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            {{ labels.addModel }}
          </BaseButton>
        </div>

        <form v-if="isAddingModel || editingModel" class="form-panel" @submit.prevent="saveModel">
          <div class="form-grid">
            <label>
              {{ labels.modelName }}
              <input id="modelName" v-model="modelForm.name" required :disabled="isSaving" />
            </label>
            <label>
              {{ labels.provider }}
              <select v-model="modelForm.providerId" :disabled="isSaving">
                <option v-for="provider in providers" :key="provider.id" :value="provider.id">
                  {{ provider.name }}
                </option>
              </select>
            </label>
            <label>
              {{ labels.apiId }}
              <input id="apiIdentifier" v-model="modelForm.apiIdentifier" class="mono" required :disabled="isSaving" />
            </label>
            <label>
              {{ labels.baseUrl }}
              <input v-model="modelForm.baseUrl" class="mono" :disabled="isSaving" />
            </label>
            <label>
              {{ labels.apiKey }}
              <input v-model="modelForm.apiKey" type="password" class="mono" :disabled="isSaving" />
            </label>
            <label class="toggle-label">
              <span>{{ labels.active }}</span>
              <BaseToggle v-model="modelForm.isActive" size="sm" :disabled="isSaving" />
            </label>
          </div>
          <div class="form-actions">
            <BaseButton variant="ghost" size="md" :disabled="isSaving" @click="closeForms">
              {{ labels.cancel }}
            </BaseButton>
            <BaseButton variant="primary" size="md" type="submit" :loading="isSaving" :disabled="isSaving">
              {{ labels.save }}
            </BaseButton>
          </div>
        </form>

        <div v-if="!isAddingModel && !editingModel" class="model-table-wrap">
          <table class="admin-table">
            <thead>
              <tr>
                <th>{{ labels.modelName }}</th>
                <th>{{ labels.provider }}</th>
                <th>{{ labels.apiId }}</th>
                <th>{{ labels.active }}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="model in filteredModels" :key="model.id" class="table-row">
                <td>
                  <strong>{{ model.name }}</strong>
                  <span v-if="model.isDefault" class="subtext mono">{{ labels.default }}</span>
                </td>
                <td>
                  <span class="tag">{{ model.provider }}</span>
                </td>
                <td class="mono subtext">{{ model.apiIdentifier }}</td>
                <td>
                  <BaseToggle 
                    :model-value="model.isActive" 
                    size="sm"
                    @update:model-value="toggleModel(model)"
                  />
                </td>
                <td class="actions-cell">
                  <div class="action-buttons">
                    <BaseButton 
                      variant="ghost" 
                      size="sm" 
                      icon
                      :title="model.isDefault ? 'Default' : 'Set as default'"
                      @click="setPlatformDefault(model)"
                    >
                      {{ model.isDefault ? '★' : '☆' }}
                    </BaseButton>
                    <BaseButton variant="ghost" size="sm" @click="openModelEditor(model)">
                      {{ labels.edit }}
                    </BaseButton>
                    <BaseButton variant="danger" size="sm" @click="removeModel(model)">
                      {{ labels.remove }}
                    </BaseButton>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
          <p v-if="!filteredModels.length" class="empty-state">{{ labels.noData }}</p>
        </div>
      </section>

      <section v-else class="admin-content users-panel">
        <div class="section-toolbar">
          <div>
            <p class="eyebrow">ACCESS & USAGE</p>
          </div>
          <span class="record-count">{{ filteredUsers.length }}</span>
        </div>

        <div class="model-table-wrap">
          <table class="admin-table">
            <thead>
              <tr>
                <th>{{ labels.user }}</th>
                <th>{{ labels.role }}</th>
                <th>{{ labels.conversations }}</th>
                <th>{{ labels.usedTokens }}</th>
                <th>{{ labels.active }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="user in filteredUsers" :key="user.id" class="table-row">
                <td>
                  <div class="user-cell">
                    <span class="avatar-chip">{{ (user.displayName || user.email).charAt(0).toUpperCase() }}</span>
                    <div>
                      <strong>{{ user.displayName || '—' }}</strong>
                      <span class="subtext">{{ user.email }}</span>
                    </div>
                  </div>
                </td>
                <td>
                  <span class="tag">{{ user.role }}</span>
                </td>
                <td>{{ user.conversationsCount }}</td>
                <td class="mono">{{ user.usedTokens.toLocaleString() }}</td>
                <td>
                  <BaseToggle 
                    :model-value="user.isActive !== false" 
                    size="sm"
                    @update:model-value="toggleUser(user)"
                  />
                </td>
              </tr>
            </tbody>
          </table>
          <p v-if="!filteredUsers.length" class="empty-state">{{ labels.noData }}</p>
        </div>
      </section>
    </main>

    <AdminModal v-if="providerModelsModal.isOpen.value && selectedProvider" eyebrow="PROVIDER MODELS" :title="selectedProvider.name" @close="closeProviderModels">
      <div class="provider-modal-content">

        <!-- حالت افزودن مدل: فقط فرم + تیتر -->
        <template v-if="providerModalModelForm.isOpen.value">
          <p class="provider-modal-section-title">
            {{ uiStore.direction === 'rtl' ? 'افزودن مدل برای' : 'Add model for' }}
            <strong>{{ selectedProvider.name }}</strong>
          </p>
          <form class="modal-model-form" @submit.prevent="saveModel">
            <label>
              <span class="field-label">{{ labels.modelName }}<span class="req">*</span></span>
              <input v-model="modelForm.name" required :disabled="isSaving" />
            </label>
            <label>
              <span class="field-label">{{ labels.apiId }}<span class="req">*</span></span>
              <input v-model="modelForm.apiIdentifier" class="mono" required :disabled="isSaving" />
            </label>
            <label>
              <span class="field-label">{{ labels.baseUrl }}<span class="req">*</span></span>
              <input v-model="modelForm.baseUrl" class="mono" required :disabled="isSaving" />
            </label>
            <label>
              <span class="field-label">{{ labels.apiKey }}<span class="req">*</span></span>
              <input v-model="modelForm.apiKey" type="password" class="mono" required :disabled="isSaving" />
            </label>
            <label class="toggle-label toggle-label--span2">
              <span>{{ labels.active }}</span>
              <BaseToggle v-model="modelForm.isActive" size="sm" :disabled="isSaving" />
            </label>
            <div class="modal-form-actions">
              <BaseButton variant="ghost" size="md" @click="providerModalModelForm.close()">
                {{ labels.cancel }}
              </BaseButton>
              <BaseButton variant="primary" size="md" type="submit" :loading="isSaving" :disabled="isSaving">
                {{ labels.save }}
              </BaseButton>
            </div>
          </form>
        </template>

        <!-- حالت ویرایش provider -->
        <template v-else-if="providerModalEditor.isOpen.value">
          <form class="provider-inline-edit" @submit.prevent="saveProvider">
            <div class="provider-info-grid">
              <label class="provider-info-item">
                <span>{{ labels.name }}</span>
                <input v-model="providerForm.name" required :disabled="isSaving" />
              </label>
              <label class="provider-info-item provider-info-item-wide provider-toggle-item">
                <span>{{ labels.active }}</span>
                <BaseToggle v-model="providerForm.isActive" size="sm" :disabled="isSaving" />
              </label>
              <label class="provider-info-item provider-info-item-wide">
                <span>{{ labels.baseUrl }}</span>
                <input v-model="providerForm.baseUrl" class="mono" :disabled="isSaving" />
              </label>
              <label class="provider-info-item provider-info-item-wide">
                <span>{{ labels.apiKey }}</span>
                <input v-model="providerForm.apiKey" type="password" class="mono" placeholder="sk-..." :disabled="isSaving" />
              </label>
            </div>
            <div class="modal-form-actions provider-edit-actions">
              <BaseButton variant="ghost" size="md" :disabled="isSaving" @click="providerModalEditor.close()">
                {{ labels.cancel }}
              </BaseButton>
              <BaseButton variant="primary" size="md" type="submit" :loading="isSaving" :disabled="isSaving">
                {{ labels.save }}
              </BaseButton>
            </div>
          </form>
        </template>

        <!-- حالت پیش‌فرض: نمایش اطلاعات provider -->
        <template v-else>
          <div class="provider-info-grid">
            <div class="provider-info-item">
              <span>{{ labels.name }}</span>
              <strong>{{ selectedProvider.name }}</strong>
            </div>
            <div class="provider-info-item">
              <span>{{ labels.active }}</span>
              <strong>{{ selectedProvider.isActive ? labels.active : labels.inactive }}</strong>
            </div>
            <div class="provider-info-item provider-info-item-wide">
              <span>{{ labels.baseUrl }}</span>
              <strong class="mono">{{ selectedProvider.baseUrl || '—' }}</strong>
            </div>
          </div>
          <div class="provider-info-actions">
            <BaseButton variant="secondary" size="md" @click="openProviderModalEditor">
              {{ labels.edit }}
            </BaseButton>
          </div>
          <div class="provider-modal-footer">
            <BaseButton variant="primary" size="md" @click="openProviderModelForm">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              {{ labels.addModel }}
            </BaseButton>
          </div>
        </template>

      </div>
    </AdminModal>
  </div>
</template>

<style scoped>
/* Base Layout */
.admin-shell { min-height: 100vh; display: flex; background: var(--background); color: var(--foreground); }
.admin-sidebar { width: 248px; min-height: 100vh; flex: 0 0 248px; display: flex; flex-direction: column; padding: 24px 16px; background: var(--card); border-inline-end: 1px solid var(--border); }
.admin-brand { display: flex; align-items: center; gap: 10px; padding: 0 8px 30px; border-bottom: 1px solid var(--border); }
.admin-brand-mark { width: 34px; height: 34px; display: grid; place-items: center; border-radius: 10px; background: var(--primary); color: var(--primary-foreground); font-weight: 700; font-size: 18px; }
.admin-brand strong, .admin-brand span { display: block; }
.admin-brand strong { font-size: 16px; }
.admin-brand span, .eyebrow { color: var(--muted-foreground); font: 500 9px var(--font-mono); letter-spacing: .08em; }
.admin-nav { display: grid; gap: 5px; padding-top: 24px; }
.admin-nav button, .admin-back { display: flex; align-items: center; gap: 10px; width: 100%; padding: 11px 12px; border: 0; border-radius: 9px; background: transparent; color: var(--muted-foreground); text-align: start; font: inherit; cursor: pointer; transition: .15s ease; }
.admin-nav button:hover, .admin-nav button.active, .admin-back:hover { background: var(--secondary); color: var(--foreground); }
.nav-icon { width: 20px; color: var(--primary); text-align: center; font-family: var(--font-mono); }
.nav-icon-img { width: 16px; height: 16px; flex-shrink: 0; object-fit: contain; }
.admin-sidebar-bottom { margin-top: auto; display: grid; gap: 10px; padding-top: 20px; }
.admin-back { font-size: 12px; }
[dir="rtl"] .admin-back svg { transform: scaleX(-1); }
.admin-user-pill { overflow: hidden; padding: 9px 12px; border: 1px solid var(--border); border-radius: 8px; color: var(--muted-foreground); font: 10px var(--font-mono); text-overflow: ellipsis; white-space: nowrap; }

/* Topbar */
.admin-main { min-width: 0; flex: 1; }
.admin-topbar { min-height: 86px; display: flex; align-items: center; justify-content: space-between; gap: 18px; padding: 20px clamp(18px, 4vw, 48px); border-bottom: 1px solid var(--border); background: color-mix(in srgb, var(--background) 88%, var(--card)); }
.topbar-title { min-width: 0; }
.admin-topbar h1 { margin-top: 4px; font-size: clamp(20px, 2vw, 27px); letter-spacing: -.02em; }
.admin-menu-button { display: none; border: 0; background: transparent; color: var(--foreground); font-size: 20px; cursor: pointer; }
.topbar-actions { display: flex; align-items: center; gap: 8px; }
.admin-search { width: min(220px, 28vw); height: 36px; padding: 0 12px; border: 1px solid var(--border); border-radius: 8px; outline: 0; background: var(--card); color: var(--foreground); font: 12px var(--font-sans); }
.admin-search:focus { border-color: var(--primary); }

/* Content */
.admin-content { padding: clamp(20px, 4vw, 44px); max-width: 1400px; margin: auto; }
.kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
.kpi-card, .surface-panel, .provider-card, .form-panel, .model-table-wrap { border: 1px solid var(--border); border-radius: 12px; background: var(--card); }
.kpi-card { min-height: 120px; display: flex; flex-direction: column; justify-content: space-between; padding: 18px; }
.kpi-card span, .kpi-card small, .subtext, .provider-url, .empty-state, .record-count { color: var(--muted-foreground); }
.kpi-card span, .kpi-card small { font-size: 11px; }
.kpi-card strong { font: 700 28px var(--font-mono); }
.kpi-card.accent strong { color: var(--primary); }
.dashboard-grid { display: grid; grid-template-columns: 1.1fr .9fr; gap: 14px; margin-top: 14px; }
.surface-panel { padding: 20px; }
.panel-heading, .section-toolbar, .provider-card-head, .form-actions, .card-actions { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.status-list, .usage-list { display: grid; gap: 8px; margin-top: 22px; }
.status-row, .usage-row { display: flex; align-items: center; gap: 9px; min-height: 42px; padding: 7px 0; border-bottom: 1px solid var(--border); font-size: 12px; }
.status-row > span:nth-child(3), .status-row em { margin-inline-start: auto; color: var(--muted-foreground); font-size: 10px; font-style: normal; }
.status-dot { display: inline-block; width: 7px; height: 7px; flex: 0 0 7px; border-radius: 50%; background: var(--primary); }
.status-dot.off { background: var(--muted-foreground); }
.usage-row div { display: grid; gap: 2px; min-width: 0; }
.usage-row b { margin-inline-start: auto; font: 11px var(--font-mono); color: var(--primary); }
.avatar-chip { width: 28px; height: 28px; display: grid; place-items: center; flex: 0 0 28px; border-radius: 50%; background: var(--secondary); color: var(--primary); font: 12px var(--font-mono); }
.section-toolbar { margin-bottom: 20px; }

/* Forms */
.form-panel { margin-bottom: 18px; padding: 18px; }
.form-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
.form-grid label { display: grid; gap: 6px; color: var(--muted-foreground); font-size: 11px; }
.form-grid input, .form-grid select { width: 100%; height: 38px; padding: 0 10px; border: 1px solid var(--border); border-radius: 7px; outline: 0; background: var(--background); color: var(--foreground); font: 12px var(--font-sans); }
.form-grid input:focus, .form-grid select:focus { border-color: var(--primary); }
.form-grid .toggle-label { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding-top: 20px; color: var(--muted-foreground); font-size: 11px; }
.form-actions { justify-content: flex-end; margin-top: 18px; padding-top: 14px; border-top: 1px solid var(--border); gap: 8px; }

/* Provider Cards */
.provider-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.provider-card { padding: 18px; }
.provider-name-section { display: flex; align-items: center; gap: 8px; min-width: 0; }
.provider-name-button { padding: 0; border: 0; background: transparent; color: var(--foreground); cursor: pointer; font: 600 16px var(--font-sans); transition: color 0.15s ease; }
.provider-name-button:hover { color: var(--primary); }
.provider-status-row { display: flex; flex-direction: row; align-items: center; gap: 6px; margin-top: 10px; flex-wrap: wrap; }
.provider-status-label { font-size: 11px; color: var(--muted-foreground); margin-inline-end: 2px; }
.provider-status-badge { display: inline-flex; align-items: center; padding: 3px 8px; border-radius: 5px; font-size: 11px; font-weight: 500; background: color-mix(in srgb, var(--muted-foreground) 12%, transparent); color: var(--muted-foreground); }
.provider-status-badge.active { background: color-mix(in srgb, #22c55e 14%, transparent); color: #16a34a; }
.provider-status-badge--default { background: var(--secondary); color: var(--foreground); border: 1px solid var(--border); font-weight: 400; }
.mono { font-family: var(--font-mono); }
.provider-url { overflow: hidden; margin-top: 10px; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
.card-actions { justify-content: flex-end; gap: 6px; margin-top: 12px; }

/* Tables */
.model-table-wrap { overflow-x: auto; }
.admin-table { width: 100%; min-width: 660px; border-collapse: collapse; text-align: start; font-size: 12px; }
.admin-table th { padding: 13px 16px; color: var(--muted-foreground); background: color-mix(in srgb, var(--secondary) 40%, transparent); font-size: 10px; font-weight: 500; text-align: start; }
.admin-table td { padding: 14px 16px; border-top: 1px solid var(--border); vertical-align: middle; }
.admin-table tr:hover td { background: color-mix(in srgb, var(--secondary) 35%, transparent); }
.admin-table td strong { display: block; }
.subtext { display: block; margin-top: 3px; font-size: 10px; }
.tag { padding: 4px 7px; border: 1px solid var(--border); border-radius: 5px; background: var(--secondary); font: 10px var(--font-mono); }
.actions-cell { text-align: end; white-space: nowrap; }
.action-buttons { display: flex; align-items: center; justify-content: flex-end; gap: 4px; }
.user-cell { display: flex; align-items: center; gap: 9px; }
.user-cell div { display: grid; gap: 2px; min-width: 0; }
.record-count { font: 12px var(--font-mono); }

/* Modal Provider Content */
.provider-modal-content { display: grid; gap: 18px; }
.provider-modal-section-title { font-size: 13px; color: var(--muted-foreground); margin-bottom: -6px; }
.provider-info-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 9px; }
.provider-info-item { min-width: 0; padding: 11px 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--background); }
.provider-info-item-wide { grid-column: 1 / -1; }
.provider-info-item span, .provider-info-item strong { display: block; }
.provider-info-item span { color: var(--muted-foreground); font-size: 10px; }
.provider-info-item strong { overflow: hidden; margin-top: 5px; color: var(--foreground); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.provider-inline-edit .provider-info-item input, .provider-inline-edit .provider-info-item select { width: 100%; height: 30px; margin-top: 5px; padding: 0 8px; border: 1px solid var(--border); border-radius: 6px; outline: 0; background: var(--card); color: var(--foreground); font: 12px var(--font-sans); }
.provider-inline-edit .provider-info-item input:focus, .provider-inline-edit .provider-info-item select:focus { border-color: var(--primary); }
.provider-info-actions { display: flex; justify-content: flex-end; gap: 8px; }
.provider-edit-actions { display: flex; align-items: center; justify-content: space-between; width: 100%; padding: 8px; border-radius: 8px; background: var(--background); gap: 8px; }
.provider-modal-footer { display: flex; justify-content: flex-end; padding-top: 14px; border-top: 1px solid var(--border); }
.modal-model-form { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; padding: 14px; border: 1px solid var(--border); border-radius: 10px; background: var(--background); }
.modal-model-form label { display: grid; gap: 5px; color: var(--muted-foreground); font-size: 10px; }
.field-label { display: inline-flex; align-items: center; gap: 2px; }
.modal-model-form input { width: 100%; height: 35px; padding: 0 9px; border: 1px solid var(--border); border-radius: 6px; outline: 0; background: var(--card); color: var(--foreground); font: 11px var(--font-sans); }
.modal-model-form input:focus { border-color: var(--primary); }
.modal-model-form .check-label { display: flex; align-items: center; gap: 7px; padding-top: 18px; }
.modal-model-form .toggle-label { display: flex; align-items: center; justify-content: space-between; gap: 12px; grid-column: 1 / -1; padding-top: 10px; color: var(--muted-foreground); font-size: 10px; }
.toggle-label--span2 { grid-column: 1 / -1; }
.modal-form-actions { display: flex; align-items: center; justify-content: flex-end; gap: 8px; grid-column: 1 / -1; padding-top: 10px; border-top: 1px solid var(--border); }
.req { color: var(--destructive); margin-inline-start: 2px; }

/* Misc */
.admin-alert { margin: 18px clamp(18px, 4vw, 48px) 0; padding: 10px 12px; border: 1px solid color-mix(in srgb, var(--destructive) 40%, transparent); border-radius: 8px; background: color-mix(in srgb, var(--destructive) 8%, transparent); color: var(--destructive); font-size: 12px; }
.empty-state { padding: 20px 0; text-align: center; font-size: 12px; }
.admin-scrim { display: none; }

/* Responsive */
@media (max-width: 900px) { 
  .admin-sidebar { width: 220px; flex-basis: 220px; } 
  .kpi-grid { grid-template-columns: repeat(2, 1fr); } 
  .dashboard-grid { grid-template-columns: 1fr; } 
}

@media (max-width: 680px) { 
  .admin-sidebar { position: fixed; inset-block: 0; inset-inline-start: 0; z-index: 50; transform: translateX(-105%); transition: transform .2s ease; box-shadow: 12px 0 35px color-mix(in srgb, var(--foreground) 12%, transparent); } 
  [dir="rtl"] .admin-sidebar { transform: translateX(105%); } 
  .admin-sidebar.is-open, [dir="rtl"] .admin-sidebar.is-open { transform: translateX(0); } 
  .admin-scrim { display: block; position: fixed; inset: 0; z-index: 40; border: 0; background: color-mix(in srgb, var(--foreground) 35%, transparent); cursor: pointer; } 
  .admin-menu-button { display: block; } 
  .admin-topbar { align-items: flex-start; padding: 16px 18px; } 
  .admin-topbar h1 { font-size: 18px; } 
  .topbar-actions { margin-inline-start: auto; } 
  .admin-search { width: min(145px, 38vw); } 
  .admin-content { padding: 20px 14px 32px; } 
  .kpi-card { min-height: 105px; padding: 14px; } 
  .kpi-card strong { font-size: 22px; } 
  .provider-grid, .form-grid { grid-template-columns: 1fr; } 
  .form-grid .toggle-label { padding-top: 0; } 
  .section-toolbar { align-items: flex-start; flex-wrap: wrap; } 
  .provider-info-grid { grid-template-columns: 1fr; } 
  .provider-info-item-wide { grid-column: auto; } 
  .modal-model-form { grid-template-columns: 1fr; } 
  .modal-model-form .toggle-label { padding-top: 0; } 
}
</style>
