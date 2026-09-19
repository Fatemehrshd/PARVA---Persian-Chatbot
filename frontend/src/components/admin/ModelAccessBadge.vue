<script setup lang="ts">
/**
 * Access-level badge for a model (public / commercial / private).
 * Reusable in the admin models table and any future model picker.
 */
import type { ModelAccessLevel } from '../../types'

const props = defineProps<{
  level?: ModelAccessLevel
}>()

const LEVELS: Record<ModelAccessLevel, { label: string; classes: string }> = {
  public: { label: 'عمومی', classes: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' },
  commercial: { label: 'تجاری', classes: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30' },
  private: { label: 'اختصاصی', classes: 'bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/30' },
}

const current = () => LEVELS[props.level || 'public'] ?? LEVELS.public
</script>

<template>
  <span
    class="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-medium border whitespace-nowrap"
    :class="current().classes"
    data-testid="model-access-badge"
  >
    <slot>{{ current().label }}</slot>
  </span>
</template>