<script setup lang="ts">
/**
 * Reusable model access picker: access level plus — for private models — a
 * searchable multi-select of the users allowed to use the model.
 * Purely presentational: the parent (ModelEditorModal) owns the form state.
 */
import { computed, ref } from 'vue'
import type { AdminUser, ModelAccessLevel } from '../../types'

const props = defineProps<{
  accessLevel: ModelAccessLevel
  allowedUserIds: string[]
  users: AdminUser[]
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:accessLevel': [value: ModelAccessLevel]
  'update:allowedUserIds': [value: string[]]
}>()

const OPTIONS: { value: ModelAccessLevel; label: string; hint: string }[] = [
  { value: 'public', label: 'عمومی', hint: 'در دسترس همه کاربران' },
  { value: 'commercial', label: 'تجاری', hint: 'فقط نقش‌های مجاز (قابل تنظیم در بخش سیاست‌ها)' },
  { value: 'private', label: 'اختصاصی', hint: 'فقط کاربران انتخاب‌شده' },
]

const userQuery = ref('')

const filteredUsers = computed(() => {
  const q = userQuery.value.trim().toLowerCase()
  const all = props.users || []
  if (!q) return all
  return all.filter(
    (u) =>
      u.email?.toLowerCase().includes(q) ||
      (u.displayName || '').toLowerCase().includes(q) ||
      (u.username || '').toLowerCase().includes(q)
  )
})

function toggleUser(id: string) {
  const next = props.allowedUserIds.includes(id)
    ? props.allowedUserIds.filter((x) => x !== id)
    : [...props.allowedUserIds, id]
  emit('update:allowedUserIds', next)
}
</script>

<template>
  <div class="col-span-full flex flex-col gap-2">
    <label>
      <span class="field-label">سطح دسترسی مدل</span>
      <select
        :value="accessLevel"
        :disabled="disabled"
        data-testid="model-access-level"
        @change="emit('update:accessLevel', ($event.target as HTMLSelectElement).value as ModelAccessLevel)"
      >
        <option v-for="option in OPTIONS" :key="option.value" :value="option.value">
          {{ option.label }} — {{ option.hint }}
        </option>
      </select>
    </label>

    <div v-if="accessLevel === 'private'" class="flex flex-col gap-2 p-3 rounded-lg border border-border bg-secondary/30">
      <span class="text-xs text-muted-foreground font-medium">کاربران مجاز ({{ allowedUserIds.length }} نفر انتخاب‌شده)</span>
      <input
        v-model="userQuery"
        type="search"
        placeholder="جستجوی کاربر بر اساس ایمیل یا نام..."
        :disabled="disabled"
        data-testid="model-access-user-search"
      />
      <div class="max-h-44 overflow-y-auto rounded-md border border-border bg-background divide-y divide-border">
        <button
          v-for="user in filteredUsers"
          :key="user.id"
          type="button"
          class="w-full flex items-center justify-between gap-3 px-3 py-2 text-right text-xs hover:bg-secondary/60 transition-colors cursor-pointer"
          :disabled="disabled"
          :data-testid="`model-access-user-${user.id}`"
          @click="toggleUser(user.id)"
        >
          <span class="flex flex-col items-start">
            <span class="font-medium text-foreground">{{ user.displayName || user.username || user.email }}</span>
            <span class="text-muted-foreground font-mono text-[11px]">{{ user.email }}</span>
          </span>
          <span
            class="shrink-0 w-4 h-4 rounded border flex items-center justify-center"
            :class="allowedUserIds.includes(user.id) ? 'bg-primary border-primary text-primary-foreground' : 'border-border'"
          >
            <span v-if="allowedUserIds.includes(user.id)" class="text-[10px] leading-none">✓</span>
          </span>
        </button>
        <p v-if="!filteredUsers.length" class="px-3 py-3 text-xs text-muted-foreground">کاربری یافت نشد.</p>
      </div>
    </div>
  </div>
</template>