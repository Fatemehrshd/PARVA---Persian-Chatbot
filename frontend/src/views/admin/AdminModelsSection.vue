<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { Plus, Edit, Trash2, Star } from '@lucide/vue'
import AdminTable, { type TableColumn } from '../../components/admin/AdminTable.vue'
import AdminTableSkeleton from '../../components/admin/AdminTableSkeleton.vue'
import ModelAccessBadge from '../../components/admin/ModelAccessBadge.vue'
import BaseButton from '../../components/ui/BaseButton.vue'
import BaseToggle from '../../components/ui/BaseToggle.vue'
import ModelEditorModal from '../../components/admin/modals/ModelEditorModal.vue'
import { modelsService } from '../../services/models.service'
import { adminService } from '../../services/admin.service'
import { useUiStore } from '../../stores/ui'
import { useModelsStore } from '../../stores/models'
import { markDefaultModel } from '../../utils/models'
import CapabilityBadge from '../../components/chat/CapabilityBadge.vue'
import type { AdminUser, Model, ModelAccessLevel, Provider } from '../../types'

const props = defineProps<{
  searchQuery?: string
}>()

defineEmits<{
  deletePrompt: [target: { type: 'model'; id: string; name: string }]
}>()

const uiStore = useUiStore()
const modelsStore = useModelsStore()
const models = ref<Model[]>(modelsStore.models)
const providers = ref<Provider[]>([])
const users = ref<AdminUser[]>([])
const isLoading = ref(false)
const isSaving = ref(false)
const errorMessage = ref('')

const page = ref(1)
const pageSize = ref(10)
const totalItems = ref(modelsStore.models.length)
const sortBy = ref<string | undefined>(undefined)
const sortOrder = ref<'ASC' | 'DESC' | undefined>(undefined)
const columnFilters = ref<Record<string, string>>({})
const tableSearchQuery = ref(props.searchQuery || '')
const searchField = ref('')

const isEditorModalOpen = ref(false)
const editingModel = ref<Model | null>(null)

const modelColumns: TableColumn[] = [
  { key: 'name', label: 'نام مدل', width: '220px', sortable: true },
  { key: 'provider', label: 'ارائه‌دهنده', width: '150px', sortable: true },
  { key: 'apiIdentifier', label: 'شناسه API', width: '200px', sortable: true },
  { key: 'accessLevel', label: 'دسترسی', width: '110px' },
  { key: 'isActive', label: 'وضعیت', width: '110px' },
  { key: 'actions', label: 'عملیات', align: 'center', width: '100px', sortable: false },
]

async function loadModels() {
  isLoading.value = true
  errorMessage.value = ''
  try {
    const combinedSearch = (tableSearchQuery.value || props.searchQuery || '').trim()
    const params: any = {
      page: page.value,
      limit: pageSize.value,
    }
    if (combinedSearch) params.search = combinedSearch
    if (searchField.value) params.searchField = searchField.value
    if (sortBy.value) {
      params.sortBy = sortBy.value
      params.sortOrder = sortOrder.value
    }
    for (const [k, v] of Object.entries(columnFilters.value)) {
      if (v) params[k] = v
    }

    const [mRes, pRes, uRes] = await Promise.allSettled([
      modelsService.listModels(params),
      modelsService.listProviders(),
      // The private-model whitelist picker needs the user directory (admin-only).
      adminService.listUsers(),
    ])

    if (mRes.status === 'fulfilled') {
      const val = mRes.value
      if (val && typeof val === 'object' && 'items' in val) {
        models.value = (val as any).items || []
        totalItems.value = (val as any).total || 0
      } else if (Array.isArray(val)) {
        models.value = val
        totalItems.value = val.length
      }
    } else {
      // Fallback for offline tests or disconnected environments
      const q = combinedSearch.toLowerCase()
      let filtered = modelsStore.models
      if (q) {
        filtered = filtered.filter(
          (m) =>
            m.name?.toLowerCase().includes(q) ||
            m.apiIdentifier?.toLowerCase().includes(q) ||
            m.provider?.toLowerCase().includes(q)
        )
      }
      models.value = filtered
      totalItems.value = filtered.length
    }
    if (pRes.status === 'fulfilled') {
      providers.value = Array.isArray(pRes.value) ? pRes.value : (pRes.value as any)?.items || []
    }
    if (uRes.status === 'fulfilled') {
      const val = uRes.value as any
      users.value = Array.isArray(val) ? val : val?.items || []
    }
  } catch (err: any) {
    errorMessage.value = err?.message || 'خطا در بارگذاری مدل‌ها'
  } finally {
    isLoading.value = false
  }
}

watch(() => props.searchQuery, (newVal) => {
  tableSearchQuery.value = newVal || ''
  page.value = 1
  const q = (newVal || '').trim().toLowerCase()
  if (q) {
    models.value = modelsStore.models.filter(
      (m) =>
        m.name?.toLowerCase().includes(q) ||
        m.apiIdentifier?.toLowerCase().includes(q) ||
        m.provider?.toLowerCase().includes(q)
    )
  } else {
    models.value = modelsStore.models
  }
  loadModels()
})

function handlePageChange(newPage: number) {
  page.value = newPage
  loadModels()
}

function handlePageSizeChange(newSize: number) {
  pageSize.value = newSize
  page.value = 1
  loadModels()
}

function handleSearch(query: string, field?: string) {
  tableSearchQuery.value = query
  searchField.value = field || ''
  page.value = 1
  const q = query.trim().toLowerCase()
  if (q) {
    models.value = modelsStore.models.filter(
      (m) =>
        m.name?.toLowerCase().includes(q) ||
        m.apiIdentifier?.toLowerCase().includes(q) ||
        m.provider?.toLowerCase().includes(q)
    )
  }
  loadModels()
}

function handleSortChange(col: string | null, order: 'asc' | 'desc' | null) {
  sortBy.value = col || undefined
  sortOrder.value = order ? (order.toUpperCase() as 'ASC' | 'DESC') : undefined
  loadModels()
}

function handleColumnFilterChange(filters: Record<string, string>) {
  columnFilters.value = filters
  page.value = 1
  loadModels()
}

function openCreateModel() {
  editingModel.value = null
  isEditorModalOpen.value = true
}

function openEditModel(model: Model) {
  editingModel.value = model
  isEditorModalOpen.value = true
}

async function handleSaveModel(payload: { name: string; provider: string; providerId?: string; apiIdentifier: string; isActive: boolean; accessLevel: ModelAccessLevel; allowedUserIds: string[] }) {
  isSaving.value = true
  const previous = [...models.value]
  if (editingModel.value) {
    // Optimistic update: reflect the edit immediately, roll back if the API fails.
    const target = models.value.find((m) => m.id === editingModel.value!.id)
    if (target) Object.assign(target, payload)
  } else {
    // Optimistic insert with a temporary id until the server assigns one.
    models.value = [
      ...models.value,
      {
        id: `temp-${Date.now()}`,
        isDefault: false,
        createdAt: new Date().toISOString(),
        ...payload,
      } as Model,
    ]
  }
  isEditorModalOpen.value = false
  try {
    if (editingModel.value) {
      await modelsService.updateModel(editingModel.value.id, payload)
      uiStore.showToast('مدل با موفقیت ویرایش شد.', 'success')
    } else {
      await modelsStore.addModel(payload)
      uiStore.showToast('مدل جدید با موفقیت اضافه شد.', 'success')
    }
    await loadModels()
    await modelsStore.fetchModels(true).catch(() => {})
  } catch (err: any) {
    models.value = previous
    uiStore.showToast(err?.message || 'ذخیره مدل با خطا مواجه شد', 'error')
  } finally {
    isSaving.value = false
  }
}

async function toggleModel(model: Model) {
  // Optimistic: flip the switch now, revert on failure.
  const next = !model.isActive
  model.isActive = next
  try {
    await modelsService.updateModelStatus(model.id, next)
    uiStore.showToast(`وضعیت مدل «${model.name}» تغییر کرد.`, 'info')
  } catch (err: any) {
    model.isActive = !next
    uiStore.showToast(err?.message || 'خطا در تغییر وضعیت مدل', 'error')
  }
}

async function setPlatformDefault(model: Model) {
  const prevId = markDefaultModel(modelsStore.models, model.id)
  models.value.forEach((m) => {
    m.isDefault = m.id === model.id
  })
  try {
    await modelsService.setDefaultModel(model.id)
    await modelsStore.fetchModels(true).catch(() => {})
    uiStore.showToast(`مدل «${model.name}» به عنوان پیش‌فرض پلتفرم انتخاب شد.`, 'success')
  } catch (error: any) {
    if (prevId !== undefined) {
      markDefaultModel(modelsStore.models, prevId)
      models.value.forEach((m) => {
        m.isDefault = m.id === prevId
      })
    } else {
      modelsStore.models.forEach((m) => {
        m.isDefault = false
      })
      models.value.forEach((m) => {
        m.isDefault = false
      })
    }
    errorMessage.value = error?.message || 'تنظیم مدل پیش‌فرض با خطا مواجه شد'
  }
}

onMounted(loadModels)
</script>

<template>
  <div class="models-section space-y-4">
    <div class="section-toolbar flex items-center justify-between">
      <div>
        <h3 class="text-base font-bold text-foreground">مدل‌های هوش مصنوعی (AI Models)</h3>
      </div>
      <BaseButton variant="primary" size="md" @click="openCreateModel">
        <Plus :size="16" />
        <span>افزودن مدل جدید</span>
      </BaseButton>
    </div>

    <div v-if="errorMessage" class="error-banner p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive">
      {{ errorMessage }}
    </div>

    <AdminTableSkeleton v-if="isLoading" :rows="pageSize" :columns="modelColumns.length" />

    <AdminTable
      v-else
      :columns="modelColumns"
      :items="models"
      tableClass="dashboard-table"
      serverSide
      paginated
      searchable
      :currentPage="page"
      :pageSize="pageSize"
      :totalItems="totalItems"
      :pageSizes="[10, 25, 50, 100]"
      :searchQuery="tableSearchQuery"
      :searchFields="[
        { key: 'name', label: 'نام مدل' },
        { key: 'provider', label: 'ارائه‌دهنده' },
        { key: 'apiIdentifier', label: 'شناسه API' },
      ]"
      @update:page="handlePageChange"
      @update:pageSize="handlePageSizeChange"
      @search="handleSearch"
      @sortChange="handleSortChange"
      @columnFilterChange="handleColumnFilterChange"
    >
      <template #row="{ item: model }">
        <td data-label="نام مدل" class="font-semibold text-foreground">
          <div class="flex items-center gap-2">
            <span>{{ model.name }}</span>
            <span
              v-if="model.isDefault"
              class="text-[10px] px-1.5 py-0.5 rounded font-mono bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30"
            >
              پیش‌فرض
            </span>
            <CapabilityBadge v-if="model.supportsThinking" capability="thinking" size="sm" />
            <CapabilityBadge v-if="model.supportsVision" capability="vision" size="sm" />
            <CapabilityBadge v-if="model.supportsDocument" capability="document" size="sm" />
          </div>
        </td>
        <td data-label="ارائه‌دهنده">
          <span class="provider-pill px-2.5 py-1 rounded text-xs bg-muted text-muted-foreground font-medium">
            {{ model.provider }}
          </span>
        </td>
        <td data-label="شناسه API" class="mono text-xs text-muted-foreground">
          {{ model.apiIdentifier }}
        </td>
        <td data-label="دسترسی">
          <ModelAccessBadge :level="model.accessLevel" />
        </td>
        <td data-label="وضعیت">
          <BaseToggle
            :model-value="model.isActive"
            size="sm"
            @update:model-value="toggleModel(model)"
          />
        </td>
        <td data-label="عملیات" class="text-left">
          <div class="flex items-center justify-end gap-1.5">
            <BaseButton
              variant="ghost"
              size="sm"
              :title="model.isDefault ? 'مدل پیش‌فرض فعلی' : 'تعیین به‌عنوان مدل پیش‌فرض سراسری'"
              :disabled="model.isDefault"
              data-testid="make-default-model"
              @click="setPlatformDefault(model)"
            >
              <Star :size="14" :class="model.isDefault ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground'" />
            </BaseButton>
            <BaseButton variant="ghost" size="sm" @click="openEditModel(model)" title="ویرایش">
              <Edit :size="14" />
            </BaseButton>
            <BaseButton variant="ghost" size="sm" class="text-destructive hover:bg-destructive/10" @click="$emit('deletePrompt', { type: 'model', id: model.id, name: model.name })" title="حذف">
              <Trash2 :size="14" />
            </BaseButton>
          </div>
        </td>
      </template>
    </AdminTable>

    <!-- Model Editor Modal Component -->
    <ModelEditorModal
      :open="isEditorModalOpen"
      :model="editingModel"
      :providers="providers"
      :users="users"
      :isSaving="isSaving"
      @close="isEditorModalOpen = false"
      @save="handleSaveModel"
    />
  </div>
</template>

<style scoped>
.mono {
  font-family: var(--font-mono, monospace);
  direction: ltr;
}
</style>
