<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  loading?: boolean
  icon?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'secondary',
  size: 'md',
  disabled: false,
  loading: false,
  icon: false
})

const classes = computed(() => {
  const base = 'base-button'
  const variantClass = `base-button--${props.variant}`
  const sizeClass = `base-button--${props.size}`
  const iconClass = props.icon ? 'base-button--icon' : ''
  const loadingClass = props.loading ? 'base-button--loading' : ''
  
  return [base, variantClass, sizeClass, iconClass, loadingClass].filter(Boolean).join(' ')
})
</script>

<template>
  <button
    :class="classes"
    :disabled="disabled || loading"
    type="button"
  >
    <svg
      v-if="loading"
      class="base-button-spinner animate-spin"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
    <slot />
  </button>
</template>

<style scoped>
/* Base button styles */
.base-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  border: 1px solid transparent;
  border-radius: 8px;
  font-family: var(--font-sans);
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
  user-select: none;
}

.base-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.base-button:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}

/* Sizes */
.base-button--sm {
  height: 32px;
  padding: 0 12px;
  font-size: 11px;
}

.base-button--md {
  height: 36px;
  padding: 0 16px;
  font-size: 12px;
}

.base-button--lg {
  height: 40px;
  padding: 0 20px;
  font-size: 13px;
}

/* Icon-only button */
.base-button--icon.base-button--sm {
  width: 32px;
  padding: 0;
}

.base-button--icon.base-button--md {
  width: 36px;
  padding: 0;
}

.base-button--icon.base-button--lg {
  width: 40px;
  padding: 0;
}

/* Variants */
.base-button--primary {
  background: var(--primary);
  color: var(--primary-foreground);
  border-color: var(--primary);
}

.base-button--primary:hover:not(:disabled) {
  background: var(--primary-hover);
  border-color: var(--primary-hover);
}

.base-button--secondary {
  background: var(--secondary);
  color: var(--foreground);
  border-color: var(--border);
}

.base-button--secondary:hover:not(:disabled) {
  background: color-mix(in srgb, var(--secondary) 80%, var(--foreground));
  border-color: var(--muted-foreground);
}

.base-button--ghost {
  background: transparent;
  color: var(--muted-foreground);
  border-color: transparent;
}

.base-button--ghost:hover:not(:disabled) {
  background: var(--secondary);
  color: var(--foreground);
}

.base-button--danger {
  background: transparent;
  color: var(--destructive);
  border-color: transparent;
}

.base-button--danger:hover:not(:disabled) {
  background: color-mix(in srgb, var(--destructive) 12%, transparent);
  border-color: color-mix(in srgb, var(--destructive) 30%, transparent);
}

.base-button--success {
  background: transparent;
  color: #16a34a;
  border-color: transparent;
}

.base-button--success:hover:not(:disabled) {
  background: color-mix(in srgb, #22c55e 14%, transparent);
  border-color: color-mix(in srgb, #22c55e 30%, transparent);
}

/* Loading state */
.base-button--loading {
  position: relative;
  color: transparent;
}

.base-button-spinner {
  position: absolute;
  width: 14px;
  height: 14px;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
