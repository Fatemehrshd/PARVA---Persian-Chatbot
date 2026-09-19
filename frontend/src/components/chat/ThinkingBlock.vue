<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { Brain, ChevronDown, Copy, Check } from '@lucide/vue'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible'
import MarkdownContent from './MarkdownContent.vue'

interface Props {
  reasoning: string
  isThinking?: boolean
  durationMs?: number | null
  defaultOpen?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isThinking: false,
  durationMs: null,
  defaultOpen: undefined,
})

const isOpen = ref(
  props.defaultOpen !== undefined
    ? props.defaultOpen
    : props.isThinking,
)

// If isThinking changes to false, keep current state or collapse if default was thinking
watch(
  () => props.isThinking,
  (newVal, oldVal) => {
    if (oldVal === true && newVal === false && props.defaultOpen === undefined) {
      isOpen.value = false
    }
  },
)

// Persian digit formatter
function toPersianDigits(n: number | string): string {
  const farsiDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹']
  return String(n).replace(/[0-9]/g, (w) => farsiDigits[+w])
}

// Live elapsed seconds timer during streaming
const liveSeconds = ref(0)
let timer: ReturnType<typeof setInterval> | null = null

function startTimer() {
  if (timer) clearInterval(timer)
  liveSeconds.value = 0
  timer = setInterval(() => {
    liveSeconds.value++
  }, 1000)
}

function stopTimer() {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

watch(
  () => props.isThinking,
  (thinking) => {
    if (thinking) {
      startTimer()
    } else {
      stopTimer()
    }
  },
  { immediate: true },
)

onMounted(() => {
  if (props.isThinking) {
    startTimer()
  }
})

onUnmounted(() => {
  stopTimer()
})

const formattedDuration = computed(() => {
  if (props.durationMs === null || props.durationMs === undefined) return null
  if (props.durationMs < 1000) {
    return `${toPersianDigits(props.durationMs)} میلی‌ثانیه`
  }
  const sec = (props.durationMs / 1000).toFixed(1).replace(/\.0$/, '')
  return `${toPersianDigits(sec)} ثانیه`
})

const copied = ref(false)
async function copyReasoning() {
  if (!props.reasoning) return
  try {
    await navigator.clipboard.writeText(props.reasoning)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch {}
}
</script>

<template>
  <div v-if="reasoning || isThinking" class="my-2" data-test="thinking-block">
    <Collapsible v-model:open="isOpen">
      <CollapsibleTrigger as-child>
        <button
          type="button"
          class="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors py-1.5 px-2.5 rounded-lg hover:bg-purple-500/10 select-none group w-full text-right border border-transparent hover:border-purple-500/20"
          data-test="thinking-trigger"
        >
          <Brain
            :class="[
              'w-4 h-4 text-purple-500 transition-transform shrink-0',
              isThinking ? 'animate-pulse text-purple-600 dark:text-purple-400' : 'opacity-80',
            ]"
            aria-hidden="true"
          />
          <span class="flex items-center gap-1.5 truncate">
            <template v-if="isThinking">
              <span class="font-semibold text-purple-600 dark:text-purple-400">در حال فکر کردن و تحلیل عمیق</span>
              <span v-if="liveSeconds > 0" class="text-muted-foreground/80 font-mono text-[11px]">
                ({{ toPersianDigits(liveSeconds) }} ثانیه)
              </span>...
            </template>
            <template v-else>
              <span class="font-medium">فرآیند تفکر عمیق</span>
              <span v-if="formattedDuration" class="text-muted-foreground/80 font-mono text-[11px]">
                ({{ formattedDuration }})
              </span>
            </template>
          </span>
          <ChevronDown
            :class="[
              'w-3.5 h-3.5 transition-transform duration-200 opacity-60 group-hover:opacity-100 mr-auto shrink-0',
              isOpen ? 'rotate-180' : '',
            ]"
            aria-hidden="true"
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div
          class="thinking-panel mt-2 rounded-xl bg-purple-500/[0.03] dark:bg-purple-950/[0.15] border border-purple-500/20 border-s-4 border-s-purple-500/70 p-3.5 shadow-sm text-xs leading-relaxed"
          data-test="thinking-content"
          dir="auto"
        >
          <!-- Thinking Panel Header / Toolbar -->
          <div class="flex items-center justify-between pb-2 mb-2 border-b border-purple-500/10 text-[11px] text-muted-foreground select-none">
            <span class="flex items-center gap-1.5 font-medium text-purple-600 dark:text-purple-400">
              <Brain class="w-3.5 h-3.5" />
              <span>زنجیره تفکر و استدلال مدل (Chain of Thought)</span>
            </span>
            <button
              type="button"
              class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] text-muted-foreground hover:text-foreground hover:bg-purple-500/10 transition-colors"
              title="کپی کردن متن استدلال"
              @click.stop="copyReasoning"
            >
              <Check v-if="copied" class="w-3 h-3 text-emerald-500" />
              <Copy v-else class="w-3 h-3" />
              <span>{{ copied ? 'کپی شد' : 'کپی استدلال' }}</span>
            </button>
          </div>

          <!-- Thinking Content with Rich Markdown -->
          <div class="thinking-markdown max-h-80 overflow-y-auto pr-1 pl-1 text-muted-foreground leading-relaxed">
            <MarkdownContent :content="reasoning" :streaming="isThinking" />
          </div>

          <!-- Pulsing dot indicator while actively thinking -->
          <div v-if="isThinking" class="flex items-center gap-1.5 mt-2.5 pt-1.5 border-t border-purple-500/10 text-[11px] text-purple-500/90 font-medium">
            <span class="w-1.5 h-1.5 rounded-full bg-purple-500 animate-ping"></span>
            <span>در حال ادامه‌ی استنتاج و نتیجه‌گیری...</span>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  </div>
</template>
