<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  modelValue: boolean
  disabled?: boolean
  size?: 'sm' | 'md'
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  size: 'md'
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const classes = computed(() => {
  const base = 'base-toggle'
  const sizeClass = `base-toggle--${props.size}`
  const activeClass = props.modelValue ? 'base-toggle--active' : ''
  
  return [base, sizeClass, activeClass].filter(Boolean).join(' ')
})

function toggle() {
  if (!props.disabled) {
    emit('update:modelValue', !props.modelValue)
  }
}
</script>

<template>
  <button
    :class="classes"
    :disabled="disabled"
    :aria-checked="modelValue"
    role="switch"
    type="button"
    @click="toggle"
  >
    <span class="base-toggle-thumb"></span>
  </button>
</template>

<style scoped>
.base-toggle {
  position: relative;
  display: inline-flex;
  align-items: center;
  border: 0;
  border-radius: 100px;
  background: var(--muted-foreground);
  cursor: pointer;
  transition: background-color 0.2s ease;
  flex-shrink: 0;
}

.base-toggle:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.base-toggle:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}

/* Sizes */
.base-toggle--sm {
  width: 36px;
  height: 20px;
  padding: 2px;
}

.base-toggle--md {
  width: 44px;
  height: 24px;
  padding: 3px;
}

/* Thumb */
.base-toggle-thumb {
  display: block;
  border-radius: 50%;
  background: var(--card);
  transition: transform 0.2s ease;
  pointer-events: none;
}

.base-toggle--sm .base-toggle-thumb {
  width: 16px;
  height: 16px;
}

.base-toggle--md .base-toggle-thumb {
  width: 18px;
  height: 18px;
}

/* Active state */
.base-toggle--active {
  background: var(--primary);
}

.base-toggle--active.base-toggle--sm .base-toggle-thumb {
  transform: translateX(16px);
}

.base-toggle--active.base-toggle--md .base-toggle-thumb {
  transform: translateX(20px);
}

/* RTL support */
[dir="rtl"] .base-toggle--active.base-toggle--sm .base-toggle-thumb {
  transform: translateX(-16px);
}

[dir="rtl"] .base-toggle--active.base-toggle--md .base-toggle-thumb {
  transform: translateX(-20px);
}
</style>
