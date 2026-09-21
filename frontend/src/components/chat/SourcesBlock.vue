<script setup lang="ts">
import { ref, computed } from 'vue'
import type { WebSource } from '../../types'
import Button from '../ui/button/Button.vue'

const props = defineProps<{
  sources: WebSource[] | null
  failed?: boolean
}>()

const emit = defineEmits<{
  toggle: [isOpen: boolean]
}>()

const open = ref(false)
const showAll = ref(false)
const visibleSources = computed(() => {
  const list = props.sources ?? []
  return showAll.value ? list : list.slice(0, 3)
})

function handleToggle() {
  open.value = !open.value
  emit('toggle', open.value)
}
</script>

<template>
  <div
    v-if="(sources && sources.length > 0) || failed"
    data-testid="sources-block"
    class="mt-2 rounded-xl border border-border/50 bg-muted/30 p-3"
  >
    <div class="flex items-center justify-between gap-2">
      <span class="text-xs font-medium text-muted-foreground">
        منابع{{ sources && sources.length > 0 ? ` (${sources.length})` : '' }}
      </span>
      <Button variant="ghost" size="sm" data-testid="sources-toggle" @click="handleToggle">
        {{ open ? 'بستن' : 'نمایش' }}
      </Button>
    </div>
    <div v-show="open" data-testid="sources-body">
      <p v-if="failed" class="mt-2 text-xs text-amber-600 dark:text-amber-400">
        جستجوی وب ناموفق بود؛ این پاسخ بدون منابع تولید شده است.
      </p>
      <ul v-if="visibleSources.length > 0" class="mt-2 flex flex-col gap-2">
        <li v-for="(s, i) in visibleSources" :key="s.url" class="flex items-start gap-2">
          <span class="rounded-md bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold text-primary">{{ i + 1 }}</span>
          <div class="min-w-0">
            <a :href="s.url" target="_blank" rel="noopener noreferrer" class="text-primary text-[13px] font-medium hover:underline">{{ s.title }}</a>
            <p v-if="s.snippet" class="truncate text-xs text-muted-foreground">{{ s.snippet }}</p>
          </div>
        </li>
      </ul>
      <Button
        v-if="sources && sources.length > 3"
        variant="ghost"
        size="sm"
        class="mt-1"
        @click="showAll = !showAll"
      >
        {{ showAll ? 'نمایش کمتر' : `نمایش همه (${sources.length})` }}
      </Button>
    </div>
  </div>
</template>
