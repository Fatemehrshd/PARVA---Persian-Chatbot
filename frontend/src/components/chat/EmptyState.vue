<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useUiStore } from '../../stores/ui'
import { useChatStore } from '../../stores/chat'
import { useAuthStore } from '../../stores/auth'
import logoImg from '@/assets/logo.jpg'

const uiStore = useUiStore()
const chatStore = useChatStore()
const authStore = useAuthStore()

const userName = computed(() => {
  return authStore.user?.displayName || authStore.user?.email?.split('@')[0] || ''
})

const fullGreeting = computed(() => {
  if (uiStore.direction === 'rtl') {
    return userName.value
      ? `سلام ${userName.value} عزیز، چطور می‌توانم کمکتان کنم؟`
      : 'سلام، چطور می‌توانم کمکتان کنم؟'
  }
  return userName.value
    ? `Hello ${userName.value}, how can I help you today?`
    : 'How can I help you today?'
})

const displayedGreeting = ref('')
const isTyping = ref(true)
let timer: any = null

function typeGreeting() {
  if (timer) clearInterval(timer)
  displayedGreeting.value = ''
  isTyping.value = true
  const target = fullGreeting.value
  let idx = 0

  timer = setInterval(() => {
    if (idx < target.length) {
      displayedGreeting.value += target.charAt(idx)
      idx++
    } else {
      clearInterval(timer)
      timer = null
      isTyping.value = false
    }
  }, 32)
}

onMounted(() => {
  typeGreeting()
})

watch(fullGreeting, () => {
  typeGreeting()
})

const suggestions = [
  {
    fa: 'نوشتن و بهینه‌سازی کدهای فرانت‌اند',
    en: 'Write and optimize frontend code',
    descFa: 'تولید کدهای استاندارد Vue 3 با تایپ‌اسکریپت',
    descEn: 'Generate clean Vue 3 + TypeScript components'
  },
  {
    fa: 'توضیح مفاهیم مهندسی نرم‌افزار',
    en: 'Explain software engineering concepts',
    descFa: 'بررسی معماری‌های ماژولار و میکروسرویس',
    descEn: 'Deep-dive into modular systems & APIs'
  },
  {
    fa: 'ایده‌پردازی برای طراحی تجربه کاربری',
    en: 'Brainstorm UX & product design',
    descFa: 'ایجاد الگوهای تعاملی و پالت‌های رنگی مدرن',
    descEn: 'Explore clean layout patterns & tokens'
  },
  {
    fa: 'طراحی قرارداد API و تست‌نویسی',
    en: 'Draft API contracts & unit tests',
    descFa: 'طراحی تست‌های Vitest و ساختاردهی REST/SSE',
    descEn: 'Write robust acceptance and edge-case tests'
  }
]

function handleSelect(prompt: { fa: string; en: string }) {
  const text = uiStore.direction === 'rtl' ? prompt.fa : prompt.en
  chatStore.sendMessage(text)
}
</script>

<template>
  <div class="empty-state">
    <div class="bot-icon-card overflow-hidden shadow-lg border border-border/60">
      <img :src="logoImg" alt="پروا" class="w-full h-full object-cover rounded-xl" />
    </div>

    <h1 class="headline">
      <span class="gradient-text">{{ displayedGreeting }}</span>
      <span class="typing-cursor" :class="{ 'is-blinking': !isTyping }">|</span>
    </h1>
    <p class="subheadline">
      {{ uiStore.direction === 'rtl' ? 'پلتفرم گفتگوی هوشمند پروا با پشتیبانی از مدل‌های پیشرفته' : 'Parva multi-model intelligent workspace' }}
    </p>

    <div class="suggestion-grid">
      <button
        v-for="(item, idx) in suggestions"
        :key="idx"
        class="suggestion-card"
        @click="handleSelect(item)"
      >
        <span class="suggestion-title">
          {{ uiStore.direction === 'rtl' ? item.fa : item.en }}
        </span>
        <span class="suggestion-desc">
          {{ uiStore.direction === 'rtl' ? item.descFa : item.descEn }}
        </span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 16px 24px;
  text-align: center;
  max-width: 672px;
  margin: 0 auto;
}

.bot-icon-card {
  width: 56px;
  height: 56px;
  border-radius: var(--radius-lg);
  background-color: var(--card);
  border: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20px;
  box-shadow: 0 4px 20px rgba(124, 106, 247, 0.12);
}

.headline {
  font-size: 24px;
  font-weight: 700;
  color: var(--foreground);
  margin-bottom: 10px;
  min-height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
}

.gradient-text {
  background: linear-gradient(135deg, var(--foreground) 30%, var(--primary) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.typing-cursor {
  font-weight: 300;
  color: var(--primary);
  display: inline-block;
  margin-inline-start: 2px;
  animation: blink 0.7s infinite;
}

.typing-cursor.is-blinking {
  animation: blink 1.1s infinite;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

.subheadline {
  font-size: 14px;
  color: var(--muted-foreground);
  margin-bottom: 32px;
}

.suggestion-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  width: 100%;
}

@media (max-width: 640px) {
  .suggestion-grid {
    grid-template-columns: 1fr;
  }
}

.suggestion-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  text-align: inherit;
  padding: 14px 16px;
  background-color: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  transition: all 150ms ease;
}

.suggestion-card:hover {
  background-color: var(--secondary);
  border-color: var(--primary);
  transform: translateY(-1px);
}

.suggestion-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--foreground);
  margin-bottom: 4px;
}

.suggestion-desc {
  font-size: 11px;
  color: var(--muted-foreground);
}
</style>
