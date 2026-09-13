<script setup lang="ts">
import { useUiStore } from '../../stores/ui'
import { useChatStore } from '../../stores/chat'

const uiStore = useUiStore()
const chatStore = useChatStore()

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
    <div class="bot-icon-card">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2C6.477 2 2 6.477 2 12C2 17.523 6.477 22 12 22C17.523 22 22 17.523 22 12C22 6.477 17.523 2 12 2Z" stroke="var(--primary)" stroke-width="1.8" />
        <path d="M8.5 10.5C8.5 10.5 9 9.5 12 9.5C15 9.5 15.5 10.5 15.5 10.5" stroke="var(--primary)" stroke-width="1.8" stroke-linecap="round" />
        <circle cx="9" cy="14" r="1" fill="var(--primary)" />
        <circle cx="15" cy="14" r="1" fill="var(--primary)" />
      </svg>
    </div>

    <h1 class="headline">
      {{ uiStore.direction === 'rtl' ? 'چطور می‌توانم به شما کمک کنم؟' : 'How can I help you today?' }}
    </h1>
    <p class="subheadline">
      {{ uiStore.direction === 'rtl' ? 'پلتفرم گفتگوی هوشمند NeuralChat با پشتیبانی از مدل‌های چندگانه' : 'NeuralChat multi-model intelligent workspace' }}
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
  margin-bottom: 8px;
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
