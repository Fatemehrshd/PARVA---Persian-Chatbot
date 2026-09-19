<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import {
  Share2,
  Copy,
  Check,
  ExternalLink,
  RefreshCw,
  Trash2,
  Loader2,
  X,
  Lock,
} from '@lucide/vue'
import { useUiStore } from '../../stores/ui'
import { shareService } from '../../services/share.service'
import { formatIranDateTime } from '../../lib/date'
import type { Conversation, ChatShareSummary } from '../../types'

const props = defineProps<{
  isOpen: boolean
  conversation: Conversation | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'shared', shareCode: string): void
  (e: 'revoked'): void
}>()

const uiStore = useUiStore()

const isLoading = ref(false)
const isSubmitting = ref(false)
const isRevoking = ref(false)
const currentShare = ref<ChatShareSummary | null>(null)
const copied = ref(false)
let copyTimeout: ReturnType<typeof setTimeout> | undefined

const shareUrl = computed(() => {
  if (!currentShare.value) return ''
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  return `${origin}/share/${currentShare.value.shareCode}`
})

async function loadExistingShare() {
  if (!props.conversation) return
  isLoading.value = true
  try {
    currentShare.value = await shareService.getUserShare(props.conversation.id)
  } catch {
    currentShare.value = null
  } finally {
    isLoading.value = false
  }
}

watch(
  () => props.isOpen,
  (open) => {
    if (open && props.conversation) {
      copied.value = false
      loadExistingShare()
    } else {
      currentShare.value = null
    }
  },
  { immediate: true },
)

async function handleCreateOrUpdateShare() {
  if (!props.conversation) return
  isSubmitting.value = true
  try {
    const res = await shareService.createOrUpdateShare(props.conversation.id)
    currentShare.value = res
    emit('shared', res.shareCode)
    uiStore.showToast('پیوند منجمد گفتگو با موفقیت ایجاد شد.', 'success')
  } catch (err: any) {
    uiStore.showToast(err?.message || 'خطا در ایجاد پیوند اشتراک', 'error')
  } finally {
    isSubmitting.value = false
  }
}

async function handleRevokeShare() {
  if (!props.conversation) return
  isRevoking.value = true
  try {
    await shareService.revokeShare(props.conversation.id)
    currentShare.value = null
    emit('revoked')
    uiStore.showToast('پیوند اشتراک گفتگو با موفقیت باطل شد.', 'info')
  } catch (err: any) {
    uiStore.showToast(err?.message || 'خطا در ابطال پیوند اشتراک', 'error')
  } finally {
    isRevoking.value = false
  }
}

async function copyToClipboard() {
  if (!shareUrl.value) return
  try {
    await navigator.clipboard.writeText(shareUrl.value)
    copied.value = true
    uiStore.showToast('پیوند در کلیپ‌بورد کپی شد.', 'success')
    if (copyTimeout) clearTimeout(copyTimeout)
    copyTimeout = setTimeout(() => {
      copied.value = false
    }, 2500)
  } catch {
    uiStore.showToast('امکان کپی خودکار فراهم نشد.', 'error')
  }
}
</script>

<template>
  <div
    v-if="isOpen && conversation"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4 animate-in fade-in duration-200"
    @click.self="emit('close')"
    :dir="uiStore.direction"
  >
    <div class="w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col scale-in-95 duration-200">
      <!-- Header -->
      <div class="px-6 py-4 border-b border-border flex items-center justify-between bg-secondary/35">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
            <Share2 :size="18" />
          </div>
          <div>
            <h3 class="text-base font-bold text-foreground">
              اشتراک‌گذاری گفتگو
            </h3>
            <p class="text-xs text-muted-foreground line-clamp-1 max-w-[280px] sm:max-w-xs">
              {{ conversation.title || 'گفتگوی بدون عنوان' }}
            </p>
          </div>
        </div>

        <button
          @click="emit('close')"
          class="text-muted-foreground hover:text-foreground hover:bg-secondary p-1.5 rounded-lg transition-colors"
          aria-label="بستن"
        >
          <X :size="18" />
        </button>
      </div>

      <!-- Modal Body -->
      <div class="p-6 space-y-5">
        <!-- Explanatory Notice Banner -->
        <div class="p-3.5 rounded-xl border border-primary/20 bg-primary/5 flex items-start gap-3 text-xs leading-relaxed text-foreground">
          <Lock :size="16" class="text-primary mt-0.5 flex-shrink-0" />
          <div>
            <p class="font-semibold text-primary mb-1">
              اسنپ‌شات منجمد و عمومی (Frozen Snapshot)
            </p>
            <p class="text-muted-foreground text-[11.5px]">
              پیوند اشتراک، پیام‌های این گفتگو را تا همین لحظه منجمد می‌کند. هرگونه پیام جدید، ویرایش یا حذفی که بعداً در این گفتگو انجام دهید در این پیوند نمایش داده نخواهد شد.
            </p>
          </div>
        </div>

        <!-- Loading state -->
        <div v-if="isLoading" class="py-10 flex flex-col items-center justify-center gap-3 text-muted-foreground">
          <Loader2 :size="24" class="animate-spin text-primary" />
          <span class="text-xs">در حال بررسی وضعیت اشتراک...</span>
        </div>

        <!-- Case 1: Active Share Exists -->
        <div v-else-if="currentShare && currentShare.isActive" class="space-y-4">
          <div class="space-y-1.5">
            <label class="text-xs font-semibold text-foreground flex items-center justify-between">
              <span>پیوند عمومی گفتگو:</span>
              <span class="text-[11px] text-emerald-500 font-medium flex items-center gap-1">
                <Check :size="12" />
                <span>پیوند فعال است</span>
              </span>
            </label>

            <div class="flex items-center gap-2">
              <div class="relative flex-1">
                <input
                  :value="shareUrl"
                  readonly
                  class="w-full pl-3 pr-9 py-2.5 rounded-xl border border-border bg-background text-foreground text-xs font-mono select-all focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
                  dir="ltr"
                />
                <div class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
                  <Share2 :size="14" />
                </div>
              </div>

              <button
                type="button"
                @click="copyToClipboard"
                class="px-3.5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5 flex-shrink-0 active:scale-95"
              >
                <Check v-if="copied" :size="14" class="text-primary-foreground" />
                <Copy v-else :size="14" />
                <span>{{ copied ? 'کپی شد!' : 'کپی پیوند' }}</span>
              </button>
            </div>
          </div>

          <!-- Snapshot Info -->
          <div class="p-3 rounded-xl bg-secondary/40 border border-border text-[11px] text-muted-foreground space-y-1.5 font-mono">
            <div class="flex items-center justify-between">
              <span>تعداد پیام‌های منجمد:</span>
              <span class="font-bold text-foreground">{{ Number(currentShare.messageCount).toLocaleString('fa-IR') }} پیام</span>
            </div>
            <div class="flex items-center justify-between">
              <span>تاریخ انجماد و اشتراک:</span>
              <span class="text-foreground" dir="ltr">{{ formatIranDateTime(currentShare.createdAt) }}</span>
            </div>
            <div v-if="currentShare.viewCount !== undefined" class="flex items-center justify-between">
              <span>تعداد بازدیدها:</span>
              <span class="text-foreground">{{ Number(currentShare.viewCount).toLocaleString('fa-IR') }} مرتبه</span>
            </div>
          </div>

          <!-- Secondary Actions -->
          <div class="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-border/60">
            <div class="flex items-center gap-2">
              <!-- Re-share / Update snapshot -->
              <button
                type="button"
                :disabled="isSubmitting"
                @click="handleCreateOrUpdateShare"
                class="px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-secondary text-foreground text-xs font-medium transition-colors flex items-center gap-1.5 disabled:opacity-50"
                title="به‌روزرسانی اسنپ‌شات به آخرین پیام‌های این گفتگو"
              >
                <RefreshCw :size="13" :class="{ 'animate-spin': isSubmitting }" />
                <span>به‌روزرسانی به پیام‌های فعلی</span>
              </button>

              <!-- Open Public Page -->
              <a
                :href="shareUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-secondary text-foreground text-xs font-medium transition-colors inline-flex items-center gap-1.5"
              >
                <ExternalLink :size="13" />
                <span>مشاهده صفحه عمومی</span>
              </a>
            </div>

            <!-- Revoke -->
            <button
              type="button"
              :disabled="isRevoking"
              @click="handleRevokeShare"
              class="px-2.5 py-1.5 rounded-lg text-destructive hover:bg-destructive/10 text-xs font-medium transition-colors flex items-center gap-1 disabled:opacity-50"
              title="ابطال پیوند و حذف دسترسی عمومی"
            >
              <Trash2 :size="13" />
              <span>ابطال پیوند</span>
            </button>
          </div>
        </div>

        <!-- Case 2: Not Shared Yet -->
        <div v-else class="space-y-4 text-center py-4">
          <div class="w-14 h-14 mx-auto rounded-2xl bg-secondary flex items-center justify-center text-primary mb-2 shadow-inner">
            <Share2 :size="26" />
          </div>
          <div class="space-y-1">
            <p class="text-sm font-bold text-foreground">
              هنوز پیوند اشتراکی برای این گفتگو ساخته نشده است
            </p>
            <p class="text-xs text-muted-foreground max-w-sm mx-auto">
              با ایجاد پیوند عمومی، می‌توانید گفتگوی خود را با همکاران و دوستان به اشتراک بگذارید.
            </p>
          </div>

          <div class="pt-2">
            <button
              type="button"
              :disabled="isSubmitting"
              @click="handleCreateOrUpdateShare"
              class="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold shadow-md transition-all inline-flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Loader2 v-if="isSubmitting" :size="16" class="animate-spin" />
              <Share2 v-else :size="16" />
              <span>ایجاد پیوند اشتراک‌گذاری عمومی</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="px-6 py-3.5 border-t border-border flex items-center justify-end bg-secondary/20">
        <button
          type="button"
          @click="emit('close')"
          class="px-4 py-2 rounded-xl border border-border bg-secondary hover:bg-secondary/80 text-secondary-foreground text-xs font-medium transition-colors"
        >
          بستن
        </button>
      </div>
    </div>
  </div>
</template>
