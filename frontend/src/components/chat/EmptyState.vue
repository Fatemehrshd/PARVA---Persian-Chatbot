<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '../../stores/auth'
import { useThemeLogo } from '../../composables/useThemeLogo'

const authStore = useAuthStore()
const { activeLogo } = useThemeLogo()

// Use the app's own locale (html[lang]) rather than the browser locale —
// a user may have an English browser but still want Persian greetings,
// and the app controls its own language via document.documentElement.lang.
const currentLang = typeof document !== 'undefined' ? document.documentElement.lang : 'fa'
const isPersian = currentLang.toLowerCase().startsWith('fa')

const greetingsFa = [
  'سلام {name}، شروع کنیم؟',
  'سلام {name}، هر چیزی می‌خوای، اینجا بنویس!',
  'سلام {name}، هرچه دل تنگت می‌خواهد، بگو!',
  'سلام {name}، از کجا شروع کنیم؟',
  'سلام {name}، چطور می‌تونم کمکت کنم؟',
  'سلام {name}، چه کاری ازم ساخته‌ست؟'
]

const greetingsEn = [
  "Hello {name}, let's get started!",
  "Hello {name}, what's in your mind?",
  "Hello {name}, shall we start?",
  "Hello {name}, how can I help you?",
  "Hello {name}, what can I help you with?"
]

// Pick once at setup so the random selection stays stable for the session.
const randomGreeting = ref(
  (isPersian ? greetingsFa : greetingsEn)[
    Math.floor(Math.random() * (isPersian ? greetingsFa.length : greetingsEn.length))
  ]
)

// {name} placeholder is filled reactively so it tracks the current user
// without re-rolling the random pick.
const fullGreeting = computed(() => {
  const name =
    authStore.user?.displayName || authStore.user?.email?.split('@')[0]
  const fallback = isPersian ? 'دوست من' : 'friend'
  return randomGreeting.value.replace('{name}', name || fallback)
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
</script>

<template>
  <div class="empty-state">
    <div class="bot-icon-card">
      <img :src="activeLogo" alt="پروا" class="w-full h-full object-cover" />
    </div>

    <h1 class="headline">
      <span class="gradient-text">{{ displayedGreeting }}</span>
      <span class="typing-cursor" :class="{ 'is-blinking': !isTyping }">|</span>
    </h1>
    
  </div>
</template>

<style scoped>
.empty-state {
  flex: 1;
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
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20px;
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
