<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { Plus, Network, ShieldCheck, Trash2, Edit } from '@lucide/vue'
import BaseButton from '../../components/ui/BaseButton.vue'
import BaseToggle from '../../components/ui/BaseToggle.vue'
import ProviderEditorModal from '../../components/admin/modals/ProviderEditorModal.vue'
import { modelsService } from '../../services/models.service'
import { useUiStore } from '../../stores/ui'
import type { Provider } from '../../types'

const props = defineProps<{
  searchQuery?: string
}>()

defineEmits<{
  deletePrompt: [target: { type: 'provider'; id: string; name: string }]
}>()

const uiStore = useUiStore()
const providers = ref<Provider[]>([])
const isLoading = ref(false)
const isSaving = ref(false)
const errorMessage = ref('')

const page = ref(1)
const pageSize = ref(12)
const totalItems = ref(0)
const totalPages = computed(() => Math.max(1, Math.ceil(totalItems.value / pageSize.value)))
const tableSearchQuery = ref(props.searchQuery || '')

const isEditorModalOpen = ref(false)
const editingProvider = ref<Provider | null>(null)

async function loadProviders() {
  isLoading.value = true
  errorMessage.value = ''
  try {
    const combinedSearch = (tableSearchQuery.value || props.searchQuery || '').trim()
    const params: any = {
      page: page.value,
      limit: pageSize.value,
    }
    if (combinedSearch) params.search = combinedSearch

    const res = await modelsService.listProviders(params)
    if (res && typeof res === 'object' && 'items' in res) {
      providers.value = (res as any).items || []
      totalItems.value = (res as any).total || 0
    } else if (Array.isArray(res)) {
      providers.value = res
      totalItems.value = res.length
    }
  } catch (err: any) {
    errorMessage.value = err?.message || 'خطا در بارگذاری ارائه‌دهنده‌ها'
  } finally {
    isLoading.value = false
  }
}

watch(() => props.searchQuery, (newVal) => {
  tableSearchQuery.value = newVal || ''
  page.value = 1
  loadProviders()
})

function changePage(newPage: number) {
  if (newPage < 1 || newPage > totalPages.value) return
  page.value = newPage
  loadProviders()
}

function openCreateModal() {
  editingProvider.value = null
  isEditorModalOpen.value = true
}

function openEditModal(provider: Provider) {
  editingProvider.value = provider
  isEditorModalOpen.value = true
}

async function handleSaveProvider(payload: { name: string; baseUrl: string; apiKey?: string; isActive: boolean }) {
  isSaving.value = true
  try {
    if (editingProvider.value) {
      await modelsService.updateProvider(editingProvider.value.id, payload)
      uiStore.showToast('ارائه‌دهنده با موفقیت ویرایش شد.', 'success')
    } else {
      await modelsService.createProvider(payload)
      uiStore.showToast('ارائه‌دهنده جدید با موفقیت افزوده شد.', 'success')
    }
    isEditorModalOpen.value = false
    await loadProviders()
  } catch (err: any) {
    uiStore.showToast(err?.message || 'خطا در ذخیره ارائه‌دهنده', 'error')
  } finally {
    isSaving.value = false
  }
}

async function toggleProviderStatus(provider: Provider) {
  try {
    await modelsService.updateProviderStatus(provider.id, !provider.isActive)
    provider.isActive = !provider.isActive
    uiStore.showToast(`وضعیت ارائه‌دهنده «${provider.name}» به‌روز شد.`, 'info')
  } catch (err: any) {
    uiStore.showToast(err?.message || 'خطا در تغییر وضعیت ارائه‌دهنده', 'error')
  }
}

onMounted(loadProviders)
</script>

<template>
  <div class="providers-section space-y-5">
    <div class="section-toolbar flex items-center justify-between">
      <div>
        <h3 class="text-base font-bold text-foreground">مدیریت ارائه‌دهنده‌های هوش مصنوعی (AI Providers)</h3>
        <p class="text-xs text-muted-foreground mt-0.5">پیکربندی کلیدهای API و آدرس‌های اتصال به سرویس‌دهندگان هوش مصنوعی</p>
      </div>
      <BaseButton variant="primary" size="md" @click="openCreateModal">
        <Plus :size="16" />
        <span>افزودن ارائه‌دهنده</span>
      </BaseButton>
    </div>

    <div v-if="errorMessage" class="error-banner p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive">
      {{ errorMessage }}
    </div>

    <!-- Providers Grid Cards -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <div
        v-for="p in providers"
        :key="p.id"
        class="provider-card p-4 rounded-xl border border-border bg-card shadow-sm flex flex-col justify-between transition-all hover:border-primary/40"
      >
        <div class="space-y-3">
          <div class="flex items-start justify-between">
            <div class="flex items-center gap-2.5">
              <div class="p-2 rounded-lg bg-primary/10 text-primary">
                <Network :size="20" />
              </div>
              <div>
                <strong class="text-sm font-bold text-foreground block">{{ p.name }}</strong>
                <span class="text-[11px] text-muted-foreground block mono">{{ p.id.slice(0, 8) }}...</span>
              </div>
            </div>
            <span
              class="px-2 py-0.5 rounded-full text-[11px] font-medium border"
              :class="p.isActive ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-muted text-muted-foreground border-border'"
            >
              {{ p.isActive ? 'فعال' : 'غیرفعال' }}
            </span>
          </div>

          <div class="provider-meta space-y-1.5 text-xs">
            <div class="flex items-center justify-between text-muted-foreground">
              <span>آدرس Base URL:</span>
              <span class="mono text-[11px] text-foreground max-w-[180px] truncate" :title="p.baseUrl || 'پیش‌فرض'">
                {{ p.baseUrl || '—' }}
              </span>
            </div>
            <div class="flex items-center justify-between text-muted-foreground">
              <span>وضعیت کلید API:</span>
              <span class="text-foreground flex items-center gap-1 text-[11px]">
                <ShieldCheck :size="13" class="text-emerald-500" />
                <span>پیکربندی‌شده</span>
              </span>
            </div>
          </div>
        </div>

        <div class="card-footer mt-4 pt-3 border-t border-border flex items-center justify-between">
          <div class="flex items-center gap-2">
            <BaseToggle :model-value="p.isActive" size="sm" @update:model-value="toggleProviderStatus(p)" />
            <span class="text-xs text-muted-foreground">{{ p.isActive ? 'فعال' : 'غیرفعال' }}</span>
          </div>

          <div class="flex items-center gap-1.5">
            <BaseButton variant="ghost" size="sm" @click="openEditModal(p)" title="ویرایش">
              <Edit :size="14" />
            </BaseButton>
            <BaseButton variant="ghost" size="sm" class="text-destructive hover:bg-destructive/10" @click="$emit('deletePrompt', { type: 'provider', id: p.id, name: p.name })" title="حذف">
              <Trash2 :size="14" />
            </BaseButton>
          </div>
        </div>
      </div>

      <div v-if="!providers.length && !isLoading" class="col-span-full p-8 rounded-xl border border-dashed border-border text-center text-xs text-muted-foreground">
        هیچ ارائه‌دهنده‌ای یافت نشد.
      </div>
    </div>

    <!-- Providers Pagination -->
    <div v-if="totalPages > 1" class="flex items-center justify-between p-3 rounded-xl border border-border bg-card text-xs">
      <span class="text-muted-foreground">
        مجموع {{ totalItems.toLocaleString('fa-IR') }} ارائه‌دهنده
      </span>
      <div class="flex items-center gap-2">
        <button
          type="button"
          class="px-2.5 py-1 rounded border border-border bg-background disabled:opacity-50 cursor-pointer hover:bg-muted"
          :disabled="page <= 1"
          @click="changePage(page - 1)"
        >
          قبلی
        </button>
        <span class="font-mono font-bold">{{ page }} / {{ totalPages }}</span>
        <button
          type="button"
          class="px-2.5 py-1 rounded border border-border bg-background disabled:opacity-50 cursor-pointer hover:bg-muted"
          :disabled="page >= totalPages"
          @click="changePage(page + 1)"
        >
          بعدی
        </button>
      </div>
    </div>

    <!-- Provider Editor Modal Component -->
    <ProviderEditorModal
      :open="isEditorModalOpen"
      :provider="editingProvider"
      :isSaving="isSaving"
      @close="isEditorModalOpen = false"
      @save="handleSaveProvider"
    />
  </div>
</template>

<style scoped>
.mono {
  font-family: var(--font-mono, monospace);
  direction: ltr;
}
</style>
