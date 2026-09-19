<script setup lang="ts">
/**
 * Reusable skeleton placeholder for admin tables, built on the shadcn Skeleton.
 * Shown while a section loads so the admin panel never flashes an empty table.
 */
import { Skeleton } from '../ui/skeleton'

const props = withDefaults(
  defineProps<{
    rows?: number
    columns?: number
  }>(),
  { rows: 5, columns: 4 }
)
</script>

<template>
  <div class="w-full rounded-lg border border-border overflow-hidden" data-testid="admin-table-skeleton">
    <div class="flex items-center gap-4 px-4 py-3 bg-muted/40 border-b border-border">
      <Skeleton v-for="col in props.columns" :key="`h-${col}`" class="h-4 flex-1" />
    </div>
    <div
      v-for="row in props.rows"
      :key="`r-${row}`"
      class="flex items-center gap-4 px-4 py-3.5 border-b border-border last:border-b-0"
    >
      <Skeleton v-for="col in props.columns" :key="`c-${row}-${col}`" class="h-4 flex-1" />
    </div>
  </div>
</template>