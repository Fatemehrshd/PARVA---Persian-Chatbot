<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import {
  Calendar as CalendarIcon,
  Clock,
  ChevronRight,
  ChevronLeft,
  X,
  Check,
} from '@lucide/vue'
import {
  JALALI_MONTH_NAMES,
  JALALI_WEEKDAY_NAMES,
  toPersianDigits,
  getDaysInJalaliMonth,
  gregorianToJalali,
  jalaliToGregorian,
  getFirstWeekdayOfJalaliMonth,
  formatJalaliDisplay,
} from '../../lib/jalali'
import BaseButton from './BaseButton.vue'

const props = withDefaults(
  defineProps<{
    modelValue?: string | null
    disabled?: boolean
    placeholder?: string
  }>(),
  {
    modelValue: '',
    disabled: false,
    placeholder: 'انتخاب تاریخ و ساعت انقضا...',
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const isOpen = ref(false)
const triggerRef = ref<HTMLElement | null>(null)
const popoverRef = ref<HTMLElement | null>(null)
const isMobile = ref(false)
const popoverPosition = ref<{ top: number; right: number }>({ top: 0, right: 0 })

// Current view state for the calendar
const currentYear = ref(1405)
const currentMonth = ref(6) // 1 - 12
const selectedDay = ref<number | null>(null)
const selectedHour = ref(23)
const selectedMinute = ref(59)

// Initialize from modelValue
function syncFromModelValue() {
  if (props.modelValue) {
    const d = new Date(props.modelValue)
    if (!isNaN(d.getTime())) {
      const { jy, jm, jd } = gregorianToJalali(d.getFullYear(), d.getMonth() + 1, d.getDate())
      currentYear.value = jy
      currentMonth.value = jm
      selectedDay.value = jd
      selectedHour.value = d.getHours()
      selectedMinute.value = d.getMinutes()
      return
    }
  }

  // Default to today
  const now = new Date()
  const { jy, jm } = gregorianToJalali(now.getFullYear(), now.getMonth() + 1, now.getDate())
  currentYear.value = jy
  currentMonth.value = jm
  selectedDay.value = null
  selectedHour.value = 23
  selectedMinute.value = 59
}

watch(() => props.modelValue, syncFromModelValue, { immediate: true })

const displayValue = computed(() => {
  if (!props.modelValue) return ''
  return formatJalaliDisplay(props.modelValue, true)
})

// Calculate calendar grid days
const daysInMonth = computed(() => getDaysInJalaliMonth(currentYear.value, currentMonth.value))
const startWeekday = computed(() => getFirstWeekdayOfJalaliMonth(currentYear.value, currentMonth.value))

// Today's Jalali date for highlighting
const todayJalali = computed(() => {
  const now = new Date()
  return gregorianToJalali(now.getFullYear(), now.getMonth() + 1, now.getDate())
})

function isToday(day: number): boolean {
  return (
    todayJalali.value.jy === currentYear.value &&
    todayJalali.value.jm === currentMonth.value &&
    todayJalali.value.jd === day
  )
}

function isSelected(day: number): boolean {
  if (!selectedDay.value) return false
  if (!props.modelValue) return false
  const d = new Date(props.modelValue)
  if (isNaN(d.getTime())) return false
  const { jy, jm, jd } = gregorianToJalali(d.getFullYear(), d.getMonth() + 1, d.getDate())
  return jy === currentYear.value && jm === currentMonth.value && jd === day
}

function selectDay(day: number) {
  selectedDay.value = day
  emitUpdatedValue()
}

function emitUpdatedValue() {
  if (!selectedDay.value) return
  const { gy, gm, gd } = jalaliToGregorian(currentYear.value, currentMonth.value, selectedDay.value)
  const d = new Date(gy, gm - 1, gd, selectedHour.value, selectedMinute.value, 0, 0)
  const pad = (n: number) => (n < 10 ? '0' + n : String(n))
  const isoLocal = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  emit('update:modelValue', isoLocal)
}

function prevMonth() {
  if (currentMonth.value === 1) {
    currentMonth.value = 12
    currentYear.value--
  } else {
    currentMonth.value--
  }
}

function nextMonth() {
  if (currentMonth.value === 12) {
    currentMonth.value = 1
    currentYear.value++
  } else {
    currentMonth.value++
  }
}

function setToday() {
  const now = new Date()
  const { jy, jm, jd } = gregorianToJalali(now.getFullYear(), now.getMonth() + 1, now.getDate())
  currentYear.value = jy
  currentMonth.value = jm
  selectedDay.value = jd
  selectedHour.value = now.getHours()
  selectedMinute.value = now.getMinutes()
  emitUpdatedValue()
}

function handleClear(e: Event) {
  e.stopPropagation()
  selectedDay.value = null
  emit('update:modelValue', '')
  isOpen.value = false
}

function handleConfirm() {
  emitUpdatedValue()
  isOpen.value = false
}

function checkIsMobile() {
  isMobile.value = typeof window !== 'undefined' && window.innerWidth <= 640
}

function updatePopoverPosition() {
  if (!triggerRef.value) return
  checkIsMobile()
  if (isMobile.value) return

  const rect = triggerRef.value.getBoundingClientRect()
  const popoverHeight = 390
  const popoverWidth = 320

  // Check if we should open above or below
  const spaceBelow = window.innerHeight - rect.bottom
  const spaceAbove = rect.top
  const openAbove = spaceBelow < popoverHeight && spaceAbove > spaceBelow

  let top = openAbove ? rect.top - popoverHeight - 8 : rect.bottom + 8
  if (top < 10) top = 10
  if (top + popoverHeight > window.innerHeight - 10) {
    top = window.innerHeight - popoverHeight - 10
  }

  // Right-aligned in RTL
  const right = window.innerWidth - rect.right

  popoverPosition.value = {
    top,
    right: Math.max(10, Math.min(right, window.innerWidth - popoverWidth - 10)),
  }
}

function toggleOpen() {
  if (props.disabled) return
  isOpen.value = !isOpen.value
}

watch(isOpen, (open) => {
  if (open) {
    updatePopoverPosition()
    window.addEventListener('resize', updatePopoverPosition)
    window.addEventListener('scroll', updatePopoverPosition, true)
  } else {
    window.removeEventListener('resize', updatePopoverPosition)
    window.removeEventListener('scroll', updatePopoverPosition, true)
  }
})

function handleClickOutside(event: MouseEvent) {
  const target = event.target as Node
  if (
    triggerRef.value &&
    !triggerRef.value.contains(target) &&
    popoverRef.value &&
    !popoverRef.value.contains(target)
  ) {
    isOpen.value = false
  }
}

onMounted(() => {
  checkIsMobile()
  document.addEventListener('click', handleClickOutside, true)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside, true)
  window.removeEventListener('resize', updatePopoverPosition)
  window.removeEventListener('scroll', updatePopoverPosition, true)
})

const yearOptions = computed(() => {
  const years: number[] = []
  for (let y = 1402; y <= 1415; y++) {
    years.push(y)
  }
  return years
})
</script>

<template>
  <div class="relative inline-block w-full text-right" dir="rtl">
    <!-- Input Trigger -->
    <div
      ref="triggerRef"
      class="flex items-center justify-between w-full px-3 py-2 bg-background border border-border rounded-xl text-foreground text-sm cursor-pointer transition-all hover:border-primary/50 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20"
      :class="{ 'opacity-60 pointer-events-none': disabled, 'border-primary ring-2 ring-primary/20': isOpen }"
      @click="toggleOpen"
    >
      <div class="flex items-center gap-2 truncate">
        <CalendarIcon :size="16" class="text-primary shrink-0" />
        <span v-if="displayValue" class="font-sans font-medium text-foreground">
          {{ displayValue }}
        </span>
        <span v-else class="text-muted-foreground text-xs select-none">
          {{ placeholder }}
        </span>
      </div>

      <div class="flex items-center gap-1">
        <button
          v-if="modelValue && !disabled"
          type="button"
          class="p-1 rounded-md text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
          title="حذف تاریخ انقضا"
          @click="handleClear"
        >
          <X :size="14" />
        </button>
      </div>
    </div>

    <!-- Teleported Floating Calendar Popover -->
    <Teleport to="body">
      <div v-if="isOpen" class="persian-datepicker-teleport" dir="rtl">
        <!-- Mobile Centered Modal Overlay -->
        <div
          v-if="isMobile"
          class="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          @click="isOpen = false"
        >
          <div
            ref="popoverRef"
            class="w-full max-w-[340px] bg-card text-card-foreground border border-border rounded-2xl shadow-2xl p-4 animate-in zoom-in-95 duration-150"
            @click.stop
          >
            <!-- Calendar Content -->
            <!-- Header: Month/Year navigation -->
            <div class="flex items-center justify-between gap-2 mb-3 pb-2 border-b border-border">
              <button
                type="button"
                class="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                title="ماه بعد"
                @click="nextMonth"
              >
                <ChevronRight :size="18" />
              </button>

              <div class="flex items-center gap-1.5 font-medium text-sm">
                <select
                  v-model="currentMonth"
                  class="bg-accent/50 border border-border rounded-lg px-2 py-1 text-xs text-foreground font-semibold focus:outline-none focus:border-primary cursor-pointer"
                >
                  <option v-for="(mName, idx) in JALALI_MONTH_NAMES" :key="idx + 1" :value="idx + 1">
                    {{ mName }}
                  </option>
                </select>

                <select
                  v-model="currentYear"
                  class="bg-accent/50 border border-border rounded-lg px-2 py-1 text-xs text-foreground font-semibold font-mono focus:outline-none focus:border-primary cursor-pointer"
                >
                  <option v-for="y in yearOptions" :key="y" :value="y">
                    {{ toPersianDigits(y) }}
                  </option>
                </select>
              </div>

              <button
                type="button"
                class="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                title="ماه قبل"
                @click="prevMonth"
              >
                <ChevronLeft :size="18" />
              </button>
            </div>

            <!-- Weekday Names -->
            <div class="grid grid-cols-7 gap-1 text-center mb-1 text-[11px] font-semibold text-muted-foreground select-none">
              <div
                v-for="(w, idx) in JALALI_WEEKDAY_NAMES"
                :key="w.short"
                :class="{ 'text-rose-500 font-bold': idx === 6 }"
              >
                {{ w.short }}
              </div>
            </div>

            <!-- Calendar Days Grid -->
            <div class="grid grid-cols-7 gap-1 text-center text-xs">
              <div v-for="offset in startWeekday" :key="'offset-' + offset" class="h-8"></div>

              <button
                v-for="day in daysInMonth"
                :key="'day-' + day"
                type="button"
                class="h-8 w-full rounded-lg flex items-center justify-center font-mono font-medium transition-all relative"
                :class="[
                  isSelected(day)
                    ? 'bg-primary text-primary-foreground font-bold shadow-sm'
                    : isToday(day)
                    ? 'border border-primary text-primary font-bold hover:bg-primary/10'
                    : 'text-foreground hover:bg-accent',
                ]"
                @click="selectDay(day)"
              >
                {{ toPersianDigits(day) }}
                <span
                  v-if="isToday(day) && !isSelected(day)"
                  class="absolute bottom-1 w-1 h-1 rounded-full bg-primary"
                ></span>
              </button>
            </div>

            <!-- Time Picker Section -->
            <div class="mt-3 pt-3 border-t border-border flex items-center justify-between text-xs">
              <div class="flex items-center gap-1.5 text-muted-foreground">
                <Clock :size="15" class="text-primary" />
                <span>ساعت و دقیقه:</span>
              </div>

              <div class="flex items-center gap-1 font-mono direction-ltr" dir="ltr">
                <select
                  v-model.number="selectedHour"
                  class="bg-accent/50 border border-border rounded-lg px-2 py-1 text-xs text-foreground focus:outline-none focus:border-primary cursor-pointer"
                  @change="emitUpdatedValue"
                >
                  <option v-for="h in 24" :key="h - 1" :value="h - 1">
                    {{ String(h - 1).padStart(2, '0') }}
                  </option>
                </select>
                <span class="text-foreground font-bold">:</span>
                <select
                  v-model.number="selectedMinute"
                  class="bg-accent/50 border border-border rounded-lg px-2 py-1 text-xs text-foreground focus:outline-none focus:border-primary cursor-pointer"
                  @change="emitUpdatedValue"
                >
                  <option v-for="m in 60" :key="m - 1" :value="m - 1">
                    {{ String(m - 1).padStart(2, '0') }}
                  </option>
                </select>
              </div>
            </div>

            <!-- Action Footer -->
            <div class="mt-4 pt-3 border-t border-border flex items-center justify-between gap-2">
              <button
                type="button"
                class="text-xs text-muted-foreground hover:text-foreground hover:underline transition-colors select-none"
                @click="setToday"
              >
                امروز
              </button>

              <div class="flex items-center gap-2">
                <button
                  v-if="modelValue"
                  type="button"
                  class="px-2.5 py-1 text-xs rounded-lg text-rose-500 hover:bg-rose-500/10 transition-colors"
                  @click="handleClear"
                >
                  بدون انقضا
                </button>

                <BaseButton
                  type="button"
                  variant="primary"
                  size="sm"
                  class="px-3 py-1 text-xs"
                  @click="handleConfirm"
                >
                  <Check :size="14" />
                  <span>تایید</span>
                </BaseButton>
              </div>
            </div>
          </div>
        </div>

        <!-- Desktop Positioned Popover (Fixed, outside modal scroll container) -->
        <div
          v-else
          ref="popoverRef"
          class="fixed z-[9999] w-80 bg-card text-card-foreground border border-border rounded-2xl shadow-2xl p-4 animate-in fade-in zoom-in-95 duration-150"
          :style="{ top: `${popoverPosition.top}px`, right: `${popoverPosition.right}px` }"
          @click.stop
        >
          <!-- Header: Month/Year navigation -->
          <div class="flex items-center justify-between gap-2 mb-3 pb-2 border-b border-border">
            <button
              type="button"
              class="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              title="ماه بعد"
              @click="nextMonth"
            >
              <ChevronRight :size="18" />
            </button>

            <div class="flex items-center gap-1.5 font-medium text-sm">
              <select
                v-model="currentMonth"
                class="bg-accent/50 border border-border rounded-lg px-2 py-1 text-xs text-foreground font-semibold focus:outline-none focus:border-primary cursor-pointer"
              >
                <option v-for="(mName, idx) in JALALI_MONTH_NAMES" :key="idx + 1" :value="idx + 1">
                  {{ mName }}
                </option>
              </select>

              <select
                v-model="currentYear"
                class="bg-accent/50 border border-border rounded-lg px-2 py-1 text-xs text-foreground font-semibold font-mono focus:outline-none focus:border-primary cursor-pointer"
              >
                <option v-for="y in yearOptions" :key="y" :value="y">
                  {{ toPersianDigits(y) }}
                </option>
              </select>
            </div>

            <button
              type="button"
              class="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              title="ماه قبل"
              @click="prevMonth"
            >
              <ChevronLeft :size="18" />
            </button>
          </div>

          <!-- Weekday Names -->
          <div class="grid grid-cols-7 gap-1 text-center mb-1 text-[11px] font-semibold text-muted-foreground select-none">
            <div
              v-for="(w, idx) in JALALI_WEEKDAY_NAMES"
              :key="w.short"
              :class="{ 'text-rose-500 font-bold': idx === 6 }"
            >
              {{ w.short }}
            </div>
          </div>

          <!-- Calendar Days Grid -->
          <div class="grid grid-cols-7 gap-1 text-center text-xs">
            <div v-for="offset in startWeekday" :key="'offset-' + offset" class="h-8"></div>

            <button
              v-for="day in daysInMonth"
              :key="'day-' + day"
              type="button"
              class="h-8 w-full rounded-lg flex items-center justify-center font-mono font-medium transition-all relative"
              :class="[
                isSelected(day)
                  ? 'bg-primary text-primary-foreground font-bold shadow-sm'
                  : isToday(day)
                  ? 'border border-primary text-primary font-bold hover:bg-primary/10'
                  : 'text-foreground hover:bg-accent',
              ]"
              @click="selectDay(day)"
            >
              {{ toPersianDigits(day) }}
              <span
                v-if="isToday(day) && !isSelected(day)"
                class="absolute bottom-1 w-1 h-1 rounded-full bg-primary"
              ></span>
            </button>
          </div>

          <!-- Time Picker Section -->
          <div class="mt-3 pt-3 border-t border-border flex items-center justify-between text-xs">
            <div class="flex items-center gap-1.5 text-muted-foreground">
              <Clock :size="15" class="text-primary" />
              <span>ساعت و دقیقه:</span>
            </div>

            <div class="flex items-center gap-1 font-mono direction-ltr" dir="ltr">
              <select
                v-model.number="selectedHour"
                class="bg-accent/50 border border-border rounded-lg px-2 py-1 text-xs text-foreground focus:outline-none focus:border-primary cursor-pointer"
                @change="emitUpdatedValue"
              >
                <option v-for="h in 24" :key="h - 1" :value="h - 1">
                  {{ String(h - 1).padStart(2, '0') }}
                </option>
              </select>
              <span class="text-foreground font-bold">:</span>
              <select
                v-model.number="selectedMinute"
                class="bg-accent/50 border border-border rounded-lg px-2 py-1 text-xs text-foreground focus:outline-none focus:border-primary cursor-pointer"
                @change="emitUpdatedValue"
              >
                <option v-for="m in 60" :key="m - 1" :value="m - 1">
                  {{ String(m - 1).padStart(2, '0') }}
                </option>
              </select>
            </div>
          </div>

          <!-- Action Footer -->
          <div class="mt-4 pt-3 border-t border-border flex items-center justify-between gap-2">
            <button
              type="button"
              class="text-xs text-muted-foreground hover:text-foreground hover:underline transition-colors select-none"
              @click="setToday"
            >
              امروز
            </button>

            <div class="flex items-center gap-2">
              <button
                v-if="modelValue"
                type="button"
                class="px-2.5 py-1 text-xs rounded-lg text-rose-500 hover:bg-rose-500/10 transition-colors"
                @click="handleClear"
              >
                بدون انقضا
              </button>

              <BaseButton
                type="button"
                variant="primary"
                size="sm"
                class="px-3 py-1 text-xs"
                @click="handleConfirm"
              >
                <Check :size="14" />
                <span>تایید</span>
              </BaseButton>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
select {
  appearance: none;
  -webkit-appearance: none;
  text-align-last: center;
}
</style>
