<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  Copy,
  Check,
  Lock,
  Moon,
  Sun,
  GitFork,
  ArrowRight,
  AlertCircle,
  Loader2,
  Sparkles,
} from '@lucide/vue'
import { shareService } from '../services/share.service'
import { formatIranDateTime } from '../lib/date'
import { useUiStore } from '../stores/ui'
import { useAuthStore } from '../stores/auth'
import { useThemeLogo } from '../composables/useThemeLogo'
import MessageBubble from '../components/chat/MessageBubble.vue'
import type { PublicShareResponse } from '../types'

const route = useRoute()
const router = useRouter()
const uiStore = useUiStore()
const authStore = useAuthStore()
const { activeLogo } = useThemeLogo()

const shareCode = computed(() => route.params.shareCode as string)
const isLoading = ref(true)
const shareData = ref<PublicShareResponse | null>(null)
const errorMessage = ref('')
const copied = ref(false)
const isForking = ref(false)
let copyTimeout: ReturnType<typeof setTimeout> | undefined

async function loadShare() {
  if (!shareCode.value) {
    errorMessage.value = 'شناسه اشتراک نامعتبر است.'
    isLoading.value = false
    return
  }

  isLoading.value = true
  errorMessage.value = ''
  try {
    shareData.value = await shareService.getPublicShare(shareCode.value)
  } catch (err: any) {
    errorMessage.value =
      err?.message || 'این گفتگوی به‌اشتراک‌گذاشته‌شده یافت نشد یا ممکن است منقضی یا باطل شده باشد.'
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  loadShare()
})

async function copyShareUrl() {
  try {
    await navigator.clipboard.writeText(window.location.href)
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

async function handleFork() {
  if (!authStore.isAuthenticated) {
    router.push({
      path: '/login',
      query: { redirect: `/share/${shareCode.value}` },
    })
    return
  }

  isForking.value = true
  try {
    const res = await shareService.forkShare(shareCode.value)
    uiStore.showToast('گفتگو در حساب شما کپی شد و آماده ادامه است.', 'success')
    router.push(`/chat/${res.conversationId}`)
  } catch (err: any) {
    uiStore.showToast(err?.message || 'خطا در ایجاد کپی از گفتگو', 'error')
  } finally {
    isForking.value = false
  }
}
</script>

<template>
  <div class="shared-chat-page min-h-screen flex flex-col bg-background text-foreground" :dir="uiStore.direction">
    <!-- Top Header Bar -->
    <header class="shared-header sticky top-0 z-30 border-b border-border bg-card/85 backdrop-blur-md px-4 sm:px-6 py-3 flex items-center justify-between">
      <!-- Left: Logo & Back -->
      <div class="flex items-center gap-3">
        <router-link to="/" class="flex items-center gap-2 hover:opacity-85 transition-opacity" title="صفحه اصلی پروا">
          <img :src="activeLogo" alt="پروا" class="w-8 h-8 rounded-lg object-contain" />
          <span class="font-bold text-sm tracking-wide text-foreground font-mono">PARVA</span>
        </router-link>

        <div class="h-4 w-px bg-border hidden sm:block"></div>

        <span class="text-xs text-muted-foreground hidden sm:inline">
          نسخهٔ منجمد گفتگو
        </span>
      </div>

      <!-- Center: Title preview on desktop -->
      <div v-if="shareData" class="hidden md:flex items-center gap-2 max-w-md truncate">
        <Lock :size="13" class="text-primary flex-shrink-0" />
        <span class="text-xs font-semibold text-foreground truncate">
          {{ shareData.title }}
        </span>
      </div>

      <!-- Right: Action Buttons -->
      <div class="flex items-center gap-2">
        <!-- Copy URL -->
        <button
          v-if="shareData"
          type="button"
          @click="copyShareUrl"
          class="px-2.5 sm:px-3 py-1.5 rounded-lg border border-border bg-secondary/80 hover:bg-secondary text-foreground text-xs font-medium transition-all flex items-center gap-1.5"
          title="کپی پیوند این گفتگو"
        >
          <Check v-if="copied" :size="13" class="text-emerald-500" />
          <Copy v-else :size="13" />
          <span class="hidden sm:inline">{{ copied ? 'کپی شد' : 'کپی پیوند' }}</span>
        </button>

        <!-- Fork / Continue Chat -->
        <button
          v-if="shareData"
          type="button"
          :disabled="isForking"
          @click="handleFork"
          class="px-3 sm:px-4 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50"
          title="ادامه این گفتگو در حساب کاربری من"
        >
          <Loader2 v-if="isForking" :size="13" class="animate-spin" />
          <GitFork v-else :size="13" />
          <span>{{ authStore.isAuthenticated ? 'ادامه گفتگو در پروا' : 'ورود و ادامه گفتگو' }}</span>
        </button>

        <!-- Theme Toggle -->
        <button
          type="button"
          @click="uiStore.toggleTheme"
          class="p-2 rounded-lg border border-border bg-secondary/50 hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
          :title="uiStore.effectiveTheme === 'dark' ? 'حالت روشن' : 'حالت تیره'"
        >
          <Moon v-if="uiStore.effectiveTheme === 'dark'" :size="15" />
          <Sun v-else :size="15" />
        </button>
      </div>
    </header>

    <!-- Main Content Area -->
    <main class="flex-1 flex flex-col items-center justify-start w-full max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <!-- Loading State -->
      <div v-if="isLoading" class="flex-1 flex flex-col items-center justify-center py-20 gap-4 text-muted-foreground">
        <div class="relative w-12 h-12 flex items-center justify-center">
          <div class="absolute inset-0 rounded-full border-2 border-primary/20 animate-ping"></div>
          <Loader2 :size="32" class="animate-spin text-primary" />
        </div>
        <p class="text-sm font-medium">در حال بارگذاری گفتگوی منجمد...</p>
      </div>

      <!-- Error State -->
      <div v-else-if="errorMessage" class="flex-1 flex flex-col items-center justify-center py-20 text-center max-w-md mx-auto space-y-4">
        <div class="w-16 h-16 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center shadow-inner">
          <AlertCircle :size="32" />
        </div>
        <div class="space-y-1.5">
          <h2 class="text-base font-bold text-foreground">گفتگو در دسترس نیست</h2>
          <p class="text-xs text-muted-foreground leading-relaxed">
            {{ errorMessage }}
          </p>
        </div>
        <router-link
          to="/"
          class="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-md transition-all inline-flex items-center gap-2"
        >
          <span>شروع گفتگوی جدید در پروا</span>
          <ArrowRight :size="14" />
        </router-link>
      </div>

      <!-- Loaded Snapshot -->
      <div v-else-if="shareData" class="w-full flex flex-col space-y-6">
        <!-- Title & Metadata Card -->
        <div class="p-4 sm:p-5 rounded-2xl border border-border bg-card/60 backdrop-blur-sm space-y-3 shadow-sm">
          <div class="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 class="text-lg sm:text-xl font-bold text-foreground mb-1">
                {{ shareData.title }}
              </h1>
              <div class="flex items-center gap-3 text-xs text-muted-foreground flex-wrap font-mono">
                <span v-if="shareData.modelName" class="inline-flex items-center gap-1 text-primary font-medium">
                  <Sparkles :size="12" />
                  <span>{{ shareData.modelName }}</span>
                </span>
                <span>·</span>
                <span dir="ltr">منجمد شده در {{ formatIranDateTime(shareData.createdAt) }}</span>
                <span>·</span>
                <span>{{ Number(shareData.messages.length).toLocaleString('fa-IR') }} پیام</span>
              </div>
            </div>
          </div>

          <!-- Frozen Notice Alert -->
          <div class="p-3 rounded-xl bg-secondary/50 border border-border flex items-start gap-2.5 text-xs text-muted-foreground leading-relaxed">
            <Lock :size="14" class="text-primary mt-0.5 flex-shrink-0" />
            <span>
              این صفحه نسخهٔ عمومی و منجمد از گفتگو است. در صورتی که کاربر پیام‌های جدیدی به گفتگوی اصلی اضافه کرده باشد، در این پیوند نمایش داده نخواهند شد.
            </span>
          </div>
        </div>

        <!-- Messages List -->
        <div class="space-y-6 pb-16">
          <MessageBubble
            v-for="(msg, index) in shareData.messages"
            :key="msg.id"
            :message="(msg as any)"
            :is-last="index === shareData.messages.length - 1"
          />
        </div>

        <!-- Bottom Fork CTA Banner -->
        <div class="p-6 rounded-2xl border border-primary/30 bg-primary/[0.04] text-center space-y-3 shadow-md">
          <div class="w-10 h-10 mx-auto rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <GitFork :size="20" />
          </div>
          <div class="space-y-1">
            <h3 class="text-sm font-bold text-foreground">
              می‌خواهید این گفتگو را ادامه دهید؟
            </h3>
            <p class="text-xs text-muted-foreground max-w-sm mx-auto">
              با ایجاد نسخه کپی (Fork)، این گفتگو به حساب شما اضافه شده و می‌توانید سوالات بعدی خود را از هوش مصنوعی بپرسید.
            </p>
          </div>
          <button
            type="button"
            :disabled="isForking"
            @click="handleFork"
            class="px-6 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-md transition-all inline-flex items-center gap-2 disabled:opacity-50"
          >
            <Loader2 v-if="isForking" :size="14" class="animate-spin" />
            <GitFork v-else :size="14" />
            <span>{{ authStore.isAuthenticated ? 'کپی و ادامه این گفتگو در پروا' : 'ورود به حساب و ادامه گفتگو' }}</span>
          </button>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.shared-chat-page {
  font-family: var(--font-sans);
}
</style>
