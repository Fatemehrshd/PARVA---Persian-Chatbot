<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useModelsStore } from '../stores/models'
import { useChatStore } from '../stores/chat'
import { useAuthStore } from '../stores/auth'
import { useUiStore } from '../stores/ui'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

const router = useRouter()
const modelsStore = useModelsStore()
const chatStore = useChatStore()
const authStore = useAuthStore()
const uiStore = useUiStore()

const newName = ref('')
const newProvider = ref('anthropic')
const newApiIdentifier = ref('')
const isAdding = ref(false)
const searchQuery = ref('')
const selectedProviderFilter = ref('all')

onMounted(async () => {
  await modelsStore.fetchModels()
  await chatStore.loadConversations()
})

const uniqueProviders = computed(() => {
  const set = new Set(modelsStore.models.map(m => m.provider))
  return Array.from(set)
})

const filteredModels = computed(() => {
  return modelsStore.models.filter(m => {
    const matchesSearch =
      m.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      m.apiIdentifier.toLowerCase().includes(searchQuery.value.toLowerCase())
    const matchesProvider =
      selectedProviderFilter.value === 'all' || m.provider === selectedProviderFilter.value
    return matchesSearch && matchesProvider
  })
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
  <div class="dashboard-wrapper" :dir="uiStore.direction">
    <!-- Top Navigation Header -->
    <header class="dashboard-nav">
      <div class="nav-content">
        <div class="nav-brand-area">
          <div class="brand-badge">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
              <line x1="8" y1="21" x2="16" y2="21"></line>
              <line x1="12" y1="17" x2="12" y2="21"></line>
            </svg>
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h1 class="nav-title">{{ uiStore.direction === 'rtl' ? 'داشبورد مدیریت هوش مصنوعی' : 'AI Admin Dashboard' }}</h1>
              <span class="role-tag font-mono">ADMIN</span>
            </div>
            <p class="nav-subtitle">{{ uiStore.direction === 'rtl' ? 'پیکربندی مدل‌ها، منابع ابری و وضعیت کلی سامانه' : 'Platform models, cloud providers, and system telemetry' }}</p>
          </div>
        </div>

        <div class="nav-actions">
          <span v-if="authStore.user?.email" class="text-xs text-muted-foreground font-mono hidden md:inline">
            {{ authStore.user.email }}
          </span>
          <Button variant="outline" size="sm" @click="router.push('/')">
            {{ uiStore.direction === 'rtl' ? '← بازگشت به چت' : '← Back to Chat' }}
          </Button>
          <Button size="sm" @click="isAdding = !isAdding">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="me-1">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            <span>{{ isAdding ? (uiStore.direction === 'rtl' ? 'بستن فرم' : 'Close Form') : (uiStore.direction === 'rtl' ? 'مدل جدید' : 'New Model') }}</span>
          </Button>
        </div>
      </div>
    </header>

    <!-- Main Scrollable Dashboard Content -->
    <main class="dashboard-main">
      <div class="dashboard-container">
        
        <!-- KPI Metrics Row -->
        <section class="metrics-grid">
          <!-- Total Models -->
          <Card class="metric-card">
            <CardHeader class="metric-card-header">
              <span class="metric-label">{{ uiStore.direction === 'rtl' ? 'کل مدل‌های سامانه' : 'Total AI Models' }}</span>
              <div class="metric-icon bg-primary/10 text-primary">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                </svg>
              </div>
            </CardHeader>
            <CardContent class="metric-card-body">
              <div class="metric-value font-mono">{{ modelsStore.models.length }}</div>
              <div class="metric-hint text-emerald-400">
                <span class="status-dot-active"></span>
                <span>{{ uiStore.direction === 'rtl' ? 'تمام مدل‌ها فعال' : 'All engines active' }}</span>
              </div>
            </CardContent>
          </Card>

          <!-- Default Engine -->
          <Card class="metric-card">
            <CardHeader class="metric-card-header">
              <span class="metric-label">{{ uiStore.direction === 'rtl' ? 'مدل پیش‌فرض' : 'Default Engine' }}</span>
              <div class="metric-icon bg-purple-500/10 text-purple-400">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                </svg>
              </div>
            </CardHeader>
            <CardContent class="metric-card-body">
              <div class="metric-value truncate text-base font-semibold">{{ modelsStore.defaultModel.name }}</div>
              <div class="metric-hint font-mono text-muted-foreground">{{ modelsStore.defaultModel.provider }}</div>
            </CardContent>
          </Card>

          <!-- Connected Providers -->
          <Card class="metric-card">
            <CardHeader class="metric-card-header">
              <span class="metric-label">{{ uiStore.direction === 'rtl' ? 'ارائه‌دهنده‌های فعال' : 'Connected Providers' }}</span>
              <div class="metric-icon bg-blue-500/10 text-blue-400">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect>
                  <rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect>
                  <line x1="6" y1="6" x2="6.01" y2="6"></line>
                  <line x1="6" y1="18" x2="6.01" y2="18"></line>
                </svg>
              </div>
            </CardHeader>
            <CardContent class="metric-card-body">
              <div class="metric-value font-mono">{{ uniqueProviders.length }}</div>
              <div class="metric-hint text-muted-foreground">OpenAI, Anthropic, Google...</div>
            </CardContent>
          </Card>

          <!-- Total Conversations -->
          <Card class="metric-card">
            <CardHeader class="metric-card-header">
              <span class="metric-label">{{ uiStore.direction === 'rtl' ? 'گفتگوهای ثبت شده' : 'Total Sessions' }}</span>
              <div class="metric-icon bg-amber-500/10 text-amber-400">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
              </div>
            </CardHeader>
            <CardContent class="metric-card-body">
              <div class="metric-value font-mono">{{ chatStore.conversations.length }}</div>
              <div class="metric-hint text-muted-foreground">{{ uiStore.direction === 'rtl' ? 'پایگاه داده همگام' : 'Database synced' }}</div>
            </CardContent>
          </Card>
        </section>

        <!-- New Model Registration Box (Collapsible) -->
        <transition name="fade">
          <Card v-if="isAdding" class="border-primary/40 shadow-xl mb-6 bg-card">
            <CardHeader>
              <CardTitle class="text-base flex items-center gap-2">
                <span class="w-2 h-2 rounded-full bg-primary"></span>
                <span>{{ uiStore.direction === 'rtl' ? 'ثبت مدل هوش مصنوعی جدید' : 'Register New AI Model' }}</span>
              </CardTitle>
              <CardDescription>
                {{ uiStore.direction === 'rtl' ? 'مشخصات مدل و شناسه API مربوط به ارائه‌دهنده را وارد کنید.' : 'Specify provider identifier and model credentials.' }}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form @submit.prevent="handleAddModel" class="space-y-4">
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div class="space-y-2">
                    <Label for="modelName">{{ uiStore.direction === 'rtl' ? 'نام مدل (نمایش به کاربر)' : 'Model Name' }}</Label>
                    <Input id="modelName" v-model="newName" required placeholder="e.g. Claude 3.5 Sonnet" />
                  </div>
                  <div class="space-y-2">
                    <Label for="provider">{{ uiStore.direction === 'rtl' ? 'ارائه‌دهنده (Provider)' : 'Provider' }}</Label>
                    <select id="provider" v-model="newProvider" class="form-select-native">
                      <option value="anthropic">anthropic</option>
                      <option value="openai">openai</option>
                      <option value="google">google</option>
                      <option value="meta">meta (llama)</option>
                      <option value="mistral">mistral</option>
                      <option value="local">local (ollama)</option>
                    </select>
                  </div>
                  <div class="space-y-2 sm:col-span-2">
                    <Label for="apiIdentifier">{{ uiStore.direction === 'rtl' ? 'شناسه دقیق مدل (API Identifier)' : 'API Identifier' }}</Label>
                    <Input id="apiIdentifier" v-model="newApiIdentifier" required class="font-mono" placeholder="claude-3-5-sonnet-20241022" />
                  </div>
                </div>
                <div class="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" size="sm" @click="isAdding = false">
                    {{ uiStore.direction === 'rtl' ? 'انصراف' : 'Cancel' }}
                  </Button>
                  <Button type="submit" size="sm">
                    {{ uiStore.direction === 'rtl' ? 'افزودن به مدل‌ها' : 'Save Engine' }}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </transition>

        <!-- Filters & Search Toolbar -->
        <div class="toolbar-section">
          <div class="search-box">
            <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input 
              v-model="searchQuery" 
              type="text" 
              class="search-input" 
              :placeholder="uiStore.direction === 'rtl' ? 'جستجو در نام مدل یا شناسه API...' : 'Search models or identifiers...'" 
            />
          </div>

          <div class="filter-chips">
            <button 
              :class="['filter-btn', { active: selectedProviderFilter === 'all' }]" 
              @click="selectedProviderFilter = 'all'"
            >
              {{ uiStore.direction === 'rtl' ? 'همه' : 'All' }}
            </button>
            <button 
              v-for="prov in uniqueProviders" 
              :key="prov" 
              :class="['filter-btn font-mono', { active: selectedProviderFilter === prov }]" 
              @click="selectedProviderFilter = prov"
            >
              {{ prov }}
            </button>
          </div>
        </div>

        <!-- Models Dashboard Table -->
        <Card class="overflow-hidden shadow-lg border-border bg-card">
          <div class="table-responsive">
            <table class="dashboard-table">
              <thead>
                <tr>
                  <th>{{ uiStore.direction === 'rtl' ? 'مدل هوش مصنوعی' : 'Model' }}</th>
                  <th>{{ uiStore.direction === 'rtl' ? 'سرویس‌دهنده' : 'Provider' }}</th>
                  <th>{{ uiStore.direction === 'rtl' ? 'شناسه API' : 'API Identifier' }}</th>
                  <th>{{ uiStore.direction === 'rtl' ? 'وضعیت' : 'Status' }}</th>
                  <th class="text-end">{{ uiStore.direction === 'rtl' ? 'عملیات' : 'Actions' }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="model in filteredModels" :key="model.id" class="table-row">
                  <!-- Model Info -->
                  <td>
                    <div class="flex items-center gap-3">
                      <div class="model-avatar">
                        {{ model.name.charAt(0) }}
                      </div>
                      <div>
                        <div class="model-row-name">{{ model.name }}</div>
                        <div class="text-[11px] text-muted-foreground">{{ model.provider }} Core</div>
                      </div>
                    </div>
                  </td>

                  <!-- Provider -->
                  <td>
                    <span class="provider-badge font-mono">
                      {{ model.provider }}
                    </span>
                  </td>

                  <!-- API Identifier -->
                  <td>
                    <code class="api-code font-mono">{{ model.apiIdentifier }}</code>
                  </td>

                  <!-- Status -->
                  <td>
                    <div class="flex items-center gap-2">
                      <span v-if="model.isDefault" class="default-badge font-mono">
                        ★ {{ uiStore.direction === 'rtl' ? 'پیش‌فرض سامانه' : 'SYSTEM DEFAULT' }}
                      </span>
                      <span v-else class="active-badge font-mono">
                        {{ uiStore.direction === 'rtl' ? 'فعال' : 'ACTIVE' }}
                      </span>
                    </div>
                  </td>

                  <!-- Actions -->
                  <td>
                    <div class="flex items-center justify-end gap-2">
                      <Button
                        v-if="!model.isDefault"
                        variant="secondary"
                        size="sm"
                        @click="handleMakeDefault(model.id)"
                        :title="uiStore.direction === 'rtl' ? 'تنظیم به عنوان پیش‌فرض' : 'Set as Default'"
                      >
                        {{ uiStore.direction === 'rtl' ? 'پیش‌فرض کردن' : 'Set Default' }}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        class="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        @click="handleDelete(model.id)"
                        :title="uiStore.direction === 'rtl' ? 'حذف مدل' : 'Delete Model'"
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <polyline points="3 6 5 6 21 6"></polyline>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                      </Button>
                    </div>
                  </td>
                </tr>

                <tr v-if="filteredModels.length === 0">
                  <td colspan="5" class="empty-row text-center py-10 text-muted-foreground">
                    {{ uiStore.direction === 'rtl' ? 'هیچ مدلی با این مشخصات یافت نشد.' : 'No models matching search criteria.' }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>

        <!-- System Diagnostic Cards (Bottom Section) -->
        <section class="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="diagnostic-card">
            <div class="diag-title">{{ uiStore.direction === 'rtl' ? 'پروتکل ارتباطی' : 'API Protocol' }}</div>
            <div class="diag-status font-mono text-emerald-400">SSE / Chunked HTTP</div>
            <div class="diag-desc">{{ uiStore.direction === 'rtl' ? 'پاسخ‌دهی آنی و استریم بدون وقفه' : 'Real-time response token streaming' }}</div>
          </div>
          <div class="diagnostic-card">
            <div class="diag-title">{{ uiStore.direction === 'rtl' ? 'موتور دیتابیس' : 'Persistence Layer' }}</div>
            <div class="diag-status font-mono text-blue-400">PostgreSQL + TypeORM</div>
            <div class="diag-desc">{{ uiStore.direction === 'rtl' ? 'ذخیره‌سازی پایدار گفتگوها و مدل‌ها' : 'Persistent conversation storage' }}</div>
          </div>
          <div class="diagnostic-card">
            <div class="diag-title">{{ uiStore.direction === 'rtl' ? 'امنیت دسترسی' : 'Access Control' }}</div>
            <div class="diag-status font-mono text-purple-400">JWT Bearer Guard</div>
            <div class="diag-desc">{{ uiStore.direction === 'rtl' ? 'احراز هویت رمزنگاری شده کاربران' : 'Encrypted role-based access' }}</div>
          </div>
        </section>

      </div>
    </main>
  </div>
</template>

<style scoped>
.dashboard-wrapper {
  min-height: 100vh;
  width: 100%;
  background-color: var(--background);
  color: var(--foreground);
  display: flex;
  flex-direction: column;
}

.dashboard-nav {
  position: sticky;
  top: 0;
  z-index: 40;
  width: 100%;
  background-color: rgba(14, 15, 17, 0.85);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid var(--border);
  padding: 12px 16px;
}

.nav-content {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.nav-brand-area {
  display: flex;
  align-items: center;
  gap: 12px;
}

.brand-badge {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-sm);
  background: linear-gradient(135deg, var(--primary), #a78bfa);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.nav-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--foreground);
  line-height: 1.2;
}

.role-tag {
  font-size: 9px;
  padding: 1px 5px;
  background-color: var(--secondary);
  color: var(--primary);
  border: 1px solid var(--border);
  border-radius: 4px;
}

.nav-subtitle {
  font-size: 11px;
  color: var(--muted-foreground);
}

.nav-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.dashboard-main {
  flex: 1;
  width: 100%;
  padding: 24px 16px 48px;
}

.dashboard-container {
  max-width: 1200px;
  margin: 0 auto;
}

/* Metrics Row */
.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.metric-card {
  background-color: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
}

.metric-card-header {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px 6px;
}

.metric-label {
  font-size: 12px;
  color: var(--muted-foreground);
  font-weight: 500;
}

.metric-icon {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.metric-card-body {
  padding: 0 16px 14px;
}

.metric-value {
  font-size: 22px;
  font-weight: 700;
  color: var(--foreground);
}

.metric-hint {
  font-size: 11px;
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
}

.status-dot-active {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: #10b981;
}

/* Toolbar */
.toolbar-section {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}

.search-box {
  position: relative;
  flex: 1;
  min-width: 240px;
  max-width: 400px;
}

.search-icon {
  position: absolute;
  top: 50%;
  inset-inline-start: 12px;
  transform: translateY(-50%);
  color: var(--muted-foreground);
}

.search-input {
  width: 100%;
  padding: 8px 12px;
  padding-inline-start: 36px;
  background-color: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--foreground);
  font-size: 13px;
  outline: none;
  transition: border-color 150ms ease;
}

.search-input:focus {
  border-color: var(--ring);
}

.filter-chips {
  display: flex;
  align-items: center;
  gap: 6px;
  overflow-x: auto;
}

.filter-btn {
  padding: 5px 12px;
  border-radius: 20px;
  background-color: var(--secondary);
  border: 1px solid var(--border);
  font-size: 12px;
  color: var(--secondary-foreground);
  cursor: pointer;
  transition: all 150ms ease;
}

.filter-btn:hover {
  color: var(--foreground);
  border-color: var(--muted-foreground);
}

.filter-btn.active {
  background-color: var(--primary);
  color: var(--primary-foreground);
  border-color: var(--primary);
}

/* Table */
.table-responsive {
  width: 100%;
  overflow-x: auto;
}

.dashboard-table {
  width: 100%;
  border-collapse: collapse;
  text-align: start;
  font-size: 13px;
}

.dashboard-table th {
  padding: 12px 16px;
  background-color: var(--secondary);
  color: var(--muted-foreground);
  font-weight: 500;
  border-bottom: 1px solid var(--border);
  text-align: inherit;
}

.dashboard-table td {
  padding: 14px 16px;
  border-bottom: 1px solid var(--border);
  vertical-align: middle;
}

.table-row:hover {
  background-color: rgba(255, 255, 255, 0.02);
}

.model-avatar {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background-color: var(--secondary);
  border: 1px solid var(--border);
  color: var(--primary);
  font-weight: 700;
  font-size: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.model-row-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--foreground);
}

.provider-badge {
  display: inline-block;
  padding: 3px 8px;
  border-radius: 4px;
  background-color: var(--secondary);
  color: var(--secondary-foreground);
  border: 1px solid var(--border);
  font-size: 11px;
}

.api-code {
  background-color: var(--secondary);
  padding: 3px 6px;
  border-radius: 4px;
  font-size: 11px;
  color: var(--foreground);
}

.default-badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  background-color: rgba(124, 106, 247, 0.15);
  color: var(--primary);
  border: 1px solid var(--primary);
}

.active-badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  background-color: rgba(16, 185, 129, 0.1);
  color: #10b981;
  border: 1px solid rgba(16, 185, 129, 0.3);
}

/* Diagnostic widgets */
.diagnostic-card {
  background-color: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 16px;
}

.diag-title {
  font-size: 11px;
  color: var(--muted-foreground);
  margin-bottom: 4px;
}

.diag-status {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 4px;
}

.diag-desc {
  font-size: 11px;
  color: var(--secondary-foreground);
}

.form-select-native {
  width: 100%;
  padding: 8px 12px;
  background-color: var(--secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--foreground);
  font-size: 13px;
  outline: none;
}

.form-select-native:focus {
  border-color: var(--ring);
}

.fade-enter-active, .fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
