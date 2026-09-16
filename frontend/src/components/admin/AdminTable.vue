<script setup lang="ts">
export interface TableColumn {
  key: string
  label: string
  class?: string
  align?: 'right' | 'left' | 'center'
}

withDefaults(
  defineProps<{
    columns: TableColumn[]
    items: any[]
    emptyText?: string
    tableClass?: string
  }>(),
  {
    emptyText: '??????? ???? ????? ???? ?????.',
    tableClass: '',
  }
)
</script>

<template>
  <div class="admin-table-container">
    <div class="admin-table-scroll">
      <table class="admin-table" :class="tableClass">
        <thead>
          <tr>
            <th
              v-for="col in columns"
              :key="col.key"
              :class="[
                col.class,
                col.align === 'left' ? 'text-left' : col.align === 'center' ? 'text-center' : 'text-right'
              ]"
            >
              {{ col.label }}
            </th>
          </tr>
        </thead>
        <tbody v-if="items && items.length > 0">
          <slot name="body">
            <tr
              v-for="(item, index) in items"
              :key="item.id || index"
              class="table-row"
            >
              <slot name="row" :item="item" :index="index">
                <td v-for="col in columns" :key="col.key">
                  {{ item[col.key] }}
                </td>
              </slot>
            </tr>
          </slot>
        </tbody>
      </table>
    </div>

    <div v-if="!items || items.length === 0" class="admin-table-empty">
      <slot name="empty">
        <div class="empty-content">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="empty-icon">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p class="empty-state">{{ emptyText }}</p>
        </div>
      </slot>
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

.admin-table-scroll {
  width: 100%;
  overflow-x: auto;
}

.admin-table {
  width: 100%;
  border-collapse: collapse;
  text-align: right;
  font-family: inherit;
}

.admin-table th {
  padding: 14px 18px;
  font-size: 13px;
  font-weight: 600;
  color: var(--muted-foreground);
  background: color-mix(in srgb, var(--muted) 40%, transparent);
  border-bottom: 1px solid var(--border);
  white-space: nowrap;
}

.admin-table :deep(td) {
  padding: 13px 18px;
  font-size: 13.5px;
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

.admin-table-empty {
  padding: 42px 20px;
  text-align: center;
}

.empty-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

.empty-icon {
  color: var(--muted-foreground);
  opacity: 0.6;
}

.empty-state {
  margin: 0;
  font-size: 13.5px;
  color: var(--muted-foreground);
}
</style>
