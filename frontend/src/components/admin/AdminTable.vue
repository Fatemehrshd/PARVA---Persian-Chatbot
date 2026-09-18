<script setup lang="ts">
import { computed, ref, watch } from 'vue'

export interface TableColumn {
  key: string
  label: string
  class?: string
  align?: 'right' | 'left' | 'center'
  sortable?: boolean
  filterable?: boolean
}

const props = withDefaults(
  defineProps<{
    columns: TableColumn[]
    items: any[]
    emptyText?: string
    tableClass?: string
    // قابلیت‌های پیشرفته دیتاگرید (MUI DataGrid Style)
    paginated?: boolean
    pageSize?: number
    pageSizes?: number[]
    serverSide?: boolean
    totalItems?: number
    currentPage?: number
    searchable?: boolean
    searchFields?: Array<{ key: string; label: string }>
    defaultShowColumnFilters?: boolean
  }>(),
  {
    emptyText: 'هیچ موردی برای نمایش یافت نشد.',
    tableClass: '',
    paginated: false,
    pageSize: 10,
    pageSizes: () => [10, 25, 50, 100],
    serverSide: false,
    totalItems: undefined,
    currentPage: 1,
    searchable: false,
    searchFields: () => [],
    defaultShowColumnFilters: false,
  }
)

const emit = defineEmits<{
  (e: 'update:page', page: number): void
  (e: 'update:pageSize', size: number): void
  (e: 'search', query: string, field: string): void
  (e: 'columnFilterChange', filters: Record<string, string>): void
  (e: 'sortChange', column: string | null, order: 'asc' | 'desc' | null): void
}>()

// مدیریت پیجینیشن کلاینت‌ساید و سرورساید
const internalPage = ref(props.currentPage)
const internalPageSize = ref(props.pageSize)

watch(
  () => props.currentPage,
  (val) => {
    internalPage.value = val
  }
)

watch(
  () => props.pageSize,
  (val) => {
    internalPageSize.value = val
  }
)

// فیلتر و جستجوی فیلدی محلی
const selectedSearchField = ref(props.searchFields[0]?.key || (props.columns[0]?.key ?? ''))
const searchQuery = ref('')

// فیلترهای ستونی مجزا (MUI DataGrid Column Filters)
const showColumnFilters = ref(props.defaultShowColumnFilters)
const columnFilters = ref<Record<string, string>>({})

// مرتب‌سازی ستونی (Column Sorting)
const sortColumn = ref<string | null>(null)
const sortOrder = ref<'asc' | 'desc' | null>(null)

const effectiveSearchFields = computed(() => {
  if (props.searchFields && props.searchFields.length > 0) return props.searchFields
  return props.columns.filter((c) => c.key !== 'actions' && c.key !== 'status')
})

const activeFiltersCount = computed(() => {
  let count = 0
  if (searchQuery.value.trim()) count++
  for (const k in columnFilters.value) {
    if (columnFilters.value[k]?.trim()) count++
  }
  return count
})

const filteredItems = computed(() => {
  if (props.serverSide) {
    return props.items || []
  }

  let res = props.items || []

  // ۱. اعمال جستجوی سراسری / فیلدی
  if (props.searchable && searchQuery.value.trim()) {
    const q = searchQuery.value.trim().toLowerCase()
    const field = selectedSearchField.value
    res = res.filter((item) => {
      if (field && item[field] !== undefined && item[field] !== null) {
        return String(item[field]).toLowerCase().includes(q)
      }
      return Object.values(item).some((val) => String(val).toLowerCase().includes(q))
    })
  }

  // ۲. اعمال فیلترهای ستونی مجزا (Inline Column Filters)
  for (const key in columnFilters.value) {
    const val = columnFilters.value[key]?.trim().toLowerCase()
    if (val) {
      res = res.filter((item) => {
        const itemVal = item[key]
        if (itemVal === undefined || itemVal === null) return false
        return String(itemVal).toLowerCase().includes(val)
      })
    }
  }

  // ۳. اعمال مرتب‌سازی ستونی
  if (sortColumn.value && sortOrder.value) {
    const col = sortColumn.value
    const ord = sortOrder.value
    res = [...res].sort((a, b) => {
      const valA = a[col]
      const valB = b[col]
      if (valA === valB) return 0
      if (valA === undefined || valA === null) return 1
      if (valB === undefined || valB === null) return -1
      if (typeof valA === 'number' && typeof valB === 'number') {
        return ord === 'asc' ? valA - valB : valB - valA
      }
      return ord === 'asc'
        ? String(valA).localeCompare(String(valB), 'fa')
        : String(valB).localeCompare(String(valA), 'fa')
    })
  }

  return res
})

const effectiveTotal = computed(() => {
  if (props.serverSide && props.totalItems !== undefined) return props.totalItems
  return filteredItems.value.length
})

const totalPages = computed(() => {
  if (!props.paginated) return 1
  return Math.max(1, Math.ceil(effectiveTotal.value / internalPageSize.value))
})

const displayItems = computed(() => {
  if (!props.paginated || props.serverSide) {
    return filteredItems.value
  }
  const start = (internalPage.value - 1) * internalPageSize.value
  const end = start + internalPageSize.value
  return filteredItems.value.slice(start, end)
})

function changePage(newPage: number) {
  if (newPage < 1 || newPage > totalPages.value) return
  internalPage.value = newPage
  emit('update:page', newPage)
}

function onPageSizeChange(e: Event) {
  const target = e.target as HTMLSelectElement
  const newSize = Number(target.value) || 10
  internalPageSize.value = newSize
  internalPage.value = 1
  emit('update:pageSize', newSize)
  emit('update:page', 1)
}

function handleSearchInput() {
  if (!props.serverSide) {
    internalPage.value = 1
  }
  emit('search', searchQuery.value, selectedSearchField.value)
}

function handleColumnFilterInput(_colKey?: string) {
  if (!props.serverSide) {
    internalPage.value = 1
  }
  emit('columnFilterChange', { ...columnFilters.value })
}

function clearColumnFilter(colKey: string) {
  columnFilters.value[colKey] = ''
  handleColumnFilterInput(colKey)
}

function handleHeaderClick(col: TableColumn) {
  if (col.key === 'actions' || col.sortable === false) return
  if (sortColumn.value !== col.key) {
    sortColumn.value = col.key
    sortOrder.value = 'asc'
  } else if (sortOrder.value === 'asc') {
    sortOrder.value = 'desc'
  } else {
    sortColumn.value = null
    sortOrder.value = null
  }
  emit('sortChange', sortColumn.value, sortOrder.value)
}

function clearAllFilters() {
  searchQuery.value = ''
  columnFilters.value = {}
  sortColumn.value = null
  sortOrder.value = null
  internalPage.value = 1
  emit('search', '', selectedSearchField.value)
  emit('columnFilterChange', {})
  emit('sortChange', null, null)
}

function toPersianDigits(n: number | string): string {
  return String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)])
}
</script>

<template>
  <div class="admin-table-container">
    <!-- نوار ابزار پیشرفته دیتاگرید (MUI DataGrid Toolbar) -->
    <div v-if="searchable" class="data-grid-toolbar">
      <div class="search-field-wrapper">
        <select
          v-if="effectiveSearchFields.length > 1"
          v-model="selectedSearchField"
          class="search-field-select"
          title="انتخاب فیلد برای جستجو"
        >
          <option value="">همه فیلدها</option>
          <option
            v-for="f in effectiveSearchFields"
            :key="f.key"
            :value="f.key"
          >
            جستجو در: {{ f.label }}
          </option>
        </select>
        <div class="search-input-box">
          <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="جستجوی سریع در جدول..."
            class="search-text-input"
            @input="handleSearchInput"
          />
          <button
            v-if="searchQuery"
            type="button"
            class="clear-search-btn"
            @click="searchQuery = ''; handleSearchInput()"
            title="پاک کردن جستجو"
          >
            ✕
          </button>
        </div>
      </div>

      <div class="toolbar-actions-group flex items-center gap-2">
        <!-- دکمه نمایش / پنهان‌سازی فیلترهای ستونی (Column Filters) -->
        <button
          type="button"
          class="data-grid-action-btn"
          :class="{ 'btn-active': showColumnFilters }"
          title="فیلتر اختصاصی بر روی هر ستون جدول"
          @click="showColumnFilters = !showColumnFilters"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
          </svg>
          <span>فیلتر ستون‌ها</span>
          <span v-if="activeFiltersCount > 0" class="filter-count-badge font-mono">
            {{ toPersianDigits(activeFiltersCount) }}
          </span>
        </button>

        <!-- دکمه پاک‌سازی همه فیلترها در صورت فعال بودن فیلتر -->
        <button
          v-if="activeFiltersCount > 0"
          type="button"
          class="data-grid-action-btn clear-all-btn text-destructive hover:bg-destructive/10"
          title="پاک‌سازی تمامی فیلترها"
          @click="clearAllFilters"
        >
          <span>حذف فیلترها</span>
        </button>

        <slot name="toolbar-actions" />
      </div>
    </div>

    <!-- جدول با اسکرول افقی پایدار روی همه سایزها (بدون شکستن ستون‌ها در موبایل) -->
    <div class="admin-table-scroll">
      <table class="admin-table" :class="tableClass">
        <thead>
          <!-- ردیف هدر اصلی با قابلیت مرتب‌سازی ستونی -->
          <tr>
            <th
              v-for="col in columns"
              :key="col.key"
              :class="[
                col.class,
                col.align === 'left' ? 'text-left' : col.align === 'center' ? 'text-center' : 'text-right',
                col.key !== 'actions' && col.sortable !== false ? 'sortable-header' : ''
              ]"
              @click="handleHeaderClick(col)"
            >
              <div class="th-content flex items-center gap-1.5" :class="col.align === 'left' ? 'justify-start' : col.align === 'center' ? 'justify-center' : 'justify-end'">
                <span>{{ col.label }}</span>
                <span
                  v-if="col.key !== 'actions' && col.sortable !== false"
                  class="sort-icon-indicator text-[11px]"
                  :class="{ 'is-active': sortColumn === col.key }"
                >
                  {{ sortColumn === col.key ? (sortOrder === 'asc' ? '▲' : '▼') : '↕' }}
                </span>
              </div>
            </th>
          </tr>

          <!-- ردیف فیلترهای ستونی مجزا (MUI DataGrid Inline Column Filters) -->
          <tr v-if="showColumnFilters" class="column-filters-row">
            <th
              v-for="col in columns"
              :key="`filter-cell-${col.key}`"
              class="column-filter-th"
            >
              <div v-if="col.key !== 'actions' && col.filterable !== false" class="col-filter-box">
                <input
                  v-model="columnFilters[col.key]"
                  type="text"
                  :placeholder="`فیلتر ${col.label}...`"
                  class="col-filter-input"
                  @input="handleColumnFilterInput(col.key)"
                />
                <button
                  v-if="columnFilters[col.key]"
                  type="button"
                  class="clear-col-btn"
                  title="پاک کردن"
                  @click="clearColumnFilter(col.key)"
                >
                  ×
                </button>
              </div>
            </th>
          </tr>
        </thead>
        <tbody v-if="displayItems && displayItems.length > 0">
          <slot name="body" :items="displayItems">
            <tr
              v-for="(item, index) in displayItems"
              :key="item.id || index"
              class="table-row"
            >
              <slot name="row" :item="item" :index="index">
                <td
                  v-for="col in columns"
                  :key="col.key"
                  :data-label="col.label"
                  :class="col.align === 'left' ? 'text-left' : col.align === 'center' ? 'text-center' : 'text-right'"
                >
                  {{ item[col.key] }}
                </td>
              </slot>
            </tr>
          </slot>
        </tbody>

        <!-- استیت خالی تمیز و متصل به ساختار جدول -->
        <tbody v-else>
          <tr>
            <td :colspan="columns.length" class="admin-table-empty">
              <slot name="empty">
                <div class="empty-content">
                  <div class="empty-icon-circle">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
                      <circle cx="11" cy="11" r="8"></circle>
                      <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                  </div>
                  <p class="empty-state">{{ emptyText }}</p>
                </div>
              </slot>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- نوار پیجینیشن دیتاگرید با امکان انتخاب تعداد در صفحه (مشابه MUI / DataGrid) -->
    <div v-if="paginated && effectiveTotal > 0" class="data-grid-pagination">
      <div class="pagination-page-size flex items-center gap-2">
        <span class="text-xs text-muted-foreground">تعداد در هر صفحه:</span>
        <select
          :value="internalPageSize"
          class="page-size-dropdown"
          @change="onPageSizeChange"
        >
          <option v-for="size in pageSizes" :key="size" :value="size">
            {{ toPersianDigits(size) }} تایی
          </option>
        </select>
      </div>

      <div class="pagination-counter text-xs text-muted-foreground">
        <span>نمایش </span>
        <strong class="font-mono text-foreground">{{ toPersianDigits((internalPage - 1) * internalPageSize + 1) }}</strong>
        <span> تا </span>
        <strong class="font-mono text-foreground">{{ toPersianDigits(Math.min(internalPage * internalPageSize, effectiveTotal)) }}</strong>
        <span> از مجموع </span>
        <strong class="font-mono text-foreground">{{ toPersianDigits(effectiveTotal) }}</strong>
        <span> ردیف</span>
      </div>

      <div class="pagination-nav-buttons flex items-center gap-1.5">
        <button
          type="button"
          class="nav-btn"
          :disabled="internalPage <= 1"
          @click="changePage(internalPage - 1)"
          title="صفحه قبلی"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
          <span>قبلی</span>
        </button>

        <span class="page-badge font-mono text-xs font-bold">
          {{ toPersianDigits(internalPage) }} / {{ toPersianDigits(totalPages) }}
        </span>

        <button
          type="button"
          class="nav-btn"
          :disabled="internalPage >= totalPages"
          @click="changePage(internalPage + 1)"
          title="صفحه بعدی"
        >
          <span>بعدی</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.admin-table-container {
  width: 100%;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: color-mix(in srgb, var(--card) 95%, transparent);
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

/* نوار ابزار جستجو (MUI DataGrid Toolbar) */
.data-grid-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  background: color-mix(in srgb, var(--muted) 25%, transparent);
}

.search-field-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 280px;
  max-width: 500px;
}

.search-field-select {
  padding: 6px 10px;
  font-size: 12px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--background);
  color: var(--foreground);
  font-family: inherit;
  cursor: pointer;
  white-space: nowrap;
}

.search-input-box {
  position: relative;
  display: flex;
  align-items: center;
  flex: 1;
}

.search-icon {
  position: absolute;
  right: 10px;
  color: var(--muted-foreground);
  pointer-events: none;
}

.search-text-input {
  width: 100%;
  padding: 6px 32px 6px 28px;
  font-size: 12.5px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--background);
  color: var(--foreground);
  font-family: inherit;
  transition: border-color 0.15s;
}

.search-text-input:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--primary) 20%, transparent);
}

.clear-search-btn {
  position: absolute;
  left: 8px;
  background: none;
  border: none;
  color: var(--muted-foreground);
  font-size: 11px;
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 4px;
}

.clear-search-btn:hover {
  color: var(--foreground);
}

/* دکمه‌های اکشن دیتاگرید */
.data-grid-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 500;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--card);
  color: var(--foreground);
  cursor: pointer;
  transition: all 0.15s ease;
}

.data-grid-action-btn:hover {
  background: var(--secondary);
}

.data-grid-action-btn.btn-active {
  background: color-mix(in srgb, var(--primary) 12%, transparent);
  border-color: var(--primary);
  color: var(--primary);
}

.filter-count-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  font-size: 10.5px;
  font-weight: 700;
  border-radius: 50%;
  background: var(--primary);
  color: var(--primary-foreground);
}

/* اسکرول افقی پایدار برای موبایل و دسکتاپ */
.admin-table-scroll {
  width: 100%;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.admin-table {
  width: 100%;
  min-width: 720px;
  border-collapse: collapse;
  text-align: right;
  font-family: inherit;
}

.admin-table th {
  padding: 12px 16px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--muted-foreground);
  background: color-mix(in srgb, var(--muted) 45%, transparent);
  border-bottom: 1px solid var(--border);
  white-space: nowrap;
}

.sortable-header {
  cursor: pointer;
  user-select: none;
  transition: color 0.15s ease;
}

.sortable-header:hover {
  color: var(--foreground);
  background: color-mix(in srgb, var(--muted) 60%, transparent);
}

.sort-icon-indicator {
  opacity: 0.4;
  transition: opacity 0.15s;
}

.sort-icon-indicator.is-active {
  opacity: 1;
  color: var(--primary);
  font-weight: bold;
}

/* ردیف فیلترهای ستونی (Inline Column Filter Row) */
.column-filters-row th {
  padding: 6px 10px;
  background: color-mix(in srgb, var(--muted) 30%, transparent);
  border-bottom: 2px solid var(--border);
}

.col-filter-box {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
}

.col-filter-input {
  width: 100%;
  padding: 4px 8px 4px 22px;
  font-size: 11.5px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--card);
  color: var(--foreground);
  font-family: inherit;
  outline: none;
  transition: border-color 0.15s;
}

.col-filter-input:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 1px var(--primary);
}

.clear-col-btn {
  position: absolute;
  left: 4px;
  background: none;
  border: none;
  color: var(--muted-foreground);
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  padding: 0 2px;
}

.clear-col-btn:hover {
  color: var(--foreground);
}

.admin-table :deep(td) {
  padding: 12px 16px;
  font-size: 13px;
  color: var(--foreground);
  border-bottom: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
  vertical-align: middle;
}

.admin-table :deep(tr.table-row) {
  transition: background-color 0.15s ease;
}

.admin-table :deep(tr.table-row:hover) {
  background: color-mix(in srgb, var(--muted) 35%, transparent);
}

.admin-table :deep(tr:last-child td) {
  border-bottom: none;
}

/* استیت خالی */
.admin-table-empty {
  padding: 48px 20px;
  text-align: center;
}

.empty-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.empty-icon-circle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--muted) 40%, transparent);
  color: var(--muted-foreground);
  opacity: 0.75;
}

.empty-state {
  margin: 0;
  font-size: 13.5px;
  font-weight: 500;
  color: var(--muted-foreground);
}

/* نوار پیجینیشن دیتاگرید */
.data-grid-pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  padding: 12px 18px;
  background: color-mix(in srgb, var(--card) 95%, transparent);
  border-top: 1px solid var(--border);
  font-size: 12.5px;
}

.page-size-dropdown {
  padding: 4px 8px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--background);
  color: var(--foreground);
  font-size: 12px;
  font-family: inherit;
  cursor: pointer;
}

.nav-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 10px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--background);
  color: var(--foreground);
  font-size: 12px;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.15s ease;
}

.nav-btn:hover:not(:disabled) {
  background: var(--muted);
  border-color: var(--border);
}

.nav-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.page-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 32px;
  height: 28px;
  padding: 0 8px;
  border-radius: 6px;
  background: color-mix(in srgb, var(--primary) 12%, transparent);
  color: var(--primary);
  border: 1px solid color-mix(in srgb, var(--primary) 25%, transparent);
}

@media (max-width: 640px) {
  .data-grid-pagination {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
  }
  .pagination-counter {
    text-align: center;
  }
  .pagination-nav-buttons {
    justify-content: center;
  }
  .pagination-page-size {
    justify-content: center;
  }
}
</style>
