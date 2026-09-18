<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { Brain, ChevronDown } from '@lucide/vue'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible'

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
</script>

<template>
  <div v-if="reasoning || isThinking" class="my-2" data-test="thinking-block">
    <Collapsible v-model:open="isOpen">
      <CollapsibleTrigger as-child>
        <button
          type="button"
          class="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors py-1 px-2 rounded-md hover:bg-muted/50 select-none group w-full text-right"
          data-test="thinking-trigger"
        >
          <Brain
            :class="[
              'w-4 h-4 text-purple-500 transition-transform shrink-0',
              isThinking ? 'animate-pulse text-purple-600 dark:text-purple-400' : 'opacity-80',
            ]"
            aria-hidden="true"
          />
          <span class="flex items-center gap-1 truncate">
            <template v-if="isThinking">
              در حال فکر کردن
              <span v-if="liveSeconds > 0" class="text-muted-foreground/80">
                ({{ toPersianDigits(liveSeconds) }} ثانیه)
              </span>...
            </template>
            <template v-else>
              فرآیند تفکر
              <span v-if="formattedDuration" class="text-muted-foreground/80">
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
          class="mt-1.5 p-3 rounded-lg bg-muted/40 dark:bg-zinc-800/40 border border-border/50 border-r-2 border-r-purple-500 text-xs text-muted-foreground font-mono leading-relaxed whitespace-pre-wrap max-h-60 overflow-y-auto"
          data-test="thinking-content"
          dir="auto"
        >
          {{ reasoning }}
        </div>
      </CollapsibleContent>
    </Collapsible>
  </div>
</template>
