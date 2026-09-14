<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useModelsStore } from '../stores/models'
import { useChatStore } from '../stores/chat'
import { useUiStore } from '../stores/ui'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useFormSubmit } from '../composables/useFormSubmit'

const router = useRouter()
const modelsStore = useModelsStore()
const chatStore = useChatStore()
const uiStore = useUiStore()

const newName = ref('')
const newProvider = ref('openai')
const newApiIdentifier = ref('')
const newBaseUrl = ref('')
const newApiKey = ref('')
const newIsActive = ref(true)

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

const activeCount = computed(() => modelsStore.models.filter(m => m.isActive).length)

const {
  isSubmitting: isRegisteringModel,
  error: addModelError,
  submit: submitAddModel,
} = useFormSubmit(
  async () => {
    if (!newName.value.trim() || !newApiIdentifier.value.trim()) return

    await modelsStore.addModel({
      name: newName.value.trim(),
      provider: newProvider.value,
      apiIdentifier: newApiIdentifier.value.trim(),
      baseUrl: newBaseUrl.value.trim() || undefined,
      apiKey: newApiKey.value.trim() || undefined,
      isActive: newIsActive.value
    })
  },
  {
    successMessage: uiStore.direction === 'rtl' ? 'مدل هوش مصنوعی با موفقیت افزوده شد.' : 'AI Model registered successfully.',
    onSuccess: () => {
      newName.value = ''
      newApiIdentifier.value = ''
      newBaseUrl.value = ''
      newApiKey.value = ''
      newIsActive.value = true
      isAdding.value = false
    }
  }
)

async function handleAddModel() {
  await submitAddModel()
}

async function handleToggleStatus(id: string, currentStatus: boolean) {
  try {
    const nextStatus = !currentStatus
    await modelsStore.toggleModelStatus(id, nextStatus)
    uiStore.showToast(
      uiStore.direction === 'rtl'
        ? (nextStatus ? 'مدل فعال شد.' : 'مدل غیرفعال شد.')
        : (nextStatus ? 'Model activated.' : 'Model deactivated.'),
      nextStatus ? 'success' : 'info'
    )
  } catch (err: any) {
    uiStore.showToast(err?.message || 'خطا در تغییر وضعیت مدل', 'error')
  }
}

async function handleMakeDefault(id: string) {
  try {
    await modelsStore.makeDefault(id)
    uiStore.showToast(uiStore.direction === 'rtl' ? 'مدل پیش‌فرض بروزرسانی شد.' : 'Default model updated.', 'success')
  } catch (err: any) {
    uiStore.showToast(err?.message || 'خطا در تغییر مدل پیش‌فرض', 'error')
  }
}

async function handleDelete(id: string) {
  try {
    await modelsStore.removeModel(id)
    uiStore.showToast(uiStore.direction === 'rtl' ? 'مدل با موفقیت حذف شد.' : 'Model removed.', 'success')
  } catch (err: any) {
    uiStore.showToast(err?.message || 'خطا در حذف مدل', 'error')
  }
}
</script>

<template>
  <div class="min-h-screen bg-background text-foreground" :dir="uiStore.direction">
    <!-- Clean Minimalist Header -->
    <header class="border-b border-border/80 bg-card/60 backdrop-blur-md sticky top-0 z-30">
      <div class="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <div class="flex items-center gap-3">
          <Button variant="ghost" size="sm" @click="router.push('/')" class="text-xs text-muted-foreground hover:text-foreground">
            {{ uiStore.direction === 'rtl' ? '← بازگشت به چت' : '← Back' }}
          </Button>
          <div class="h-4 w-px bg-border"></div>
          <div class="flex items-center gap-2">
            <h1 class="text-base sm:text-lg font-bold tracking-tight">
              {{ uiStore.direction === 'rtl' ? 'مدیریت مدل‌های هوش مصنوعی' : 'AI Models Management' }}
            </h1>
            <span class="role-tag font-mono text-[10px] uppercase px-1.5 py-0.5 rounded bg-primary/15 text-primary border border-primary/30">
              ADMIN
            </span>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <Button size="sm" @click="isAdding = !isAdding" class="gap-1.5 shadow-sm">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line v1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            <span>{{ isAdding ? (uiStore.direction === 'rtl' ? 'بستن' : 'Cancel') : (uiStore.direction === 'rtl' ? 'افزودن مدل جدید' : 'New Model') }}</span>
          </Button>
        </div>
      </div>
    </header>

    <main class="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <!-- Minimalist Compact Stats Row (Clean pills instead of bulky cards) -->
      <section class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div class="metric-card p-3 rounded-xl bg-card border border-border/70 flex items-center justify-between">
          <span class="text-xs text-muted-foreground">{{ uiStore.direction === 'rtl' ? 'کل مدل‌ها' : 'Total Models' }}</span>
          <span class="font-mono text-sm font-bold">{{ modelsStore.models.length }}</span>
        </div>
        <div class="metric-card p-3 rounded-xl bg-card border border-border/70 flex items-center justify-between">
          <span class="text-xs text-muted-foreground">{{ uiStore.direction === 'rtl' ? 'مدل‌های فعال' : 'Active Models' }}</span>
          <span class="font-mono text-sm font-bold text-emerald-500">{{ activeCount }}</span>
        </div>
        <div class="metric-card p-3 rounded-xl bg-card border border-border/70 flex items-center justify-between">
          <span class="text-xs text-muted-foreground">{{ uiStore.direction === 'rtl' ? 'ارائه‌دهنده‌ها' : 'Providers' }}</span>
          <span class="font-mono text-sm font-bold text-primary">{{ uniqueProviders.length }}</span>
        </div>
        <div class="metric-card p-3 rounded-xl bg-card border border-border/70 flex items-center justify-between">
          <span class="text-xs text-muted-foreground truncate">{{ uiStore.direction === 'rtl' ? 'مدل پیش‌فرض' : 'Default Model' }}</span>
          <span class="font-mono text-xs font-bold text-amber-500 truncate max-w-[90px]">{{ modelsStore.defaultModel.name || '-' }}</span>
        </div>
      </section>

      <!-- Add New Model Form (Collapsible, Clean Vercel Style) -->
      <transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="opacity-0 -translate-y-2 scale-[0.99]"
        enter-to-class="opacity-100 translate-y-0 scale-100"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="opacity-100 translate-y-0 scale-100"
        leave-to-class="opacity-0 -translate-y-2 scale-[0.99]"
      >
        <Card v-if="isAdding" class="border-primary/40 bg-card shadow-lg">
          <CardHeader class="pb-3 border-b border-border/60">
            <CardTitle class="text-sm font-semibold flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
              <span>{{ uiStore.direction === 'rtl' ? 'ثبت و پیکربندی مدل هوش مصنوعی (سازگار با OpenAI)' : 'Register AI Model (OpenAI Compatible)' }}</span>
            </CardTitle>
          </CardHeader>
          <CardContent class="pt-4">
            <div v-if="addModelError" class="bg-destructive/15 border border-destructive/40 text-destructive px-3 py-2 rounded-lg text-xs mb-4">
              {{ addModelError }}
            </div>
            <form @submit.prevent="handleAddModel" class="space-y-4">
              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <!-- Name -->
                <div class="space-y-1.5">
                  <Label for="modelName">{{ uiStore.direction === 'rtl' ? 'نام نمایشی مدل' : 'Display Name' }}</Label>
                  <Input 
                    id="modelName" 
                    v-model="newName" 
                    required 
                    :disabled="isRegisteringModel"
                    placeholder="e.g. DeepSeek V3 / GPT-4o" 
                  />
                </div>

                <!-- Provider -->
                <div class="space-y-1.5">
                  <Label for="provider">{{ uiStore.direction === 'rtl' ? 'ارائه‌دهنده (Provider)' : 'Provider' }}</Label>
                  <select 
                    id="provider" 
                    v-model="newProvider" 
                    class="w-full h-10 px-3 rounded-md bg-background border border-input text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    :disabled="isRegisteringModel"
                  >
                    <option value="openai">OpenAI</option>
                    <option value="openai-compatible">OpenAI-Compatible (Ollama, Groq, DeepSeek)</option>
                    <option value="anthropic">Anthropic</option>
                    <option value="google">Google Gemini</option>
                    <option value="local">Local AI</option>
                  </select>
                </div>

                <!-- API Identifier -->
                <div class="space-y-1.5">
                  <Label for="apiIdentifier">{{ uiStore.direction === 'rtl' ? 'شناسه دقیق مدل (API Model ID)' : 'API Model ID' }}</Label>
                  <Input 
                    id="apiIdentifier" 
                    v-model="newApiIdentifier" 
                    required 
                    class="font-mono" 
                    :disabled="isRegisteringModel"
                    placeholder="e.g. gpt-4o, deepseek-chat, llama3.1" 
                  />
                </div>

                <!-- Base URL (OpenAI-compatible endpoint) -->
                <div class="space-y-1.5">
                  <Label for="baseUrl">{{ uiStore.direction === 'rtl' ? 'آدرس اندپوینت (Base URL - اختیاری)' : 'Base URL (Optional)' }}</Label>
                  <Input 
                    id="baseUrl" 
                    v-model="newBaseUrl" 
                    class="font-mono text-xs" 
                    :disabled="isRegisteringModel"
                    placeholder="https://api.openai.com/v1" 
                  />
                </div>

                <!-- API Key -->
                <div class="space-y-1.5">
                  <Label for="apiKey">{{ uiStore.direction === 'rtl' ? 'کلید دسترسی (API Key - اختیاری)' : 'API Key (Optional)' }}</Label>
                  <Input 
                    id="apiKey" 
                    v-model="newApiKey" 
                    type="password"
                    class="font-mono text-xs" 
                    :disabled="isRegisteringModel"
                    placeholder="sk-..." 
                  />
                </div>

                <!-- Status Toggle -->
                <div class="space-y-1.5 flex flex-col justify-center">
                  <Label>{{ uiStore.direction === 'rtl' ? 'وضعیت اولیه' : 'Initial Status' }}</Label>
                  <label class="flex items-center gap-2 cursor-pointer pt-2">
                    <input type="checkbox" v-model="newIsActive" :disabled="isRegisteringModel" class="rounded accent-primary w-4 h-4 cursor-pointer" />
                    <span class="text-xs font-medium">{{ newIsActive ? (uiStore.direction === 'rtl' ? 'فعال و آماده چت' : 'Active') : (uiStore.direction === 'rtl' ? 'غیرفعال' : 'Inactive') }}</span>
                  </label>
                </div>
              </div>

              <div class="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
                <Button variant="ghost" size="sm" type="button" @click="isAdding = false" :disabled="isRegisteringModel">
                  {{ uiStore.direction === 'rtl' ? 'انصراف' : 'Cancel' }}
                </Button>
                <Button size="sm" type="submit" :loading="isRegisteringModel" :disabled="isRegisteringModel">
                  {{ uiStore.direction === 'rtl' ? 'افزودن و فعال‌سازی' : 'Save Model' }}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </transition>

      <!-- Search & Minimal Filter Bar -->
      <div class="flex items-center justify-between gap-3">
        <div class="relative flex-1 max-w-sm">
          <input
            v-model="searchQuery"
            type="text"
            class="search-input w-full h-9 pl-8 pr-3 bg-card border border-border rounded-lg text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            :placeholder="uiStore.direction === 'rtl' ? 'جستجوی مدل یا ارائه‌دهنده...' : 'Search models...'"
          />
        </div>
        <span class="text-xs text-muted-foreground font-mono">
          {{ filteredModels.length }} {{ uiStore.direction === 'rtl' ? 'مدل' : 'models' }}
        </span>
      </div>

      <!-- Models List (Clean Table) -->
      <div class="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        <table class="dashboard-table w-full text-start text-xs border-collapse">
          <thead>
            <tr class="border-b border-border/80 bg-secondary/30 text-muted-foreground font-medium">
              <th class="p-3 text-center w-16">{{ uiStore.direction === 'rtl' ? 'وضعیت' : 'Status' }}</th>
              <th class="p-3 text-start">{{ uiStore.direction === 'rtl' ? 'نام مدل' : 'Model' }}</th>
              <th class="p-3 text-start hidden sm:table-cell">{{ uiStore.direction === 'rtl' ? 'ارائه‌دهنده' : 'Provider' }}</th>
              <th class="p-3 text-start hidden md:table-cell">{{ uiStore.direction === 'rtl' ? 'اندپوینت / اتصال' : 'Connection' }}</th>
              <th class="p-3 text-end">{{ uiStore.direction === 'rtl' ? 'عملیات' : 'Actions' }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border/60">
            <tr
              v-for="model in filteredModels"
              :key="model.id"
              class="table-row hover:bg-secondary/20 transition-colors"
            >
              <!-- Status Toggle Switch -->
              <td class="p-3 text-center">
                <button
                  type="button"
                  @click="handleToggleStatus(model.id, model.isActive)"
                  :class="[
                    'relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none',
                    model.isActive ? 'bg-emerald-500' : 'bg-muted-foreground/30'
                  ]"
                  :title="model.isActive ? 'Active (Click to deactivate)' : 'Inactive (Click to activate)'"
                >
                  <span
                    :class="[
                      'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out',
                      model.isActive ? (uiStore.direction === 'rtl' ? '-translate-x-4' : 'translate-x-4') : 'translate-x-0'
                    ]"
                  />
                </button>
              </td>

              <!-- Model Name & API Identifier -->
              <td class="p-3">
                <div class="flex items-center gap-2">
                  <span class="font-semibold text-foreground text-sm">{{ model.name }}</span>
                  <span v-if="model.isDefault" class="text-[10px] font-mono uppercase bg-amber-500/15 text-amber-500 border border-amber-500/30 px-1.5 py-0.2 rounded font-semibold">
                    {{ uiStore.direction === 'rtl' ? 'پیش‌فرض' : 'DEFAULT' }}
                  </span>
                </div>
                <div class="text-[11px] font-mono text-muted-foreground pt-0.5">
                  {{ model.apiIdentifier }}
                </div>
              </td>

              <!-- Provider Tag -->
              <td class="p-3 hidden sm:table-cell">
                <span class="px-2 py-0.5 rounded-md text-[11px] font-mono bg-secondary border border-border text-foreground font-medium">
                  {{ model.provider }}
                </span>
              </td>

              <!-- Endpoint / Key Status -->
              <td class="p-3 hidden md:table-cell text-muted-foreground font-mono text-[11px]">
                <span v-if="model.baseUrl" class="text-primary truncate block max-w-[200px]" :title="model.baseUrl">
                  {{ model.baseUrl }}
                </span>
                <span v-else class="text-muted-foreground">
                  Default (Cloud)
                </span>
              </td>

              <!-- Actions (Set Default, Delete) -->
              <td class="p-3 text-end">
                <div class="flex items-center justify-end gap-1.5">
                  <Button
                    v-if="!model.isDefault"
                    variant="ghost"
                    size="sm"
                    class="h-7 text-xs px-2"
                    @click="handleMakeDefault(model.id)"
                  >
                    {{ uiStore.direction === 'rtl' ? 'پیش‌فرض کن' : 'Set Default' }}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    class="h-7 w-7 p-0 text-muted-foreground hover:text-destructive transition-colors"
                    @click="handleDelete(model.id)"
                    :title="uiStore.direction === 'rtl' ? 'حذف مدل' : 'Delete model'"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="3 6 5 6 21 6"/>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                  </Button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <div v-if="filteredModels.length === 0" class="p-8 text-center text-xs text-muted-foreground">
          {{ uiStore.direction === 'rtl' ? 'هیچ مدلی یافت نشد.' : 'No models found.' }}
        </div>
      </div>
    </main>
  </div>
</template>
