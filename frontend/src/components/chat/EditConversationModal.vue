<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { useUiStore } from '../../stores/ui'
import type { Conversation } from '../../types'

const props = defineProps<{
  isOpen: boolean
  conversation: Conversation | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'save', id: string, newTitle: string): void
}>()

const uiStore = useUiStore()
const titleInput = ref('')
const inputRef = ref<HTMLInputElement | null>(null)
const isSaving = ref(false)
const errorMessage = ref('')

watch(
  () => props.isOpen,
  (open) => {
    if (open && props.conversation) {
      titleInput.value = props.conversation.title
      errorMessage.value = ''
      nextTick(() => {
        inputRef.value?.focus()
        inputRef.value?.select()
      })
    }
  }
)

async function handleSave() {
  const trimmed = titleInput.value.trim()
  if (!trimmed) {
    errorMessage.value = uiStore.direction === 'rtl' 
      ? 'عنوان گفتگو نمی‌تواند خالی باشد.' 
      : 'Conversation title cannot be empty.'
    return
  }

  if (!props.conversation) return

  isSaving.value = true
  try {
    emit('save', props.conversation.id, trimmed)
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <div
    v-if="isOpen && conversation"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
    @click.self="emit('close')"
    :dir="uiStore.direction"
  >
    <div class="w-full max-w-md bg-card border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col scale-in-95 duration-200">
      <!-- Header -->
      <div class="px-6 py-4 border-b border-border flex items-center justify-between bg-secondary/30">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
            </svg>
          </div>
          <h3 class="text-base font-semibold text-foreground">
            {{ uiStore.direction === 'rtl' ? 'ویرایش عنوان گفتگو' : 'Edit Chat Title' }}
          </h3>
        </div>

        <button
          @click="emit('close')"
          class="text-muted-foreground hover:text-foreground hover:bg-secondary p-1.5 rounded-md transition-colors"
          aria-label="Close"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <!-- Form Body -->
      <form @submit.prevent="handleSave" class="p-6 space-y-4">
        <div class="space-y-1.5">
          <label class="text-xs font-medium text-secondary-foreground block">
            {{ uiStore.direction === 'rtl' ? 'عنوان جدید گفتگو:' : 'New Chat Title:' }}
          </label>
          <input
            ref="inputRef"
            v-model="titleInput"
            type="text"
            maxlength="100"
            class="w-full px-3.5 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all placeholder:text-muted-foreground"
            :placeholder="uiStore.direction === 'rtl' ? 'عنوان دلخواه را وارد کنید...' : 'Enter a conversation title...'"
          />
          <p v-if="errorMessage" class="text-xs text-destructive mt-1 font-medium">
            {{ errorMessage }}
          </p>
        </div>

        <p class="text-xs text-muted-foreground">
          {{ uiStore.direction === 'rtl' 
            ? 'این نام در سایدبار و تاریخچه گفتگوهای شما نمایش داده خواهد شد.' 
            : 'This title will be displayed in your sidebar and chat history.' }}
        </p>

        <!-- Footer Actions -->
        <div class="pt-3 border-t border-border flex items-center justify-between gap-3 w-full">
          <template v-if="uiStore.direction === 'rtl'">
            <button
              type="submit"
              :disabled="isSaving || !titleInput.trim()"
              class="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs sm:text-sm font-medium shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg v-if="isSaving" class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>{{ uiStore.direction === 'rtl' ? 'ذخیره عنوان' : 'Save Title' }}</span>
            </button>

            <button
              type="button"
              @click="emit('close')"
              :disabled="isSaving"
              class="px-4 py-2 rounded-lg border border-border bg-secondary hover:bg-secondary/80 text-secondary-foreground text-xs sm:text-sm font-medium transition-colors"
            >
              {{ uiStore.direction === 'rtl' ? 'انصراف' : 'Cancel' }}
            </button>
          </template>

          <template v-else>
            <button
              type="button"
              @click="emit('close')"
              :disabled="isSaving"
              class="px-4 py-2 rounded-lg border border-border bg-secondary hover:bg-secondary/80 text-secondary-foreground text-xs sm:text-sm font-medium transition-colors"
            >
              Cancel
            </button>

            <button
              type="submit"
              :disabled="isSaving || !titleInput.trim()"
              class="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs sm:text-sm font-medium shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg v-if="isSaving" class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Save Title</span>
            </button>
          </template>
        </div>
      </form>
    </div>
  </div>
</template>

