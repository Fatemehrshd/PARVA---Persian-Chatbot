<script setup lang="ts">
import { computed } from 'vue'
import { Brain, Eye, FileText } from '@lucide/vue'
import { CAPABILITY_METADATA, type CapabilityKey } from '@/types/capabilities'

interface Props {
  capability: CapabilityKey
  size?: 'sm' | 'md'
  showLabel?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  size: 'sm',
  showLabel: true,
})

const meta = computed(() => CAPABILITY_METADATA[props.capability])

const iconComponent = computed(() => {
  switch (props.capability) {
    case 'thinking':
      return Brain
    case 'vision':
      return Eye
    case 'document':
      return FileText
  }
})
</script>

<template>
  <span
    v-if="meta"
    :title="meta.description"
    :class="[
      'inline-flex items-center gap-1 font-medium rounded-md border transition-colors select-none',
      meta.badgeColor,
      size === 'sm' ? 'text-[11px] px-1.5 py-0.5' : 'text-xs px-2 py-1',
    ]"
    data-test="capability-badge"
    :data-capability="capability"
  >
    <component
      :is="iconComponent"
      :class="size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'"
      aria-hidden="true"
    />
    <span v-if="showLabel">{{ meta.label }}</span>
  </span>
</template>
