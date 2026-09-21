<script setup lang="ts">
import { X } from '@lucide/vue'

withDefaults(defineProps<{
  open?: boolean
  eyebrow?: string
  title: string
}>(), {
  open: undefined,
  eyebrow: 'ADMIN'
})

defineEmits<{ close: [] }>()
</script>

<template>
  <div v-if="open === undefined || open" class="admin-modal-backdrop" @click.self="$emit('close')">
    <section class="admin-modal" role="dialog" aria-modal="true" :aria-label="title">
      <header class="admin-modal-header">
        <div>
          <p class="admin-modal-eyebrow">{{ eyebrow }}</p>
          <h2>{{ title }}</h2>
        </div>
        <button class="admin-modal-close" type="button" aria-label="Close" @click="$emit('close')">
          <X :size="18" />
        </button>
      </header>
      <div class="admin-modal-body">
        <slot />
      </div>
      <footer v-if="$slots.footer" class="admin-modal-footer">
        <slot name="footer" />
      </footer>
    </section>
  </div>
</template>

<style scoped>
.admin-modal-backdrop { position: fixed; inset: 0; z-index: 80; display: grid; place-items: center; padding: 20px; background: rgba(0, 0, 0, 0.62); backdrop-filter: blur(5px); }
.admin-modal { width: min(620px, 100%); max-height: min(720px, calc(100vh - 40px)); overflow: hidden; border: 1px solid var(--border); border-radius: 16px; background: var(--card); color: var(--foreground); box-shadow: none; display: flex; flex-direction: column; }

.admin-modal-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding: 22px 24px; border-bottom: 1px solid var(--border); flex-shrink: 0; }
.admin-modal-eyebrow { color: var(--muted-foreground); font: 500 9px var(--font-mono); letter-spacing: .08em; }
.admin-modal-header h2 { margin-top: 5px; font-size: 20px; }
.admin-modal-close { width: 30px; height: 30px; display: grid; place-items: center; border: 1px solid var(--border); border-radius: 7px; background: transparent; color: var(--muted-foreground); cursor: pointer; }
.admin-modal-close:hover { background: var(--secondary); color: var(--foreground); }
.admin-modal-body { max-height: calc(100vh - 230px); overflow-y: auto; padding: 20px 24px 24px; flex: 1; }
.admin-modal-footer { display: flex; align-items: center; justify-content: flex-end; gap: 10px; padding: 16px 24px; border-top: 1px solid var(--border); background: color-mix(in srgb, var(--card) 97%, var(--foreground)); flex-shrink: 0; }
@media (max-width: 680px) { .admin-modal-backdrop { padding: 10px; } .admin-modal { max-height: calc(100vh - 20px); border-radius: 12px; } .admin-modal-header { padding: 18px; } .admin-modal-body { padding: 16px; } .admin-modal-footer { padding: 14px 16px; } }
</style>
